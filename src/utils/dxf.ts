import { DrawingPath, DrawingPoint, RegisteredPart, LineType } from '../types';
import { cleanAndNormalizePoints } from './geometry';

export interface DxfParseOptions {
    /** Scale factor to apply to all coordinates (e.g. 0.01 for 1/100 scale, 1.0 for 1:1) */
    scale?: number;
    /** Invert CAD +Y (up) to screen +Y (down). Default: true */
    invertY?: boolean;
    /** Whether to automatically chain contiguous LINE entities into polylines. Default: true */
    chainLines?: boolean;
    /** Tolerance in mm for connecting contiguous lines. Default: 0.15 */
    chainTolerance?: number;
    /** Whether to run cleanAndNormalizePoints on output paths. Default: true */
    cleanVertices?: boolean;
    /** Default stroke color. Default: '#1e293b' */
    defaultColor?: string;
    /** Default stroke width in mm. Default: 0.5 */
    defaultStrokeWidth?: number;
    /** Target layer name to filter, or empty for all */
    layerFilter?: string[];
    /** Whether to import TEXT and MTEXT entities. Default: true */
    importText?: boolean;
    /** Text sizing mode: 'auto' (smart architectural 1.8mm~6.0mm) | 'cad' (raw CAD height * scale) | 'fixed' (fixed mm). Default: 'auto' */
    textSizeMode?: 'auto' | 'cad' | 'fixed';
    /** Custom text size in mm when textSizeMode is 'fixed'. Default: 2.5 */
    fixedTextSize?: number;
}

export interface DxfLayerInfo {
    name: string;
    color: string;
    entityCount: number;
}

export interface DxfParseResult {
    paths: DrawingPath[];
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        width: number;
        height: number;
    };
    layers: DxfLayerInfo[];
    entityCounts: Record<string, number>;
    insUnits?: number; // 1=inches, 4=mm, 6=m
    textCount?: number;
}

// AutoCAD Color Index (ACI) to Hex Colors (tuned for light background canvas)
const ACI_COLORS: Record<number, string> = {
    1: '#dc2626', // Red
    2: '#ca8a04', // Yellow / Gold
    3: '#16a34a', // Green
    4: '#0891b2', // Cyan
    5: '#2563eb', // Blue
    6: '#c026d3', // Magenta
    7: '#1e293b', // Black / Dark Slate (ACI 7 is white on dark CAD, dark on light canvas)
    8: '#64748b', // Dark Gray
    9: '#94a3b8', // Light Gray
};

function getAciColor(index: number, fallback: string = '#1e293b'): string {
    if (ACI_COLORS[index]) return ACI_COLORS[index];
    // Simple algorithmic fallback for standard 256 colors
    if (index >= 10 && index <= 249) {
        // Approximate standard AutoCAD hue wheel
        const hue = Math.floor(((index - 10) / 240) * 360);
        return `hsl(${hue}, 70%, 45%)`;
    }
    return fallback;
}

interface RawPair {
    code: number;
    value: string;
}

interface RawEntity {
    type: string;
    layer: string;
    colorIndex?: number;
    trueColor?: string;
    lineType?: string;
    values: RawPair[];
}

interface RawBlock {
    name: string;
    basePoint: { x: number; y: number; z: number };
    entities: RawEntity[];
}

/**
 * Parses raw ASCII DXF text into pairs of (code, value)
 */
function tokenizeDxf(dxfText: string): RawPair[] {
    const lines = dxfText.split(/\r?\n/);
    const pairs: RawPair[] = [];
    const len = lines.length;

    for (let i = 0; i < len - 1; i += 2) {
        const codeStr = lines[i].trim();
        if (codeStr === '') continue;
        const code = parseInt(codeStr, 10);
        if (isNaN(code)) continue;

        const value = lines[i + 1] !== undefined ? lines[i + 1].trim() : '';
        pairs.push({ code, value });
    }

    return pairs;
}

/**
 * Checks whether content looks like a DXF file
 */
export function isDxfContent(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const headerSlice = text.slice(0, 1500).replace(/\r/g, '');
    return (
        headerSlice.includes('0\nSECTION') &&
        (headerSlice.includes('HEADER') ||
            headerSlice.includes('TABLES') ||
            headerSlice.includes('BLOCKS') ||
            headerSlice.includes('ENTITIES') ||
            text.includes('0\nEOF'))
    );
}

/**
 * Resolves LineType based on DXF linetype name
 */
function resolveLineType(rawName?: string): LineType {
    if (!rawName) return 'solid';
    const upper = rawName.toUpperCase();
    if (upper.includes('DASH_DOT_DOT') || upper.includes('DASHDOTDOT') || upper.includes('DIVIDE')) {
        return 'dash-dot-dot';
    }
    if (upper.includes('DASH_DOT') || upper.includes('DASHDOT') || upper.includes('CENTER')) {
        return 'dash-dot';
    }
    if (upper.includes('DASH') || upper.includes('HIDDEN')) {
        return 'dashed';
    }
    if (upper.includes('DOT')) {
        return 'dotted';
    }
    return 'solid';
}

/**
 * Main parser for DXF files into DrawingPaths
 */
export function parseDxf(dxfContent: string, options: DxfParseOptions = {}): DxfParseResult {
    const {
        scale = 1.0,
        invertY = true,
        chainLines = true,
        chainTolerance = 0.15,
        cleanVertices = true,
        defaultColor = '#1e293b',
        defaultStrokeWidth = 0.5,
        layerFilter,
        importText = true,
        textSizeMode = 'auto',
        fixedTextSize = 2.5,
    } = options;

    const pairs = tokenizeDxf(dxfContent);
    const totalPairs = pairs.length;

    const layerColors: Record<string, string> = {};
    const blocks: Record<string, RawBlock> = {};
    const rootEntities: RawEntity[] = [];
    const entityCounts: Record<string, number> = {};

    let insUnits: number | undefined;

    // First pass: extract sections
    let ptr = 0;
    while (ptr < totalPairs) {
        const pair = pairs[ptr];

        if (pair.code === 0 && pair.value === 'SECTION') {
            ptr++;
            let sectionName = '';
            if (ptr < totalPairs && pairs[ptr].code === 2) {
                sectionName = pairs[ptr].value.toUpperCase();
                ptr++;
            }

            if (sectionName === 'HEADER') {
                while (ptr < totalPairs && !(pairs[ptr].code === 0 && pairs[ptr].value === 'ENDSEC')) {
                    if (pairs[ptr].code === 9 && pairs[ptr].value === '$INSUNITS') {
                        ptr++;
                        if (ptr < totalPairs && pairs[ptr].code === 70) {
                            insUnits = parseInt(pairs[ptr].value, 10);
                        }
                    }
                    ptr++;
                }
            } else if (sectionName === 'TABLES') {
                while (ptr < totalPairs && !(pairs[ptr].code === 0 && pairs[ptr].value === 'ENDSEC')) {
                    if (pairs[ptr].code === 0 && pairs[ptr].value === 'TABLE') {
                        ptr++;
                        let tableName = '';
                        if (ptr < totalPairs && pairs[ptr].code === 2) {
                            tableName = pairs[ptr].value.toUpperCase();
                            ptr++;
                        }
                        if (tableName === 'LAYER') {
                            let currentLayerName = '';
                            let currentLayerColor = defaultColor;
                            while (ptr < totalPairs && !(pairs[ptr].code === 0 && pairs[ptr].value === 'ENDTAB')) {
                                const p = pairs[ptr];
                                if (p.code === 0 && p.value === 'LAYER') {
                                    if (currentLayerName) {
                                        layerColors[currentLayerName.toLowerCase()] = currentLayerColor;
                                    }
                                    currentLayerName = '';
                                    currentLayerColor = defaultColor;
                                } else if (p.code === 2) {
                                    currentLayerName = p.value;
                                } else if (p.code === 62) {
                                    const aci = Math.abs(parseInt(p.value, 10));
                                    currentLayerColor = getAciColor(aci, defaultColor);
                                }
                                ptr++;
                            }
                            if (currentLayerName) {
                                layerColors[currentLayerName.toLowerCase()] = currentLayerColor;
                            }
                        }
                    }
                    ptr++;
                }
            } else if (sectionName === 'BLOCKS') {
                while (ptr < totalPairs && !(pairs[ptr].code === 0 && pairs[ptr].value === 'ENDSEC')) {
                    if (pairs[ptr].code === 0 && pairs[ptr].value === 'BLOCK') {
                        ptr++;
                        let blockName = '';
                        const basePt = { x: 0, y: 0, z: 0 };
                        const blockEntities: RawEntity[] = [];

                        while (ptr < totalPairs && !(pairs[ptr].code === 0 && pairs[ptr].value === 'ENDBLK')) {
                            const p = pairs[ptr];
                            if (p.code === 2 && !blockName) blockName = p.value;
                            else if (p.code === 10) basePt.x = parseFloat(p.value);
                            else if (p.code === 20) basePt.y = parseFloat(p.value);
                            else if (p.code === 30) basePt.z = parseFloat(p.value);
                            else if (p.code === 0) {
                                // Entity inside block
                                const entType = p.value.toUpperCase();
                                ptr++;
                                const entValues: RawPair[] = [];
                                let entLayer = '0';
                                let entColor: number | undefined;
                                let entTrueColor: string | undefined;
                                let entLineType: string | undefined;

                                while (ptr < totalPairs && pairs[ptr].code !== 0) {
                                    const ep = pairs[ptr];
                                    if (ep.code === 8) entLayer = ep.value;
                                    else if (ep.code === 62) entColor = parseInt(ep.value, 10);
                                    else if (ep.code === 420) {
                                        const c = parseInt(ep.value, 10);
                                        entTrueColor = `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
                                    } else if (ep.code === 6) entLineType = ep.value;
                                    entValues.push(ep);
                                    ptr++;
                                }
                                blockEntities.push({
                                    type: entType,
                                    layer: entLayer,
                                    colorIndex: entColor,
                                    trueColor: entTrueColor,
                                    lineType: entLineType,
                                    values: entValues,
                                });
                                continue;
                            }
                            ptr++;
                        }

                        if (blockName) {
                            blocks[blockName.toLowerCase()] = {
                                name: blockName,
                                basePoint: basePt,
                                entities: blockEntities,
                            };
                        }
                    }
                    ptr++;
                }
            } else if (sectionName === 'ENTITIES') {
                while (ptr < totalPairs && !(pairs[ptr].code === 0 && pairs[ptr].value === 'ENDSEC')) {
                    if (pairs[ptr].code === 0) {
                        const entType = pairs[ptr].value.toUpperCase();
                        ptr++;
                        const entValues: RawPair[] = [];
                        let entLayer = '0';
                        let entColor: number | undefined;
                        let entTrueColor: string | undefined;
                        let entLineType: string | undefined;

                        while (ptr < totalPairs && pairs[ptr].code !== 0) {
                            const ep = pairs[ptr];
                            if (ep.code === 8) entLayer = ep.value;
                            else if (ep.code === 62) entColor = parseInt(ep.value, 10);
                            else if (ep.code === 420) {
                                const c = parseInt(ep.value, 10);
                                entTrueColor = `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
                            } else if (ep.code === 6) entLineType = ep.value;
                            entValues.push(ep);
                            ptr++;
                        }

                        entityCounts[entType] = (entityCounts[entType] || 0) + 1;
                        rootEntities.push({
                            type: entType,
                            layer: entLayer,
                            colorIndex: entColor,
                            trueColor: entTrueColor,
                            lineType: entLineType,
                            values: entValues,
                        });
                        continue;
                    }
                    ptr++;
                }
            }
        }
        ptr++;
    }

    // Helper to resolve entity stroke color
    const resolveEntityColor = (layer: string, colorIndex?: number, trueColor?: string): string => {
        if (trueColor) return trueColor;
        if (colorIndex !== undefined && colorIndex > 0 && colorIndex !== 256) {
            return getAciColor(colorIndex, defaultColor);
        }
        const layerCol = layerColors[layer.toLowerCase()];
        return layerCol || defaultColor;
    };

    // Transform helper
    const transformPt = (
        x: number,
        y: number,
        tx = 0,
        ty = 0,
        sx = 1,
        sy = 1,
        rotDeg = 0
    ): DrawingPoint => {
        let px = x * sx;
        let py = y * sy;
        if (rotDeg !== 0) {
            const rad = (rotDeg * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const rx = px * cos - py * sin;
            const ry = px * sin + py * cos;
            px = rx;
            py = ry;
        }
        const finalX = (px + tx) * scale;
        const finalY = (py + ty) * scale * (invertY ? -1 : 1);
        return { x: finalX, y: finalY };
    };

    interface LineSegment {
        start: DrawingPoint;
        end: DrawingPoint;
        color: string;
        strokeWidth: number;
        lineType: LineType;
        layer: string;
    }

    const isolatedLines: LineSegment[] = [];
    const directPaths: DrawingPath[] = [];
    let pathIdCounter = 0;

    const layerStats: Record<string, { color: string; count: number }> = {};

    // Entity parser (supports instantiating blocks recursively)
    const processEntity = (
        ent: RawEntity,
        tx = 0,
        ty = 0,
        sx = 1,
        sy = 1,
        rotDeg = 0,
        depth = 0
    ) => {
        if (depth > 10) return; // Prevent infinite block recursion

        const layer = ent.layer || '0';
        if (layerFilter && layerFilter.length > 0 && !layerFilter.includes(layer)) {
            return;
        }

        const color = resolveEntityColor(layer, ent.colorIndex, ent.trueColor);
        const lineType = resolveLineType(ent.lineType);

        if (!layerStats[layer]) {
            layerStats[layer] = { color, count: 0 };
        }
        layerStats[layer].count++;

        const vals = ent.values;

        switch (ent.type) {
            case 'LINE': {
                let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
                for (const v of vals) {
                    if (v.code === 10) x1 = parseFloat(v.value);
                    else if (v.code === 20) y1 = parseFloat(v.value);
                    else if (v.code === 11) x2 = parseFloat(v.value);
                    else if (v.code === 21) y2 = parseFloat(v.value);
                }
                const p1 = transformPt(x1, y1, tx, ty, sx, sy, rotDeg);
                const p2 = transformPt(x2, y2, tx, ty, sx, sy, rotDeg);

                // Ignore zero-length lines
                if (Math.hypot(p1.x - p2.x, p1.y - p2.y) > 0.001) {
                    isolatedLines.push({
                        start: p1,
                        end: p2,
                        color,
                        strokeWidth: defaultStrokeWidth,
                        lineType,
                        layer,
                    });
                }
                break;
            }

            case 'LWPOLYLINE': {
                interface PolyVertex {
                    x: number;
                    y: number;
                    bulge: number;
                }
                const vertices: PolyVertex[] = [];
                let isClosed = false;
                let curV: PolyVertex | null = null;

                for (const v of vals) {
                    if (v.code === 70) {
                        const flag = parseInt(v.value, 10);
                        if ((flag & 1) !== 0) isClosed = true;
                    } else if (v.code === 10) {
                        if (curV) vertices.push(curV);
                        curV = { x: parseFloat(v.value), y: 0, bulge: 0 };
                    } else if (v.code === 20) {
                        if (curV) curV.y = parseFloat(v.value);
                    } else if (v.code === 42) {
                        if (curV) curV.bulge = parseFloat(v.value);
                    }
                }
                if (curV) vertices.push(curV);

                if (vertices.length < 2) break;

                // Expand vertices with arc bulge
                const expandedPoints: DrawingPoint[] = [];
                const count = vertices.length;
                const segCount = isClosed ? count : count - 1;

                for (let i = 0; i < segCount; i++) {
                    const v1 = vertices[i];
                    const v2 = vertices[(i + 1) % count];

                    const p1 = transformPt(v1.x, v1.y, tx, ty, sx, sy, rotDeg);
                    if (i === 0) expandedPoints.push(p1);

                    const bulge = v1.bulge || 0;
                    if (Math.abs(bulge) > 1e-4) {
                        // Generate arc points between v1 and v2
                        const arcPts = generateBulgeArcPoints(
                            v1.x,
                            v1.y,
                            v2.x,
                            v2.y,
                            bulge,
                            (x, y) => transformPt(x, y, tx, ty, sx, sy, rotDeg)
                        );
                        // arcPts includes intermediate points and p2
                        for (const ap of arcPts) {
                            expandedPoints.push(ap);
                        }
                    } else {
                        const p2 = transformPt(v2.x, v2.y, tx, ty, sx, sy, rotDeg);
                        expandedPoints.push(p2);
                    }
                }

                if (isClosed && expandedPoints.length > 2) {
                    expandedPoints.push({ ...expandedPoints[0] });
                }

                const cleaned = cleanVertices
                    ? cleanAndNormalizePoints(expandedPoints, { isClosed })
                    : expandedPoints;

                if (cleaned.length >= 2) {
                    pathIdCounter++;
                    directPaths.push({
                        id: `dxf-lwpoly-${pathIdCounter}-${Date.now()}`,
                        points: cleaned,
                        color,
                        strokeWidth: defaultStrokeWidth,
                        tool: 'pen',
                        lineType,
                        isHandwriting: false,
                        opacity: 1.0,
                    });
                }
                break;
            }

            case 'CIRCLE': {
                let cx = 0, cy = 0, r = 0;
                for (const v of vals) {
                    if (v.code === 10) cx = parseFloat(v.value);
                    else if (v.code === 20) cy = parseFloat(v.value);
                    else if (v.code === 40) r = parseFloat(v.value);
                }
                if (r <= 0) break;

                const circlePts: DrawingPoint[] = [];
                const steps = Math.max(24, Math.min(64, Math.round(r * scale * 1.5)));
                for (let i = 0; i <= steps; i++) {
                    const theta = (i / steps) * 2 * Math.PI;
                    const x = cx + r * Math.cos(theta);
                    const y = cy + r * Math.sin(theta);
                    circlePts.push(transformPt(x, y, tx, ty, sx, sy, rotDeg));
                }

                pathIdCounter++;
                directPaths.push({
                    id: `dxf-circle-${pathIdCounter}-${Date.now()}`,
                    points: circlePts,
                    color,
                    strokeWidth: defaultStrokeWidth,
                    tool: 'pen',
                    lineType,
                    isHandwriting: false,
                    opacity: 1.0,
                });
                break;
            }

            case 'ARC': {
                let cx = 0, cy = 0, r = 0, startAngle = 0, endAngle = 360;
                for (const v of vals) {
                    if (v.code === 10) cx = parseFloat(v.value);
                    else if (v.code === 20) cy = parseFloat(v.value);
                    else if (v.code === 40) r = parseFloat(v.value);
                    else if (v.code === 50) startAngle = parseFloat(v.value);
                    else if (v.code === 51) endAngle = parseFloat(v.value);
                }
                if (r <= 0) break;

                let sweep = endAngle - startAngle;
                if (sweep <= 0) sweep += 360;

                const steps = Math.max(8, Math.min(64, Math.ceil((sweep / 360) * 48)));
                const arcPts: DrawingPoint[] = [];

                for (let i = 0; i <= steps; i++) {
                    const angleDeg = startAngle + (i / steps) * sweep;
                    const rad = (angleDeg * Math.PI) / 180;
                    const x = cx + r * Math.cos(rad);
                    const y = cy + r * Math.sin(rad);
                    arcPts.push(transformPt(x, y, tx, ty, sx, sy, rotDeg));
                }

                const cleaned = cleanVertices ? cleanAndNormalizePoints(arcPts) : arcPts;
                if (cleaned.length >= 2) {
                    pathIdCounter++;
                    directPaths.push({
                        id: `dxf-arc-${pathIdCounter}-${Date.now()}`,
                        points: cleaned,
                        color,
                        strokeWidth: defaultStrokeWidth,
                        tool: 'pen',
                        lineType,
                        isHandwriting: false,
                        opacity: 1.0,
                    });
                }
                break;
            }

            case 'ELLIPSE': {
                let cx = 0, cy = 0, mx = 1, my = 0, ratio = 1, startParam = 0, endParam = 2 * Math.PI;
                for (const v of vals) {
                    if (v.code === 10) cx = parseFloat(v.value);
                    else if (v.code === 20) cy = parseFloat(v.value);
                    else if (v.code === 11) mx = parseFloat(v.value);
                    else if (v.code === 21) my = parseFloat(v.value);
                    else if (v.code === 40) ratio = parseFloat(v.value);
                    else if (v.code === 41) startParam = parseFloat(v.value);
                    else if (v.code === 42) endParam = parseFloat(v.value);
                }

                let sweep = endParam - startParam;
                if (sweep <= 0) sweep += 2 * Math.PI;

                const majorLen = Math.hypot(mx, my);
                const majorAngle = Math.atan2(my, mx);
                const minorLen = majorLen * ratio;

                const steps = 36;
                const ellipsePts: DrawingPoint[] = [];
                for (let i = 0; i <= steps; i++) {
                    const t = startParam + (i / steps) * sweep;
                    const lx = majorLen * Math.cos(t);
                    const ly = minorLen * Math.sin(t);
                    const rx = lx * Math.cos(majorAngle) - ly * Math.sin(majorAngle);
                    const ry = lx * Math.sin(majorAngle) + ly * Math.cos(majorAngle);
                    ellipsePts.push(transformPt(cx + rx, cy + ry, tx, ty, sx, sy, rotDeg));
                }

                pathIdCounter++;
                directPaths.push({
                    id: `dxf-ellipse-${pathIdCounter}-${Date.now()}`,
                    points: ellipsePts,
                    color,
                    strokeWidth: defaultStrokeWidth,
                    tool: 'pen',
                    lineType,
                    isHandwriting: false,
                    opacity: 1.0,
                });
                break;
            }

            case 'SOLID':
            case '3DFACE': {
                const pts: { x: number; y: number }[] = [];
                for (const v of vals) {
                    if (v.code === 10) pts[0] = { x: parseFloat(v.value), y: pts[0]?.y || 0 };
                    else if (v.code === 20) pts[0] = { x: pts[0]?.x || 0, y: parseFloat(v.value) };
                    else if (v.code === 11) pts[1] = { x: parseFloat(v.value), y: pts[1]?.y || 0 };
                    else if (v.code === 21) pts[1] = { x: pts[1]?.x || 0, y: parseFloat(v.value) };
                    else if (v.code === 12) pts[2] = { x: parseFloat(v.value), y: pts[2]?.y || 0 };
                    else if (v.code === 22) pts[2] = { x: pts[2]?.x || 0, y: parseFloat(v.value) };
                    else if (v.code === 13) pts[3] = { x: parseFloat(v.value), y: pts[3]?.y || 0 };
                    else if (v.code === 23) pts[3] = { x: pts[3]?.x || 0, y: parseFloat(v.value) };
                }

                if (pts.length >= 3 && pts[0] && pts[1] && pts[2]) {
                    const polygonPts: DrawingPoint[] = [
                        transformPt(pts[0].x, pts[0].y, tx, ty, sx, sy, rotDeg),
                        transformPt(pts[1].x, pts[1].y, tx, ty, sx, sy, rotDeg),
                        transformPt(pts[2].x, pts[2].y, tx, ty, sx, sy, rotDeg),
                    ];
                    if (pts[3] && (pts[3].x !== pts[2].x || pts[3].y !== pts[2].y)) {
                        polygonPts.push(transformPt(pts[3].x, pts[3].y, tx, ty, sx, sy, rotDeg));
                    }
                    polygonPts.push({ ...polygonPts[0] });

                    pathIdCounter++;
                    directPaths.push({
                        id: `dxf-solid-${pathIdCounter}-${Date.now()}`,
                        points: polygonPts,
                        color,
                        strokeWidth: defaultStrokeWidth,
                        tool: 'pen',
                        lineType: 'solid',
                        fill: color,
                        fillOpacity: 0.25,
                        isHandwriting: false,
                        opacity: 1.0,
                    });
                }
                break;
            }

            case 'TEXT':
            case 'MTEXT': {
                if (!importText) break;

                let textStr = '';
                let px = 0, py = 0, h = 2.5, textRot = 0;
                for (const v of vals) {
                    if (v.code === 1) {
                        textStr = (textStr ? textStr + v.value : v.value);
                    } else if (v.code === 3) {
                        // Additional MTEXT string chunk (DXF code 3 lines precede code 1)
                        textStr = v.value + textStr;
                    } else if (v.code === 10) px = parseFloat(v.value);
                    else if (v.code === 20) py = parseFloat(v.value);
                    else if (v.code === 40) h = parseFloat(v.value);
                    else if (v.code === 50) textRot = parseFloat(v.value);
                }
                // Strip MTEXT formatting codes like \A1; \P \H250; \C1; \f...; etc.
                textStr = textStr
                    .replace(/\\P/g, '\n')
                    .replace(/\\[A-Za-z0-9~]+;/g, '')
                    .replace(/\\f[^;]+;/g, '')
                    .replace(/[{}]/g, '')
                    .trim();

                if (textStr) {
                    // Position transformed by block translation and rotation (rotDeg)
                    // (NOTE: textRot is the text's own orientation, not the insertion point rotation around (0,0))
                    const transformedPos = transformPt(px, py, tx, ty, sx, sy, rotDeg);

                    // Smart architectural font size calculation:
                    // In 1/100 architectural drawings:
                    // - Standard module (910mm) is 9.1mm on canvas
                    // - Room names / general notes: 2.0mm ~ 2.4mm
                    // - Sub-notes / dimension values: 1.6mm ~ 1.8mm
                    // - Large headings / sheet titles: 2.8mm ~ 3.2mm
                    let finalFontSize = 2.2;
                    if (textSizeMode === 'fixed') {
                        finalFontSize = Math.max(0.8, fixedTextSize || 2.2);
                    } else if (textSizeMode === 'cad') {
                        const rawScaled = Math.abs(h * scale);
                        finalFontSize = Math.max(0.8, Math.min(10.0, rawScaled || 2.2));
                    } else {
                        // 'auto' mode: Smart architectural normalization
                        if (h > 10) {
                            // Model-space CAD units in mm (e.g. 150, 200, 250, 300, 350, 500, 1000)
                            const scaledH = Math.abs(h * scale);
                            if (scaledH >= 1.0 && scaledH <= 3.2) {
                                finalFontSize = Math.round(scaledH * 10) / 10;
                            } else if (scaledH > 3.2) {
                                // Clamp oversized CAD headers so they don't dominate the room
                                finalFontSize = Math.min(3.2, 2.2 + (scaledH - 3.2) * 0.1);
                            } else {
                                finalFontSize = Math.max(1.6, scaledH);
                            }
                        } else if (h >= 0.5 && h <= 10) {
                            // Paper-space mm units (e.g. 2.0, 2.5, 3.0 in Jw_cad)
                            finalFontSize = Math.min(3.2, Math.max(1.6, h));
                        } else {
                            finalFontSize = 2.2;
                        }
                    }

                    // Estimate text bounding box polygon for selection, hover, and layout
                    const estCharWidth = finalFontSize * 0.7;
                    const estTotalWidth = Math.max(finalFontSize, textStr.length * estCharWidth);
                    let textPolygon: DrawingPoint[] = [
                        { x: transformedPos.x, y: transformedPos.y },
                        { x: transformedPos.x + estTotalWidth, y: transformedPos.y },
                        { x: transformedPos.x + estTotalWidth, y: transformedPos.y + finalFontSize },
                        { x: transformedPos.x, y: transformedPos.y + finalFontSize },
                    ];

                    const totalTextAngle = rotDeg + textRot;
                    if (totalTextAngle !== 0) {
                        const rad = ((invertY ? -totalTextAngle : totalTextAngle) * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        textPolygon = textPolygon.map(pt => {
                            const dx = pt.x - transformedPos.x;
                            const dy = pt.y - transformedPos.y;
                            return {
                                x: transformedPos.x + (dx * cos - dy * sin),
                                y: transformedPos.y + (dx * sin + dy * cos),
                            };
                        });
                    }

                    pathIdCounter++;
                    directPaths.push({
                        id: `dxf-text-${pathIdCounter}-${Date.now()}`,
                        points: textPolygon,
                        color,
                        strokeWidth: defaultStrokeWidth,
                        tool: 'pen',
                        lineType: 'solid',
                        text: textStr,
                        fontSize: finalFontSize,
                        isHandwriting: false,
                        opacity: 1.0,
                    });
                }
                break;
            }

            case 'INSERT': {
                let blockName = '';
                let ix = 0, iy = 0, isx = 1, isy = 1, irot = 0;
                for (const v of vals) {
                    if (v.code === 2) blockName = v.value;
                    else if (v.code === 10) ix = parseFloat(v.value);
                    else if (v.code === 20) iy = parseFloat(v.value);
                    else if (v.code === 41) isx = parseFloat(v.value);
                    else if (v.code === 42) isy = parseFloat(v.value);
                    else if (v.code === 50) irot = parseFloat(v.value);
                }

                if (blockName && blocks[blockName.toLowerCase()]) {
                    const blk = blocks[blockName.toLowerCase()];
                    // Relative coordinates inside block
                    for (const bent of blk.entities) {
                        processEntity(
                            bent,
                            tx + ix - blk.basePoint.x,
                            ty + iy - blk.basePoint.y,
                            sx * isx,
                            sy * isy,
                            rotDeg + irot,
                            depth + 1
                        );
                    }
                }
                break;
            }

            default:
                break;
        }
    };

    // Process all root model space entities
    for (const ent of rootEntities) {
        processEntity(ent);
    }

    // Smart Line Chaining: Group connected LINEs into polylines to form seamless boundaries & corners
    const chainedPaths: DrawingPath[] = [];

    if (chainLines && isolatedLines.length > 0) {
        // Group lines by layer and color
        const lineGroups = new Map<string, LineSegment[]>();
        for (const line of isolatedLines) {
            const key = `${line.layer}__${line.color}__${line.lineType}`;
            if (!lineGroups.has(key)) lineGroups.set(key, []);
            lineGroups.get(key)!.push(line);
        }

        for (const [, group] of lineGroups) {
            const remaining = [...group];

            while (remaining.length > 0) {
                const first = remaining.shift()!;
                const polyPoints: DrawingPoint[] = [first.start, first.end];
                let changed = true;

                while (changed && remaining.length > 0) {
                    changed = false;
                    const tail = polyPoints[polyPoints.length - 1];
                    const head = polyPoints[0];

                    for (let i = 0; i < remaining.length; i++) {
                        const seg = remaining[i];

                        // Check tail matches seg.start
                        if (Math.hypot(tail.x - seg.start.x, tail.y - seg.start.y) <= chainTolerance) {
                            polyPoints.push(seg.end);
                            remaining.splice(i, 1);
                            changed = true;
                            break;
                        }
                        // Check tail matches seg.end
                        if (Math.hypot(tail.x - seg.end.x, tail.y - seg.end.y) <= chainTolerance) {
                            polyPoints.push(seg.start);
                            remaining.splice(i, 1);
                            changed = true;
                            break;
                        }
                        // Check head matches seg.end
                        if (Math.hypot(head.x - seg.end.x, head.y - seg.end.y) <= chainTolerance) {
                            polyPoints.unshift(seg.start);
                            remaining.splice(i, 1);
                            changed = true;
                            break;
                        }
                        // Check head matches seg.start
                        if (Math.hypot(head.x - seg.start.x, head.y - seg.start.y) <= chainTolerance) {
                            polyPoints.unshift(seg.end);
                            remaining.splice(i, 1);
                            changed = true;
                            break;
                        }
                    }
                }

                // Check if loop is closed
                const isClosed =
                    polyPoints.length >= 3 &&
                    Math.hypot(
                        polyPoints[0].x - polyPoints[polyPoints.length - 1].x,
                        polyPoints[0].y - polyPoints[polyPoints.length - 1].y
                    ) <= chainTolerance;

                const finalPoints = cleanVertices
                    ? cleanAndNormalizePoints(polyPoints, { isClosed })
                    : polyPoints;

                if (finalPoints.length >= 2) {
                    pathIdCounter++;
                    chainedPaths.push({
                        id: `dxf-linechain-${pathIdCounter}-${Date.now()}`,
                        points: finalPoints,
                        color: first.color,
                        strokeWidth: first.strokeWidth,
                        tool: 'pen',
                        lineType: first.lineType,
                        isHandwriting: false,
                        opacity: 1.0,
                    });
                }
            }
        }
    } else {
        // No line chaining: each line is an individual 2-point path
        for (const line of isolatedLines) {
            pathIdCounter++;
            chainedPaths.push({
                id: `dxf-line-${pathIdCounter}-${Date.now()}`,
                points: [line.start, line.end],
                color: line.color,
                strokeWidth: line.strokeWidth,
                tool: 'pen',
                lineType: line.lineType,
                isHandwriting: false,
                opacity: 1.0,
            });
        }
    }

    const allPaths = [...directPaths, ...chainedPaths];

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of allPaths) {
        for (const pt of p.points) {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
        }
    }

    const bounds =
        allPaths.length === 0 || !isFinite(minX)
            ? { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
            : { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };

    const layersList: DxfLayerInfo[] = Object.keys(layerStats).map(layerName => ({
        name: layerName,
        color: layerStats[layerName].color,
        entityCount: layerStats[layerName].count,
    }));

    const textTotal = (entityCounts['TEXT'] || 0) + (entityCounts['MTEXT'] || 0);

    return {
        paths: allPaths,
        bounds,
        layers: layersList,
        entityCounts,
        insUnits,
        textCount: textTotal,
    };
}

/**
 * Calculates arc points for an LWPOLYLINE segment with bulge
 */
function generateBulgeArcPoints(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    bulge: number,
    transformer: (x: number, y: number) => DrawingPoint
): DrawingPoint[] {
    const chordDx = x2 - x1;
    const chordDy = y2 - y1;
    const chordLen = Math.hypot(chordDx, chordDy);
    if (chordLen < 1e-6) return [transformer(x2, y2)];

    // Included angle theta = 4 * atan(bulge)
    const theta = 4 * Math.atan(bulge);
    const radius = chordLen / (2 * Math.sin(Math.abs(theta) / 2));

    // Midpoint of chord
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    // Perpendicular vector
    // Distance from chord to arc center
    const sagitta = (chordLen / 2) * Math.tan(Math.abs(theta) / 4);
    const dCenter = radius - sagitta;

    const perpX = (-chordDy / chordLen) * Math.sign(bulge);
    const perpY = (chordDx / chordLen) * Math.sign(bulge);

    const cx = mx + perpX * dCenter;
    const cy = my + perpY * dCenter;

    const startAngle = Math.atan2(y1 - cy, x1 - cx);
    let sweep = theta;

    const numSegments = Math.max(4, Math.min(32, Math.ceil((Math.abs(sweep) / (2 * Math.PI)) * 24)));
    const pts: DrawingPoint[] = [];

    for (let i = 1; i <= numSegments; i++) {
        const curA = startAngle + (i / numSegments) * sweep;
        const px = cx + radius * Math.cos(curA);
        const py = cy + radius * Math.sin(curA);
        pts.push(transformer(px, py));
    }

    return pts;
}

/**
 * Parses a DXF file as a RegisteredPart (centered around origin, suitable for part library)
 */
export function parsePartFromDxfString(
    dxfContent: string,
    fileName: string = 'Imported DXF',
    options?: { importText?: boolean }
): RegisteredPart | null {
    if (!dxfContent) return null;

    const importText = options?.importText ?? false;

    // First do a pass with scale=1 to measure raw dimensions
    const initialResult = parseDxf(dxfContent, {
        scale: 1.0,
        invertY: true,
        chainLines: true,
        cleanVertices: true,
        importText,
    });

    if (initialResult.paths.length === 0) return null;

    // Detect CAD scale:
    // If width or height exceeds 300 (e.g. 15,000 x 20,000 mm for a 敷地, or 900 x 900 mm for furniture in CAD mm),
    // scale by 0.01 to match the drafting canvas (1:100 scale, where 9.0 = 900mm module).
    const maxDim = Math.max(initialResult.bounds.width, initialResult.bounds.height);
    let autoScale = 1.0;
    if (maxDim > 300) {
        autoScale = 0.01;
    }

    const finalResult = autoScale === 1.0
        ? initialResult
        : parseDxf(dxfContent, {
            scale: autoScale,
            invertY: true,
            chainLines: true,
            cleanVertices: true,
            importText,
        });

    const { minX, maxX, minY, maxY } = finalResult.bounds;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Center paths around (0, 0)
    const centeredPaths = finalResult.paths.map(p => ({
        ...p,
        points: p.points.map(pt => ({
            ...pt,
            x: pt.x - centerX,
            y: pt.y - centerY,
        })),
    }));

    // Clean part title from filename
    const cleanTitle = fileName
        .replace(/\.dxf$/i, '')
        .replace(/^[_\-\s]+|[_\-\s]+$/g, '') || 'Imported DXF';

    return {
        id: `part-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name: cleanTitle,
        paths: centeredPaths,
        basePoint: { x: 0, y: 0 },
        sourcePath: '',
    };
}
