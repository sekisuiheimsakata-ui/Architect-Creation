

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, RegisteredPart, DrawingPath, DrawingPoint } from '../types';
import { PdfLayout } from '../components/PdfLayout';
import { PaperSize, PaperOrientation } from '../components/PrintLayout';
import { generateFilename } from './filenameGenerator';
import { PAGE_DIMENSIONS } from '../constants';
import { pointsToSvgPath, getPathAsPoints } from './layoutCalculator';
import { cleanAndNormalizePoints } from './geometry';

export const exportSvg = async (state: AppState, options: { size: PaperSize; orientation: PaperOrientation; includedLayers: number[] }) => {
    try {
        const { width: pageWidth, height: pageHeight } = PAGE_DIMENSIONS[options.size][options.orientation];
        
        // Create a temporary container for rendering
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        document.body.appendChild(container);

        const cleanup = () => {
             if (container.parentNode) container.parentNode.removeChild(container);
        };

        const svgElement = await new Promise<SVGSVGElement>((resolve, reject) => {
             const root = createRoot(container);
             
             const onReady = (svg: SVGSVGElement | null) => {
                 // Schedule unmount and cleanup after getting the SVG
                 setTimeout(() => {
                     root.unmount();
                     cleanup();
                 }, 0);
                 
                 if (svg) resolve(svg);
                 else reject(new Error("Failed to generate SVG"));
             };

             // Filter state for included layers
             const exportState: AppState = {
                 ...state,
                 drawingLayers: state.drawingLayers.map(l => ({
                     ...l,
                     visibility: options.includedLayers.includes(l.id)
                        ? (l.visibility === 'hidden' ? 'visible' : l.visibility)
                        : 'hidden'
                 }))
             };

             root.render(createElement(PdfLayout, { 
                 state: exportState, 
                 onReady, 
                 pageWidth, 
                 pageHeight, 
                 renderAsRootSvg: true 
             }));
        });

        // Serialize SVG to string
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svgElement);

        // Optimize source: Reduce floating point precision in path data and coordinates
        // This simple regex targets long decimals (e.g., 123.456789 -> 123.45)
        // Targets both d="" attributes and general attributes like x="1.2345"
        source = source.replace(/(\d+\.\d{2})\d+/g, '$1');

        // Ensure namespaces exist if missing
        if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        // Ensure xlink namespace if needed (for filters/hrefs)
        if(!source.match(/^<svg[^>]+xmlns:xlink/) && source.includes('xlink:href')){
            source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
        }

        // Add XML declaration
        source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

        // Convert to Blob
        const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        
        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = generateFilename(state, 'svg', options);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("SVG Export failed:", error);
        alert("SVG出力に失敗しました。");
    }
};

// Helper to generate the SVG string for a part, including metadata
export const createPartSvgString = (part: RegisteredPart): string => {
    // 1. Calculate Bounding Box including (0,0) base point
    let minX = 0, minY = 0, maxX = 0, maxY = 0;

    part.paths.forEach(path => {
        // Use visual points for bounding box calculation to be accurate
        const pointGroups = getPathAsPoints(path, true, true);
        pointGroups.forEach(points => {
            points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
        });
    });

    // Add minimal padding
    const padding = 5;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // 2. Generate SVG Content (Visuals)
    const pathElements = part.paths.flatMap(path => {
        // Fill Path (Clean geometry)
        const cleanPointsGroups = getPathAsPoints(path, false, false);
        const fillOpacity = path.fillOpacity !== undefined ? path.fillOpacity : 1.0;
        
        const fillElements = path.fill ? cleanPointsGroups.map(points => {
             const d = pointsToSvgPath(points, false);
             const optimizedD = d.replace(/(\d+\.\d{2})\d+/g, '$1');
             return `<path d="${optimizedD}" fill="${path.fill}" fill-opacity="${fillOpacity}" stroke="none" />`;
        }).join('\n') : '';

        // Stroke Path (Visual geometry)
        const pointGroups = getPathAsPoints(path, true, true);
        const strokeElements = pointGroups.map(points => {
            const d = pointsToSvgPath(points, false);
            // Simplify path string decimals
            const optimizedD = d.replace(/(\d+\.\d{2})\d+/g, '$1');
            const strokeOpacity = path.opacity !== undefined ? path.opacity : 1.0;
            
            return `<path d="${optimizedD}" fill="none" stroke="${path.color}" stroke-width="${path.strokeWidth}" stroke-opacity="${strokeOpacity}" stroke-linecap="${path.tool === 'marker' ? 'square' : 'round'}" stroke-linejoin="round" />`;
        }).join('\n');
        
        return [fillElements, strokeElements].filter(Boolean).join('\n');
    }).join('\n');

    // Base point marker
    const basePointMarker = `
        <g id="base-point" stroke="#ef4444" stroke-width="0.3">
            <line x1="-2" y1="0" x2="2" y2="0" />
            <line x1="0" y1="-2" x2="0" y2="2" />
            <circle cx="0" cy="0" r="1" fill="none" />
        </g>
    `;

    // 3. Generate Metadata
    const metaDataString = JSON.stringify(part);

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width.toFixed(2)}mm" height="${height.toFixed(2)}mm" viewBox="${minX.toFixed(2)} ${minY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}" xmlns="http://www.w3.org/2000/svg">
    <desc>Part: ${part.name}</desc>
    <metadata id="app-data">
        <![CDATA[${metaDataString}]]>
    </metadata>
    <!-- Base Point Marker at (0,0) -->
    ${basePointMarker}
    <!-- Part Paths -->
    <g id="part-paths">
        ${pathElements}
    </g>
</svg>`;
};

interface Matrix2D {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
}

const IDENTITY_MATRIX: Matrix2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function multiplyMatrices(m1: Matrix2D, m2: Matrix2D): Matrix2D {
    return {
        a: m1.a * m2.a + m1.c * m2.b,
        b: m1.b * m2.a + m1.d * m2.b,
        c: m1.a * m2.c + m1.c * m2.d,
        d: m1.b * m2.c + m1.d * m2.d,
        e: m1.a * m2.e + m1.c * m2.f + m1.e,
        f: m1.b * m2.e + m1.d * m2.f + m1.f,
    };
}

function applyMatrixToPoint(pt: DrawingPoint, m: Matrix2D): DrawingPoint {
    return {
        ...pt,
        x: m.a * pt.x + m.c * pt.y + m.e,
        y: m.b * pt.x + m.d * pt.y + m.f,
    };
}

function parseTransformString(transformStr: string): Matrix2D {
    let result = { ...IDENTITY_MATRIX };
    if (!transformStr) return result;

    const regex = /([a-zA-Z]+)\s*\(([^)]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(transformStr)) !== null) {
        const type = match[1].toLowerCase();
        const args = match[2].trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

        let currentMat: Matrix2D = { ...IDENTITY_MATRIX };
        if (type === 'matrix' && args.length >= 6) {
            currentMat = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
        } else if (type === 'translate' && args.length >= 1) {
            currentMat = { a: 1, b: 0, c: 0, d: 1, e: args[0], f: args[1] || 0 };
        } else if (type === 'scale' && args.length >= 1) {
            currentMat = { a: args[0], b: 0, c: 0, d: args[1] !== undefined ? args[1] : args[0], e: 0, f: 0 };
        } else if (type === 'rotate' && args.length >= 1) {
            const rad = (args[0] * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const cx = args[1] || 0;
            const cy = args[2] || 0;
            if (cx !== 0 || cy !== 0) {
                const t1: Matrix2D = { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy };
                const rot: Matrix2D = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
                const t2: Matrix2D = { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy };
                currentMat = multiplyMatrices(t1, multiplyMatrices(rot, t2));
            } else {
                currentMat = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
            }
        }
        result = multiplyMatrices(result, currentMat);
    }

    return result;
}

function getElementTransform(el: Element): Matrix2D {
    const matrices: Matrix2D[] = [];
    let curr: Element | null = el;
    while (curr && curr.nodeType === Node.ELEMENT_NODE) {
        const trans = curr.getAttribute('transform');
        if (trans) {
            matrices.unshift(parseTransformString(trans));
        }
        curr = curr.parentElement;
    }
    return matrices.reduce((acc, m) => multiplyMatrices(acc, m), { ...IDENTITY_MATRIX });
}

function getElementStyle(el: Element): { stroke: string; strokeWidth: number; fill?: string; fillOpacity?: number; opacity?: number } {
    let curr: Element | null = el;
    let stroke: string | null = null;
    let strokeWidth: number | null = null;
    let fill: string | null = null;
    let fillOpacity: number | null = null;
    let strokeOpacity: number | null = null;

    const parseStyleAttr = (styleStr: string | null) => {
        if (!styleStr) return;
        const parts = styleStr.split(';');
        for (const part of parts) {
            const [k, v] = part.split(':').map(s => s?.trim());
            if (!k || !v) continue;
            if (k === 'stroke' && stroke === null) stroke = v;
            if (k === 'stroke-width' && strokeWidth === null) strokeWidth = parseFloat(v);
            if (k === 'fill' && fill === null) fill = v;
            if (k === 'fill-opacity' && fillOpacity === null) fillOpacity = parseFloat(v);
            if (k === 'stroke-opacity' && strokeOpacity === null) strokeOpacity = parseFloat(v);
            if (k === 'opacity' && strokeOpacity === null) strokeOpacity = parseFloat(v);
        }
    };

    while (curr && curr.nodeType === Node.ELEMENT_NODE) {
        parseStyleAttr(curr.getAttribute('style'));
        if (stroke === null && curr.hasAttribute('stroke')) stroke = curr.getAttribute('stroke');
        if (strokeWidth === null && curr.hasAttribute('stroke-width')) strokeWidth = parseFloat(curr.getAttribute('stroke-width') || '');
        if (fill === null && curr.hasAttribute('fill')) fill = curr.getAttribute('fill');
        if (fillOpacity === null && curr.hasAttribute('fill-opacity')) fillOpacity = parseFloat(curr.getAttribute('fill-opacity') || '');
        if (strokeOpacity === null && curr.hasAttribute('stroke-opacity')) strokeOpacity = parseFloat(curr.getAttribute('stroke-opacity') || '');
        if (strokeOpacity === null && curr.hasAttribute('opacity')) strokeOpacity = parseFloat(curr.getAttribute('opacity') || '');
        curr = curr.parentElement;
    }

    const hasFill = Boolean(fill && fill !== 'none');
    const finalStroke = stroke && stroke !== 'none' ? stroke : (hasFill ? 'none' : '#404040');

    return {
        stroke: finalStroke,
        strokeWidth: isNaN(strokeWidth as number) || strokeWidth === null ? 0.7 : (strokeWidth as number),
        fill: hasFill && fill ? fill : undefined,
        fillOpacity: hasFill ? (isNaN(fillOpacity as number) || fillOpacity === null ? 1.0 : (fillOpacity as number)) : undefined,
        opacity: isNaN(strokeOpacity as number) || strokeOpacity === null ? 1.0 : (strokeOpacity as number),
    };
}

function sampleCubicBezier(
    p0: DrawingPoint,
    p1: DrawingPoint,
    p2: DrawingPoint,
    p3: DrawingPoint
): DrawingPoint[] {
    const chord = Math.hypot(p3.x - p0.x, p3.y - p0.y);
    const steps = Math.max(4, Math.min(32, Math.ceil(chord / 1.5)));
    const pts: DrawingPoint[] = [];
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const x = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
        const y = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
        pts.push({ x, y, isCurve: true });
    }
    pts.push({ x: p3.x, y: p3.y });
    return pts;
}

function sampleQuadBezier(
    p0: DrawingPoint,
    p1: DrawingPoint,
    p2: DrawingPoint
): DrawingPoint[] {
    const chord = Math.hypot(p2.x - p0.x, p2.y - p0.y);
    const steps = Math.max(4, Math.min(32, Math.ceil(chord / 1.5)));
    const pts: DrawingPoint[] = [];
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
        const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
        pts.push({ x, y, isCurve: true });
    }
    pts.push({ x: p2.x, y: p2.y });
    return pts;
}

function sampleSvgArc(
    x0: number, y0: number,
    rx: number, ry: number,
    angleDeg: number,
    largeArcFlag: number,
    sweepFlag: number,
    x1: number, y1: number
): DrawingPoint[] {
    if (rx === 0 || ry === 0 || (x0 === x1 && y0 === y1)) {
        return [{ x: x1, y: y1 }];
    }

    rx = Math.abs(rx);
    ry = Math.abs(ry);
    const phi = (angleDeg * Math.PI) / 180;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    const dx = (x0 - x1) / 2;
    const dy = (y0 - y1) / 2;
    const x1p = cosPhi * dx + sinPhi * dy;
    const y1p = -sinPhi * dx + cosPhi * dy;

    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) {
        const sqrtLambda = Math.sqrt(lambda);
        rx *= sqrtLambda;
        ry *= sqrtLambda;
    }

    const sign = largeArcFlag === sweepFlag ? -1 : 1;
    const num = (rx * rx * (ry * ry)) - (rx * rx * (y1p * y1p)) - (ry * ry * (x1p * x1p));
    const den = (rx * rx * (y1p * y1p)) + (ry * ry * (x1p * x1p));
    const sq = Math.max(0, num / (den || 1));
    const coef = sign * Math.sqrt(sq);
    const cxp = coef * ((rx * y1p) / ry);
    const cyp = coef * (-(ry * x1p) / rx);

    const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x1) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y1) / 2;

    const angleBetween = (ux: number, uy: number, vx: number, vy: number) => {
        const dot = ux * vx + uy * vy;
        const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
        let ang = Math.acos(Math.max(-1, Math.min(1, dot / (len || 1))));
        if (ux * vy - uy * vx < 0) ang = -ang;
        return ang;
    };

    let startAngle = angleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let deltaAngle = angleBetween((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);

    if (sweepFlag === 0 && deltaAngle > 0) {
        deltaAngle -= 2 * Math.PI;
    } else if (sweepFlag === 1 && deltaAngle < 0) {
        deltaAngle += 2 * Math.PI;
    }

    const segments = Math.max(4, Math.min(32, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 8))));
    const arcPoints: DrawingPoint[] = [];

    for (let i = 1; i < segments; i++) {
        const theta = startAngle + (deltaAngle * i) / segments;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const px = cosPhi * rx * cosT - sinPhi * ry * sinT + cx;
        const py = sinPhi * rx * cosT + cosPhi * ry * sinT + cy;
        arcPoints.push({ x: px, y: py, isCurve: true });
    }
    arcPoints.push({ x: x1, y: y1 });
    return arcPoints;
}

function parseSvgPathD(d: string): { points: DrawingPoint[]; isClosed: boolean }[] {
    const subpaths: { points: DrawingPoint[]; isClosed: boolean }[] = [];
    if (!d) return subpaths;

    const TOKEN_REGEX = /([mMzZlLhHvVcCwWsSqQtTaA])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/g;
    const tokens: { type: 'cmd' | 'num'; val: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = TOKEN_REGEX.exec(d)) !== null) {
        if (match[1]) {
            tokens.push({ type: 'cmd', val: match[1] });
        } else if (match[2]) {
            tokens.push({ type: 'num', val: match[2] });
        }
    }

    let ptr = 0;
    let currCmd = '';
    let cx = 0, cy = 0;
    let substartX = 0, substartY = 0;
    let lastControlPoint: DrawingPoint | null = null;
    let currentPoints: DrawingPoint[] = [];

    const flushCurrent = (isClosed: boolean) => {
        if (currentPoints.length > 0) {
            subpaths.push({ points: currentPoints, isClosed });
            currentPoints = [];
        }
    };

    while (ptr < tokens.length) {
        const tok = tokens[ptr];
        if (tok.type === 'cmd') {
            currCmd = tok.val;
            ptr++;
        }

        if (!currCmd) break;

        const isRel = currCmd === currCmd.toLowerCase();
        const cmdUpper = currCmd.toUpperCase();

        if (cmdUpper === 'M') {
            flushCurrent(false);
            if (ptr + 1 < tokens.length && tokens[ptr].type === 'num' && tokens[ptr + 1].type === 'num') {
                const x = parseFloat(tokens[ptr].val);
                const y = parseFloat(tokens[ptr + 1].val);
                ptr += 2;
                cx = isRel ? cx + x : x;
                cy = isRel ? cy + y : y;
                substartX = cx;
                substartY = cy;
                currentPoints.push({ x: cx, y: cy });
                lastControlPoint = null;
                currCmd = isRel ? 'l' : 'L';
            } else {
                break;
            }
        } else if (cmdUpper === 'L') {
            if (ptr + 1 < tokens.length && tokens[ptr].type === 'num' && tokens[ptr + 1].type === 'num') {
                const x = parseFloat(tokens[ptr].val);
                const y = parseFloat(tokens[ptr + 1].val);
                ptr += 2;
                cx = isRel ? cx + x : x;
                cy = isRel ? cy + y : y;
                currentPoints.push({ x: cx, y: cy });
                lastControlPoint = null;
            } else {
                break;
            }
        } else if (cmdUpper === 'H') {
            if (ptr < tokens.length && tokens[ptr].type === 'num') {
                const x = parseFloat(tokens[ptr].val);
                ptr++;
                cx = isRel ? cx + x : x;
                currentPoints.push({ x: cx, y: cy });
                lastControlPoint = null;
            } else {
                break;
            }
        } else if (cmdUpper === 'V') {
            if (ptr < tokens.length && tokens[ptr].type === 'num') {
                const y = parseFloat(tokens[ptr].val);
                ptr++;
                cy = isRel ? cy + y : y;
                currentPoints.push({ x: cx, y: cy });
                lastControlPoint = null;
            } else {
                break;
            }
        } else if (cmdUpper === 'Z') {
            if (currentPoints.length > 0) {
                currentPoints.push({ x: substartX, y: substartY });
                cx = substartX;
                cy = substartY;
                lastControlPoint = null;
                flushCurrent(true);
            }
            currCmd = '';
        } else if (cmdUpper === 'C') {
            if (ptr + 5 < tokens.length && tokens.slice(ptr, ptr + 6).every(t => t.type === 'num')) {
                const x1 = parseFloat(tokens[ptr].val);
                const y1 = parseFloat(tokens[ptr + 1].val);
                const x2 = parseFloat(tokens[ptr + 2].val);
                const y2 = parseFloat(tokens[ptr + 3].val);
                const x = parseFloat(tokens[ptr + 4].val);
                const y = parseFloat(tokens[ptr + 5].val);
                ptr += 6;

                const cp1 = { x: isRel ? cx + x1 : x1, y: isRel ? cy + y1 : y1 };
                const cp2 = { x: isRel ? cx + x2 : x2, y: isRel ? cy + y2 : y2 };
                const end = { x: isRel ? cx + x : x, y: isRel ? cy + y : y };

                const curvePts = sampleCubicBezier({ x: cx, y: cy }, cp1, cp2, end);
                currentPoints.push(...curvePts);
                cx = end.x;
                cy = end.y;
                lastControlPoint = cp2;
            } else {
                break;
            }
        } else if (cmdUpper === 'S') {
            if (ptr + 3 < tokens.length && tokens.slice(ptr, ptr + 4).every(t => t.type === 'num')) {
                const x2 = parseFloat(tokens[ptr].val);
                const y2 = parseFloat(tokens[ptr + 1].val);
                const x = parseFloat(tokens[ptr + 2].val);
                const y = parseFloat(tokens[ptr + 3].val);
                ptr += 4;

                const cp1 = lastControlPoint ? { x: 2 * cx - lastControlPoint.x, y: 2 * cy - lastControlPoint.y } : { x: cx, y: cy };
                const cp2 = { x: isRel ? cx + x2 : x2, y: isRel ? cy + y2 : y2 };
                const end = { x: isRel ? cx + x : x, y: isRel ? cy + y : y };

                const curvePts = sampleCubicBezier({ x: cx, y: cy }, cp1, cp2, end);
                currentPoints.push(...curvePts);
                cx = end.x;
                cy = end.y;
                lastControlPoint = cp2;
            } else {
                break;
            }
        } else if (cmdUpper === 'Q') {
            if (ptr + 3 < tokens.length && tokens.slice(ptr, ptr + 4).every(t => t.type === 'num')) {
                const x1 = parseFloat(tokens[ptr].val);
                const y1 = parseFloat(tokens[ptr + 1].val);
                const x = parseFloat(tokens[ptr + 2].val);
                const y = parseFloat(tokens[ptr + 3].val);
                ptr += 4;

                const cp = { x: isRel ? cx + x1 : x1, y: isRel ? cy + y1 : y1 };
                const end = { x: isRel ? cx + x : x, y: isRel ? cy + y : y };

                const curvePts = sampleQuadBezier({ x: cx, y: cy }, cp, end);
                currentPoints.push(...curvePts);
                cx = end.x;
                cy = end.y;
                lastControlPoint = cp;
            } else {
                break;
            }
        } else if (cmdUpper === 'T') {
            if (ptr + 1 < tokens.length && tokens.slice(ptr, ptr + 2).every(t => t.type === 'num')) {
                const x = parseFloat(tokens[ptr].val);
                const y = parseFloat(tokens[ptr + 1].val);
                ptr += 2;

                const cp: DrawingPoint = lastControlPoint ? { x: 2 * cx - lastControlPoint.x, y: 2 * cy - lastControlPoint.y } : { x: cx, y: cy };
                const end = { x: isRel ? cx + x : x, y: isRel ? cy + y : y };

                const curvePts = sampleQuadBezier({ x: cx, y: cy }, cp, end);
                currentPoints.push(...curvePts);
                cx = end.x;
                cy = end.y;
                lastControlPoint = cp;
            } else {
                break;
            }
        } else if (cmdUpper === 'A') {
            if (ptr + 6 < tokens.length && tokens.slice(ptr, ptr + 7).every(t => t.type === 'num')) {
                const rx = parseFloat(tokens[ptr].val);
                const ry = parseFloat(tokens[ptr + 1].val);
                const angle = parseFloat(tokens[ptr + 2].val);
                const largeArc = parseFloat(tokens[ptr + 3].val);
                const sweep = parseFloat(tokens[ptr + 4].val);
                const x = parseFloat(tokens[ptr + 5].val);
                const y = parseFloat(tokens[ptr + 6].val);
                ptr += 7;

                const end = { x: isRel ? cx + x : x, y: isRel ? cy + y : y };
                const arcPts = sampleSvgArc(cx, cy, rx, ry, angle, largeArc, sweep, end.x, end.y);
                currentPoints.push(...arcPts);
                cx = end.x;
                cy = end.y;
                lastControlPoint = null;
            } else {
                break;
            }
        } else {
            ptr++;
        }
    }

    flushCurrent(false);
    return subpaths;
}

// Parse standard SVG without app metadata
export const parseStandardSvgDrawing = (doc: Document): SvgDrawingResult | null => {
    const allElements = Array.from(doc.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon'));
    // Ignore internal defs / clipPaths
    const elements = allElements.filter(el => !el.closest('defs, clipPath, mask, pattern'));
    if (elements.length === 0) return null;

    const paths: DrawingPath[] = [];
    let pathCounter = 0;

    elements.forEach((el) => {
        const tagName = el.tagName.toLowerCase();
        const matrix = getElementTransform(el);
        const style = getElementStyle(el);

        const subpaths: { points: DrawingPoint[]; isClosed: boolean }[] = [];

        if (tagName === 'path') {
            const d = el.getAttribute('d');
            if (d) {
                subpaths.push(...parseSvgPathD(d));
            }
        } else if (tagName === 'rect') {
            const x = parseFloat(el.getAttribute('x') || '0');
            const y = parseFloat(el.getAttribute('y') || '0');
            const w = parseFloat(el.getAttribute('width') || '0');
            const h = parseFloat(el.getAttribute('height') || '0');
            if (w > 0 && h > 0) {
                const rectPoints: DrawingPoint[] = [
                    { x, y },
                    { x: x + w, y },
                    { x: x + w, y: y + h },
                    { x, y: y + h },
                    { x, y }
                ];
                subpaths.push({ points: rectPoints, isClosed: true });
            }
        } else if (tagName === 'line') {
            const x1 = parseFloat(el.getAttribute('x1') || '0');
            const y1 = parseFloat(el.getAttribute('y1') || '0');
            const x2 = parseFloat(el.getAttribute('x2') || '0');
            const y2 = parseFloat(el.getAttribute('y2') || '0');
            subpaths.push({ points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], isClosed: false });
        } else if (tagName === 'polyline' || tagName === 'polygon') {
            const pointsAttr = el.getAttribute('points') || '';
            const nums = pointsAttr.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            const pts: DrawingPoint[] = [];
            for (let i = 0; i + 1 < nums.length; i += 2) {
                pts.push({ x: nums[i], y: nums[i + 1] });
            }
            if (pts.length >= 2) {
                const isPolygon = tagName === 'polygon';
                if (isPolygon) {
                    pts.push({ ...pts[0] });
                }
                subpaths.push({ points: pts, isClosed: isPolygon });
            }
        } else if (tagName === 'circle') {
            const cx = parseFloat(el.getAttribute('cx') || '0');
            const cy = parseFloat(el.getAttribute('cy') || '0');
            const r = parseFloat(el.getAttribute('r') || '0');
            if (r > 0) {
                const segments = 36;
                const circlePoints: DrawingPoint[] = [];
                for (let i = 0; i <= segments; i++) {
                    const ang = (2 * Math.PI * i) / segments;
                    circlePoints.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
                }
                subpaths.push({ points: circlePoints, isClosed: true });
            }
        } else if (tagName === 'ellipse') {
            const cx = parseFloat(el.getAttribute('cx') || '0');
            const cy = parseFloat(el.getAttribute('cy') || '0');
            const rx = parseFloat(el.getAttribute('rx') || '0');
            const ry = parseFloat(el.getAttribute('ry') || '0');
            if (rx > 0 && ry > 0) {
                const segments = 36;
                const ellipsePoints: DrawingPoint[] = [];
                for (let i = 0; i <= segments; i++) {
                    const ang = (2 * Math.PI * i) / segments;
                    ellipsePoints.push({ x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) });
                }
                subpaths.push({ points: ellipsePoints, isClosed: true });
            }
        }

        // Process each subpath: transform points and clean double-vertices / corners!
        subpaths.forEach(sp => {
            if (sp.points.length < 2) return;

            // 1. Apply element hierarchy transform
            const transformed = sp.points.map(p => applyMatrixToPoint(p, matrix));

            // 2. Clean and normalize vertices (removes double corners, micro-segments, redundant collinear points)
            const cleaned = cleanAndNormalizePoints(transformed, { isClosed: sp.isClosed });
            if (cleaned.length < 2) return;

            pathCounter++;
            paths.push({
                id: `imported-path-${pathCounter}-${Date.now()}`,
                points: cleaned,
                color: style.stroke,
                strokeWidth: style.strokeWidth,
                tool: 'pen',
                lineType: 'solid',
                isHandwriting: false,
                fill: style.fill,
                fillOpacity: style.fillOpacity,
                opacity: style.opacity,
            });
        });
    });

    if (paths.length === 0) return null;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    paths.forEach(p => {
        p.points.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
        });
    });

    const title = doc.querySelector('title')?.textContent || "Imported SVG";

    return {
        paths,
        bounds: {
            minX,
            minY,
            maxX,
            maxY,
            width: isFinite(minX) ? maxX - minX : 0,
            height: isFinite(minY) ? maxY - minY : 0,
        },
        title,
    };
};

export interface SvgDrawingResult {
    paths: DrawingPath[];
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        width: number;
        height: number;
    };
    title: string;
}

export const parseSvgDrawing = (svgString: string): SvgDrawingResult | null => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    return parseStandardSvgDrawing(doc);
};

const parseStandardSvg = (doc: Document): RegisteredPart | null => {
    return convertSvgResultToPart(parseStandardSvgDrawing(doc));
};

const convertSvgResultToPart = (result: SvgDrawingResult | null): RegisteredPart | null => {
    if (!result || result.paths.length === 0) return null;
    const { minX, maxX, minY, maxY } = result.bounds;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const centeredPaths = result.paths.map(path => ({
        ...path,
        points: path.points.map(pt => ({
            ...pt,
            x: pt.x - centerX,
            y: pt.y - centerY,
        })),
    }));

    return {
        id: `part-${Date.now()}`,
        name: result.title,
        paths: centeredPaths,
        basePoint: { x: 0, y: 0 },
        sourcePath: "",
    };
};

export const parsePartFromSvgString = (svgString: string): RegisteredPart | null => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const metadata = doc.querySelector('metadata#app-data');
    
    // 1. Try to parse App Metadata
    if (metadata && metadata.textContent) {
        try {
            const jsonString = metadata.textContent.trim();
            const part = JSON.parse(jsonString);
            if (part && part.id && part.paths) {
                // Also clean paths in metadata to resolve any pre-existing double corners
                const cleanedPaths = (part.paths as DrawingPath[]).map(p => ({
                    ...p,
                    points: cleanAndNormalizePoints(p.points),
                }));
                return {
                    ...part,
                    paths: cleanedPaths,
                } as RegisteredPart;
            }
        } catch (e) {
            console.error("Failed to parse part metadata", e);
        }
    }

    // 2. Fallback: Parse standard SVG geometry
    return parseStandardSvg(doc);
};

export const exportPartToSvg = (part: RegisteredPart) => {
    try {
        const svgContent = createPartSvgString(part);
        
        const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${part.name}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Part SVG Export failed:", error);
        alert("パーツのSVG出力に失敗しました。");
    }
};
