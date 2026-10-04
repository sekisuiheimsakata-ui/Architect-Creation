

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, RegisteredPart, DrawingPath, DrawingPoint } from '../types';
import { PdfLayout } from '../components/PdfLayout';
import { PaperSize, PaperOrientation } from '../components/PrintLayout';
import { generateFilename } from './filenameGenerator';
import { PAGE_DIMENSIONS } from '../constants';
import { pointsToSvgPath, getPathAsPoints } from './layoutCalculator';

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

const convertElementToPathD = (element: Element): string | null => {
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'path') {
        return element.getAttribute('d');
    }
    
    if (tagName === 'rect') {
        const x = parseFloat(element.getAttribute('x') || '0');
        const y = parseFloat(element.getAttribute('y') || '0');
        const w = parseFloat(element.getAttribute('width') || '0');
        const h = parseFloat(element.getAttribute('height') || '0');
        return `M ${x} ${y} H ${x+w} V ${y+h} H ${x} Z`;
    }
    
    if (tagName === 'circle') {
        const cx = parseFloat(element.getAttribute('cx') || '0');
        const cy = parseFloat(element.getAttribute('cy') || '0');
        const r = parseFloat(element.getAttribute('r') || '0');
        return `M ${cx+r} ${cy} A ${r} ${r} 0 1 0 ${cx-r} ${cy} A ${r} ${r} 0 1 0 ${cx+r} ${cy}`;
    }
    
    if (tagName === 'line') {
        const x1 = parseFloat(element.getAttribute('x1') || '0');
        const y1 = parseFloat(element.getAttribute('y1') || '0');
        const x2 = parseFloat(element.getAttribute('x2') || '0');
        const y2 = parseFloat(element.getAttribute('y2') || '0');
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    
    if (tagName === 'polyline' || tagName === 'polygon') {
        const points = element.getAttribute('points');
        if (!points) return null;
        const d = 'M ' + points.trim().replace(/\s+/g, ' L ');
        return tagName === 'polygon' ? d + ' Z' : d;
    }

    return null;
};

// Parse standard SVG without app metadata
const parseStandardSvg = (doc: Document): RegisteredPart | null => {
    const elements = Array.from(doc.querySelectorAll('path, rect, circle, line, polyline, polygon'));
    if (elements.length === 0) return null;

    const paths: DrawingPath[] = [];
    
    // Helper to sample points from path string
    const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    elements.forEach((el, index) => {
        const d = convertElementToPathD(el);
        if (!d) return;

        tempPath.setAttribute('d', d);
        
        try {
            const length = tempPath.getTotalLength();
            const points: DrawingPoint[] = [];
            // Sample points to approximate shapes
            const step = 2; // 2mm step for sampling
            const numPoints = Math.max(2, Math.ceil(length / step));
            
            for (let i = 0; i <= numPoints; i++) {
                const point = tempPath.getPointAtLength((i / numPoints) * length);
                points.push({ x: point.x, y: point.y });
                
                // Update bounding box
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }

            // Extract style
            const stroke = el.getAttribute('stroke') || '#404040';
            const strokeWidth = parseFloat(el.getAttribute('stroke-width') || '0.7');
            const fill = el.getAttribute('fill');
            const hasFill = fill && fill !== 'none';
            const fillOpacity = parseFloat(el.getAttribute('fill-opacity') || '1.0');
            const strokeOpacity = parseFloat(el.getAttribute('stroke-opacity') || '1.0');

            paths.push({
                id: `imported-path-${index}-${Date.now()}`,
                points,
                color: stroke,
                strokeWidth: isNaN(strokeWidth) ? 0.7 : strokeWidth,
                tool: 'pen',
                lineType: 'solid',
                isHandwriting: false,
                fill: hasFill ? fill : undefined,
                fillOpacity: hasFill ? (isNaN(fillOpacity) ? 1.0 : fillOpacity) : undefined,
                opacity: isNaN(strokeOpacity) ? 1.0 : strokeOpacity
            });
        } catch (e) {
            console.warn("Failed to parse path geometry", e);
        }
    });

    if (paths.length === 0) return null;

    // Calculate center to be the base point (0,0)
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Center all paths relative to (0,0)
    const centeredPaths = paths.map(path => ({
        ...path,
        points: path.points.map(p => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY
        }))
    }));

    // Get name from title or filename (passed later)
    const title = doc.querySelector('title')?.textContent || "Imported SVG";

    return {
        id: `part-${Date.now()}`,
        name: title,
        paths: centeredPaths,
        basePoint: { x: 0, y: 0 },
        sourcePath: ""
    };
};

export const parsePartFromSvgString = (svgString: string): RegisteredPart | null => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const metadata = doc.querySelector('metadata#app-data');
    
    // 1. Try to parse App Metadata
    if (metadata && metadata.textContent) {
        try {
            // CDATA might wrap the content
            const jsonString = metadata.textContent.trim();
            const part = JSON.parse(jsonString);
            if (part && part.id && part.paths) {
                return part as RegisteredPart;
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
