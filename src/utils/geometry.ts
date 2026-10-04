
import { DrawingPoint, DrawingPath, PartPlacementTransform } from '../types';
import { getPathAsPoints } from './layoutCalculator';

const NOMINAL_DOT_SPACING = 2.25;
const SNAP_DISTANCE = 1.0; // Standard snap distance (approx 100mm)
const GRID_SNAP_DISTANCE = 0.4; // Very tight snap for grid (approx 40mm) to allow line snapping in between

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const getPointsBounds = (points: DrawingPoint[]): Rect => {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

export const doRectsIntersect = (r1: Rect, r2: Rect): boolean => {
    return !(r2.x > r1.x + r1.width ||
             r2.x + r2.width < r1.x ||
             r2.y > r1.y + r1.height ||
             r2.y + r2.height < r1.y);
};

export const getDistance = (p1: DrawingPoint, p2: DrawingPoint): number => {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
};

export const getClosestPointOnLine = (point: DrawingPoint, start: DrawingPoint, end: DrawingPoint): { point: DrawingPoint, t: number } => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) return { point: start, t: 0 };

    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
    
    const closestPoint = {
        x: start.x + t * dx,
        y: start.y + t * dy
    };
    
    return { point: closestPoint, t };
};

export const calculateIntersection = (p1: DrawingPoint, p2: DrawingPoint, p3: DrawingPoint, p4: DrawingPoint): DrawingPoint | null => {
    const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (den === 0) return null;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / den;
    if (t > 0 && t < 1 && u > 0 && u < 1) {
        return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
    }
    return null;
};

export const getAllVertices = (paths: DrawingPath[]): DrawingPoint[] => {
    const points = new Map<string, DrawingPoint>();
    paths.forEach(path => {
        path.points.forEach(p => {
            const key = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
            if (!points.has(key)) {
                points.set(key, p);
            }
        });
    });
    return Array.from(points.values());
};

export const isPointInPolygon = (point: DrawingPoint, vertices: DrawingPoint[]): boolean => {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        
        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const getSnapPoint = (
    mousePos: DrawingPoint,
    allPaths: DrawingPath[],
    snapToGrid: boolean,
    snapToPoints: boolean,
    snapToLines: boolean,
    shiftPressed: boolean,
    gridDotOrigin: DrawingPoint = { x: 0, y: 0 },
    searchRadius: number = 50 // Default search radius for optimization
): { point: DrawingPoint, type: 'grid' | 'point' | 'line' | null } => {

    if (shiftPressed) {
        return { point: mousePos, type: null };
    }
    
    let bestPointSnap = { point: mousePos, dist: Infinity };
    let bestLineSnap = { point: mousePos, dist: Infinity };
    let bestGridSnap = { point: mousePos, dist: Infinity };

    const allSegments: {p1: DrawingPoint, p2: DrawingPoint}[] = [];
    const allVertices: DrawingPoint[] = [];

    // Optimization: Filter paths that are close to the mouse position
    const nearbyPaths = allPaths.filter(path => {
        const bounds = getPointsBounds(path.points);
        // Check if bounds + searchRadius intersects with mouse point
        return (
            mousePos.x >= bounds.x - searchRadius &&
            mousePos.x <= bounds.x + bounds.width + searchRadius &&
            mousePos.y >= bounds.y - searchRadius &&
            mousePos.y <= bounds.y + bounds.height + searchRadius
        );
    });

    // Collect all vertices and line segments from the geometry of the paths
    if (snapToPoints || snapToLines) {
        nearbyPaths.forEach(path => {
            // Use the raw geometric path data for snapping, ignoring visual effects like handwriting.
            const pointGroups = getPathAsPoints(path, false, false);
            pointGroups.forEach(points => {
                if (!points || points.length === 0) return;

                points.forEach(p => allVertices.push(p));
                
                if (points.length > 1) {
                    for (let i = 0; i < points.length - 1; i++) {
                        allSegments.push({ p1: points[i], p2: points[i+1] });
                    }
                }
            });
        });
    }

    // 1. Find the best snap point (from vertices and intersections)
    if (snapToPoints) {
        // Check all vertices
        allVertices.forEach(p => {
            const dist = getDistance(mousePos, p);
            if (dist < bestPointSnap.dist) {
                bestPointSnap = { point: p, dist };
            }
        });

        // Check all line segment intersections
        for (let i = 0; i < allSegments.length; i++) {
            for (let j = i + 1; j < allSegments.length; j++) {
                const seg1 = allSegments[i];
                const seg2 = allSegments[j];
                const intersection = calculateIntersection(seg1.p1, seg1.p2, seg2.p1, seg2.p2);
                if (intersection) {
                    const dist = getDistance(mousePos, intersection);
                    if (dist < bestPointSnap.dist) {
                        bestPointSnap = { point: intersection, dist };
                    }
                }
            }
        }
    }
    
    // 2. Find the best snap to a line
    if (snapToLines) {
        allSegments.forEach(seg => {
            const { point: closestPointOnSeg, t } = getClosestPointOnLine(mousePos, seg.p1, seg.p2);
            // Check if the closest point is within the segment (0 <= t <= 1)
            if (t >= 0 && t <= 1) {
                const dist = getDistance(mousePos, closestPointOnSeg);
                if (dist < bestLineSnap.dist) {
                    bestLineSnap = { point: closestPointOnSeg, dist };
                }
            }
        });
    }

    // 3. Find the best snap to the grid
    if (snapToGrid) {
        const gridPoint = {
            x: Math.round((mousePos.x - gridDotOrigin.x) / NOMINAL_DOT_SPACING) * NOMINAL_DOT_SPACING + gridDotOrigin.x,
            y: Math.round((mousePos.y - gridDotOrigin.y) / NOMINAL_DOT_SPACING) * NOMINAL_DOT_SPACING + gridDotOrigin.y,
        };
        const dist = getDistance(mousePos, gridPoint);
        bestGridSnap = { point: gridPoint, dist };
    }

    // Priority: Point > Grid > Line
    // However, Grid snap radius is very small (GRID_SNAP_DISTANCE) to allow Line snap to work in the spaces between.
    
    // 1. Points (Intersection/Vertex) - Highest priority
    if (snapToPoints && bestPointSnap.dist < SNAP_DISTANCE) {
        return { point: bestPointSnap.point, type: 'point' };
    }
    
    // 2. Grid - High Priority but Small Radius
    if (snapToGrid && bestGridSnap.dist < GRID_SNAP_DISTANCE) {
        return { point: bestGridSnap.point, type: 'grid' };
    }

    // 3. Lines - Lowest Priority but Larger Radius (catches cursor when not *exactly* on grid)
    if (snapToLines && bestLineSnap.dist < SNAP_DISTANCE) {
        return { point: bestLineSnap.point, type: 'line' };
    }

    return { point: mousePos, type: null };
};

export const getAngleSnapPoint = (startPoint: DrawingPoint, currentPoint: DrawingPoint): DrawingPoint => {
    const dx = currentPoint.x - startPoint.x;
    const dy = currentPoint.y - startPoint.y;
    const angle = Math.atan2(dy, dx);
    const snappedAngle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12); // 15 degrees snap
    const dist = Math.hypot(dx, dy);
    return {
        x: startPoint.x + dist * Math.cos(snappedAngle),
        y: startPoint.y + dist * Math.sin(snappedAngle),
    };
};

export const transformPoints = (
    points: DrawingPoint[],
    transform: PartPlacementTransform
): DrawingPoint[] => {
    const { rotation, scale, flipX, flipY } = transform;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    return points.map(p => {
        // 1. Scale and Flip
        let x = p.x * scale * (flipX ? -1 : 1);
        let y = p.y * scale * (flipY ? -1 : 1);

        // 2. Rotate
        const xRot = x * cos - y * sin;
        const yRot = x * sin + y * cos;

        return { ...p, x: xRot, y: yRot };
    });
};

// --- New Vector & Geometry Helpers ---

export const addVectors = (v1: DrawingPoint, v2: DrawingPoint): DrawingPoint => ({ x: v1.x + v2.x, y: v1.y + v2.y });
export const subVectors = (v1: DrawingPoint, v2: DrawingPoint): DrawingPoint => ({ x: v1.x - v2.x, y: v1.y - v2.y });
export const scaleVector = (v: DrawingPoint, s: number): DrawingPoint => ({ x: v.x * s, y: v.y * s });
export const dotProduct = (v1: DrawingPoint, v2: DrawingPoint): number => v1.x * v2.x + v1.y * v2.y;

export const getPointFromPolar = (origin: DrawingPoint, angleRad: number, distance: number): DrawingPoint => {
    return {
        x: origin.x + distance * Math.cos(angleRad),
        y: origin.y + distance * Math.sin(angleRad)
    };
};

export const normalizeAngle = (angle: number): number => {
    let a = angle % (2 * Math.PI);
    if (a < 0) a += 2 * Math.PI;
    return a;
};

// Helper to generate SVG path for an arc
export const generateSvgArc = (center: DrawingPoint, radius: number, startAngle: number, endAngle: number, isMajorArc: boolean): string => {
    const start = getPointFromPolar(center, startAngle, radius);
    const end = getPointFromPolar(center, endAngle, radius);
    
    let diff = endAngle - startAngle;
    // Normalize to -PI ... PI
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    
    const isPositiveDir = diff > 0;
    
    // Default: Shortest Path
    // sweepFlag: 1 if positive angle change (CW in SVG coords), 0 if negative (CCW).
    let sweepFlag = isPositiveDir ? 1 : 0; 
    let largeArcFlag = 0;

    if (isMajorArc) {
        largeArcFlag = 1;
        sweepFlag = sweepFlag === 1 ? 0 : 1; // Invert sweep direction to go the long way
    }
    
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
};
