import { AppState, DrawingPoint, LineType } from '../types';
import { PaperSize, PaperOrientation } from '../components/PrintLayout';
import { PAGE_DIMENSIONS } from '../constants';
import { generateFilename } from './filenameGenerator';
import { downloadBlobFile } from './imageExport';

export interface DxfExportOptions {
    size: PaperSize;
    orientation: PaperOrientation;
    includedLayers: number[];
    scaleMode?: 'real_world' | 'paper_mm'; // 'real_world' (1/100 -> 100x: 1000mm/m) or 'paper_mm' (1x)
    includeText?: boolean;
    includeFrame?: boolean;
}

/**
 * Maps HEX color to AutoCAD Color Index (ACI 1-9)
 */
function hexToAci(hex: string): number {
    if (!hex) return 7;
    const cleanHex = hex.replace('#', '').toLowerCase();
    if (cleanHex.length !== 6 && cleanHex.length !== 3) return 7;

    let r = 0, g = 0, b = 0;
    if (cleanHex.length === 3) {
        r = parseInt(cleanHex[0] + cleanHex[0], 16);
        g = parseInt(cleanHex[1] + cleanHex[1], 16);
        b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else {
        r = parseInt(cleanHex.substring(0, 2), 16);
        g = parseInt(cleanHex.substring(2, 4), 16);
        b = parseInt(cleanHex.substring(4, 6), 16);
    }

    // Check for near-black / dark slate or white
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    if (brightness < 40) return 7; // Black pen (displays as white/black in CAD)
    if (brightness > 240) return 7; // White

    // ACI Palette references:
    // 1: Red, 2: Yellow, 3: Green, 4: Cyan, 5: Blue, 6: Magenta, 7: White/Black, 8: Dark Gray, 9: Light Gray
    const aciPalette = [
        { aci: 1, r: 255, g: 0, b: 0 },
        { aci: 2, r: 255, g: 255, b: 0 },
        { aci: 3, r: 0, g: 255, b: 0 },
        { aci: 4, r: 0, g: 255, b: 255 },
        { aci: 5, r: 0, g: 0, b: 255 },
        { aci: 6, r: 255, g: 0, b: 255 },
        { aci: 7, r: 255, g: 255, b: 255 },
        { aci: 8, r: 128, g: 128, b: 128 },
        { aci: 9, r: 192, g: 192, b: 192 },
    ];

    let closestAci = 7;
    let minDist = Infinity;
    for (const p of aciPalette) {
        const dist = Math.hypot(r - p.r, g - p.g, b - p.b);
        if (dist < minDist) {
            minDist = dist;
            closestAci = p.aci;
        }
    }
    return closestAci;
}

/**
 * Maps app line type to standard DXF line type name
 */
function mapLineTypeToDxf(lineType: LineType): string {
    switch (lineType) {
        case 'dashed':
            return 'DASHED';
        case 'dotted':
            return 'DOT';
        case 'dash-dot':
        case 'dash-dot-dot':
        case 'child-bearing':
            return 'CENTER';
        case 'solid':
        default:
            return 'CONTINUOUS';
    }
}

/**
 * Sanitizes layer names for DXF standards
 */
function sanitizeLayerName(name: string): string {
    const sanitized = name.replace(/[\\/:*?"<>|`]/g, '_').trim();
    return sanitized || 'DRAWING';
}

/**
 * Generates AutoCAD R12 / 2000 compatible ASCII DXF file content
 */
export function generateDxfString(state: AppState, options: DxfExportOptions): string {
    const { width: pageWidth, height: pageHeight } = PAGE_DIMENSIONS[options.size][options.orientation];
    const scaleMultiplier = options.scaleMode === 'real_world' ? 100 : 1.0;
    const includeText = options.includeText ?? true;
    const includeFrame = options.includeFrame ?? true;

    // Filter layers
    const targetLayers = state.drawingLayers.filter(layer => {
        if (!options.includedLayers.includes(layer.id)) return false;
        if (layer.id === 1000 && !includeFrame) return false;
        return true;
    });

    // Track bounding extents
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Helper to transform point from canvas (paper mm, Y down) to CAD (scaled mm, Y up)
    const toCadPoint = (pt: DrawingPoint): { x: number; y: number } => {
        const cx = pt.x * scaleMultiplier;
        const cy = (pageHeight - pt.y) * scaleMultiplier; // Invert Y axis
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;
        return { x: cx, y: cy };
    };

    const lines: string[] = [];
    const addPair = (code: number, val: string | number) => {
        lines.push(code.toString());
        lines.push(val.toString());
    };

    // --- 1. HEADER SECTION ---
    addPair(0, 'SECTION');
    addPair(2, 'HEADER');
    addPair(9, '$ACADVER');
    addPair(1, 'AC1009'); // AutoCAD R12 ASCII (broadest compatibility across Jw_cad & AutoCAD)
    addPair(9, '$DWGCODEPAGE');
    addPair(1, 'UTF-8');
    addPair(9, '$INSUNITS');
    addPair(70, 4); // Millimeters
    addPair(9, '$MEASUREMENT');
    addPair(70, 1); // Metric

    // Temporary extents (will be finalized)
    addPair(9, '$EXTMIN');
    addPair(10, 0.0);
    addPair(20, 0.0);
    addPair(30, 0.0);
    addPair(9, '$EXTMAX');
    addPair(10, (pageWidth * scaleMultiplier).toFixed(3));
    addPair(20, (pageHeight * scaleMultiplier).toFixed(3));
    addPair(30, 0.0);
    addPair(0, 'ENDSEC');

    // --- 2. TABLES SECTION ---
    addPair(0, 'SECTION');
    addPair(2, 'TABLES');

    // LTYPE Table
    addPair(0, 'TABLE');
    addPair(2, 'LTYPE');
    addPair(70, 4);

    // Continuous
    addPair(0, 'LTYPE');
    addPair(2, 'CONTINUOUS');
    addPair(70, 0);
    addPair(3, 'Solid line');
    addPair(72, 65);
    addPair(73, 0);
    addPair(40, 0.0);

    // Dashed
    addPair(0, 'LTYPE');
    addPair(2, 'DASHED');
    addPair(70, 0);
    addPair(3, 'Dashed line __ __ __');
    addPair(72, 65);
    addPair(73, 2);
    addPair(40, (12.0 * (scaleMultiplier === 100 ? 5 : 1)).toFixed(1));
    addPair(49, (9.0 * (scaleMultiplier === 100 ? 5 : 1)).toFixed(1));
    addPair(49, (-3.0 * (scaleMultiplier === 100 ? 5 : 1)).toFixed(1));

    // Center
    addPair(0, 'LTYPE');
    addPair(2, 'CENTER');
    addPair(70, 0);
    addPair(3, 'Center line ____ _ ____');
    addPair(72, 65);
    addPair(73, 4);
    addPair(40, (20.0 * (scaleMultiplier === 100 ? 5 : 1)).toFixed(1));
    addPair(49, (12.0 * (scaleMultiplier === 100 ? 5 : 1)).toFixed(1));
    addPair(49, (-3.0 * (scaleMultiplier === 100 ? 5 : 1)).toFixed(1));
    addPair(49, (2.0 * (scaleMultiplier === 100 ? 5 : 1)).toFixed(1));
    addPair(49, (-3.0 * (scaleMultiplier === 100 ? 5 : 1)).toFixed(1));

    // Dot
    addPair(0, 'LTYPE');
    addPair(2, 'DOT');
    addPair(70, 0);
    addPair(3, 'Dot line . . . . .');
    addPair(72, 65);
    addPair(73, 2);
    addPair(40, (4.0 * (scaleMultiplier === 100 ? 5 : 1)).toFixed(1));
    addPair(49, 0.0);
    addPair(49, (-4.0 * (scaleMultiplier === 100 ? 5 : 1)).toFixed(1));

    addPair(0, 'ENDTAB');

    // LAYER Table
    addPair(0, 'TABLE');
    addPair(2, 'LAYER');
    addPair(70, targetLayers.length + 1);

    // Layer 0
    addPair(0, 'LAYER');
    addPair(2, '0');
    addPair(70, 0);
    addPair(62, 7);
    addPair(6, 'CONTINUOUS');

    // Defined layers
    for (const layer of targetLayers) {
        const lName = sanitizeLayerName(layer.name);
        const firstPath = layer.paths[0];
        const defaultAci = firstPath ? hexToAci(firstPath.color) : 7;
        const defaultLtype = firstPath ? mapLineTypeToDxf(firstPath.lineType) : 'CONTINUOUS';

        addPair(0, 'LAYER');
        addPair(2, lName);
        addPair(70, 0);
        addPair(62, defaultAci);
        addPair(6, defaultLtype);
    }
    addPair(0, 'ENDTAB');
    addPair(0, 'ENDSEC');

    // --- 3. BLOCKS SECTION ---
    addPair(0, 'SECTION');
    addPair(2, 'BLOCKS');
    addPair(0, 'ENDSEC');

    // --- 4. ENTITIES SECTION ---
    addPair(0, 'SECTION');
    addPair(2, 'ENTITIES');

    for (const layer of targetLayers) {
        const lName = sanitizeLayerName(layer.name);

        for (const path of layer.paths) {
            const aci = hexToAci(path.color);
            const ltype = mapLineTypeToDxf(path.lineType);

            // Text Entities
            if (path.text) {
                if (!includeText) continue;
                const minPtX = Math.min(...path.points.map(p => p.x));
                const minPtY = Math.min(...path.points.map(p => p.y));
                const fs = path.fontSize || 1.8;
                const textHeight = fs * scaleMultiplier;
                const lines = path.text.split('\n');

                lines.forEach((lineText, lineIdx) => {
                    const linePosY = minPtY + fs + (lineIdx * fs * 1.25);
                    const cadPos = toCadPoint({ x: minPtX, y: linePosY });

                    addPair(0, 'TEXT');
                    addPair(8, lName);
                    addPair(62, aci);
                    addPair(10, cadPos.x.toFixed(3));
                    addPair(20, cadPos.y.toFixed(3));
                    addPair(30, 0.0);
                    addPair(40, textHeight.toFixed(3));
                    addPair(1, lineText);
                    addPair(50, 0.0); // 0 degree orientation
                    addPair(7, 'STANDARD');
                });
                continue;
            }

            // Vector Geometry Entities
            const pts = path.points;
            if (!pts || pts.length < 2) continue;

            if (pts.length === 2) {
                // Single line
                const p1 = toCadPoint(pts[0]);
                const p2 = toCadPoint(pts[1]);

                addPair(0, 'LINE');
                addPair(8, lName);
                addPair(62, aci);
                addPair(6, ltype);
                addPair(10, p1.x.toFixed(3));
                addPair(20, p1.y.toFixed(3));
                addPair(30, 0.0);
                addPair(11, p2.x.toFixed(3));
                addPair(21, p2.y.toFixed(3));
                addPair(31, 0.0);
            } else {
                // Polyline / Multi-segment lines
                const isClosed = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.25;
                const exportPoints = isClosed ? pts.slice(0, pts.length - 1) : pts;

                // Output standard LWPOLYLINE
                addPair(0, 'LWPOLYLINE');
                addPair(8, lName);
                addPair(62, aci);
                addPair(6, ltype);
                addPair(90, exportPoints.length);
                addPair(70, isClosed ? 1 : 0); // 1 = closed, 0 = open

                for (const pt of exportPoints) {
                    const cadPt = toCadPoint(pt);
                    addPair(10, cadPt.x.toFixed(3));
                    addPair(20, cadPt.y.toFixed(3));
                }

                // If path has solid fill, also emit SOLID for 3 or 4-corner polygons
                if (path.fill && (exportPoints.length === 3 || exportPoints.length === 4)) {
                    const fillAci = hexToAci(path.fill);
                    const p1 = toCadPoint(exportPoints[0]);
                    const p2 = toCadPoint(exportPoints[1]);
                    const p3 = toCadPoint(exportPoints[2]);
                    const p4 = exportPoints.length === 4 ? toCadPoint(exportPoints[3]) : p3;

                    addPair(0, 'SOLID');
                    addPair(8, lName);
                    addPair(62, fillAci);
                    addPair(10, p1.x.toFixed(3));
                    addPair(20, p1.y.toFixed(3));
                    addPair(30, 0.0);
                    addPair(11, p2.x.toFixed(3));
                    addPair(21, p2.y.toFixed(3));
                    addPair(31, 0.0);
                    // In DXF SOLID, points are entered in clockwise or figure-8 order
                    addPair(12, p4.x.toFixed(3));
                    addPair(22, p4.y.toFixed(3));
                    addPair(32, 0.0);
                    addPair(13, p3.x.toFixed(3));
                    addPair(23, p3.y.toFixed(3));
                    addPair(33, 0.0);
                }
            }
        }
    }

    addPair(0, 'ENDSEC');

    // --- 5. EOF ---
    addPair(0, 'EOF');

    return lines.join('\r\n') + '\r\n';
}

/**
 * High-level export function to trigger DXF file download
 */
export const exportDxf = async (state: AppState, options: DxfExportOptions): Promise<void> => {
    try {
        const dxfString = generateDxfString(state, options);
        const blob = new Blob([dxfString], { type: 'application/dxf;charset=utf-8' });
        const filename = generateFilename(state, 'dxf', options);
        downloadBlobFile(blob, filename);
    } catch (err: any) {
        console.error('DXF export failed:', err);
        alert(`DXFファイルの書き出しに失敗しました: ${err.message || err}`);
    }
};
