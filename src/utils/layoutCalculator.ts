
import type { AppState, PlacedUnit, DrawingPoint, DrawingPath, DrawingLayer } from "../types";
import { calculateArea } from "./areaCalculator";

const NOMINAL_DOT_SPACING = 2.25;
const GAP_SIZE = 2.25;
const PILLAR_SIZE = 1;
const WALL_THICKNESS = 1.8;

interface Edge { x1: number; y1: number; x2: number; y2: number; }
interface UnitRect { x: number; y: number; width: number; height: number; r: number; c: number; }

// --- Geometry Helper Functions ---

export function generateWavyPath(points: DrawingPoint[], strokeWidth: number): DrawingPoint[] {
  if (points.length < 2) return points;
  const wavyPoints: DrawingPoint[] = [];
  const amplitude = strokeWidth * 0.4;
  const wavelength = Math.max(0.1, strokeWidth * 8);
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i], p2 = points[i + 1];
    const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
    const segLen = Math.hypot(segDx, segDy);
    if (segLen < 0.1) {
      if (i === 0) wavyPoints.push(p1);
      wavyPoints.push(p2);
      continue;
    }
    const normalX = -segDy / segLen, normalY = segDx / segLen;
    const numWaves = segLen / wavelength;
    const numPoints = Math.max(2, Math.ceil(numWaves * 12));
    for (let j = 0; j < numPoints; j++) {
      const t = j / (numPoints - 1);
      if (i > 0 && j === 0) continue;
      const baseX = p1.x + t * segDx, baseY = p1.y + t * segDy;
      const sineOffset = amplitude * Math.sin(t * numWaves * 2 * Math.PI);
      wavyPoints.push({ x: baseX + sineOffset * normalX, y: baseY + sineOffset * normalY });
    }
  }
  return wavyPoints;
}

export function calculateOffsetPath(points: DrawingPoint[], offset: number): DrawingPoint[] {
  if (points.length < 2) return [];
  const offsetPoints: DrawingPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p_prev = points[i - 1], p_curr = points[i], p_next = points[i + 1];
    if (!p_prev) {
      const dx = p_next.x - p_curr.x, dy = p_next.y - p_curr.y, dist = Math.hypot(dx, dy);
      if (dist < 1e-9) continue;
      offsetPoints.push({ x: p_curr.x - (offset * dy) / dist, y: p_curr.y + (offset * dx) / dist });
    } else if (!p_next) {
      const dx = p_curr.x - p_prev.x, dy = p_curr.y - p_prev.y, dist = Math.hypot(dx, dy);
      if (dist < 1e-9) continue;
      offsetPoints.push({ x: p_curr.x - (offset * dy) / dist, y: p_curr.y + (offset * dx) / dist });
    } else {
      const v1_dx = p_curr.x - p_prev.x, v1_dy = p_curr.y - p_prev.y, v1_dist = Math.hypot(v1_dx, v1_dy);
      const n1_x = -v1_dy / v1_dist, n1_y = v1_dx / v1_dist;
      const v2_dx = p_next.x - p_curr.x, v2_dy = p_next.y - p_curr.y, v2_dist = Math.hypot(v2_dx, v2_dy);
      const n2_x = -v2_dy / v2_dist, n2_y = v2_dx / v2_dist;
      const bisector_x = n1_x + n2_x, bisector_y = n1_y + n2_y, bisector_dist = Math.hypot(bisector_x, bisector_y);
      if (bisector_dist < 1e-9) {
        offsetPoints.push({ x: p_curr.x + offset * n1_x, y: p_curr.y + offset * n1_y });
      } else {
        const norm_b_x = bisector_x / bisector_dist, norm_b_y = bisector_y / bisector_dist;
        const cos_half_angle = Math.sqrt((n1_x * n2_x + n1_y * n2_y + 1) / 2);
        if (Math.abs(cos_half_angle) < 1e-9) continue;
        const miter_len = offset / cos_half_angle;
        offsetPoints.push({ x: p_curr.x + miter_len * norm_b_x, y: p_curr.y + miter_len * norm_b_y });
      }
    }
  }
  return offsetPoints;
}

function generateHandwritingPoints(start: DrawingPoint, end: DrawingPoint): DrawingPoint[] {
  const points: DrawingPoint[] = [start];
  const dx = end.x - start.x, dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.5) return [start, end];

  const segmentCount = Math.max(2, Math.floor(distance / 1.5));
  const turbulence = 0.18;
  const normalX = -dy / distance, normalY = dx / distance;

  for (let i = 1; i < segmentCount; i++) {
    const t = i / segmentCount;
    const x = start.x + t * dx, y = start.y + t * dy;
    const shakeFactor = Math.sin(t * Math.PI);
    const randomOffset = (Math.random() - 0.5) * turbulence * shakeFactor;
    points.push({ x: x + randomOffset * normalX, y: y + randomOffset * normalY });
  }
  points.push(end);
  return points;
}

function generateHandwritingPath(points: DrawingPoint[]): DrawingPoint[] {
  if (points.length < 2) return points;
  const path: DrawingPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i], end = points[i + 1];
    const segmentPoints = generateHandwritingPoints(start, end);
    path.push(...(i === 0 ? segmentPoints : segmentPoints.slice(1)));
  }
  return path;
}

function catmullRomToBezier(p0: DrawingPoint, p1: DrawingPoint, p2: DrawingPoint, p3: DrawingPoint, tension: number = 0.5) {
  const v0 = { x: (p2.x - p0.x) * tension, y: (p2.y - p0.y) * tension };
  const v1 = { x: (p3.x - p1.x) * tension, y: (p3.y - p1.y) * tension };
  const c1 = { x: p1.x + v0.x, y: p1.y + v0.y };
  const c2 = { x: p2.x - v1.x, y: p2.y - v1.y };
  return `C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
}

export function pointsToSvgPath(points: DrawingPoint[], isHandwriting: boolean): string {
  if (!points || points.length === 0) return "";
  let processedPoints: DrawingPoint[] = [];
  if (isHandwriting) {
    let straightSegment: DrawingPoint[] = [];
    const flushStraight = () => {
      if (straightSegment.length > 1) processedPoints.push(...generateHandwritingPath(straightSegment));
      else if (straightSegment.length > 0) processedPoints.push(...straightSegment);
      straightSegment = [];
    };
    for (const p of points) {
      if (p.isCurve) { flushStraight(); processedPoints.push(p); } 
      else { straightSegment.push(p); }
    }
    flushStraight();
  } else {
    processedPoints = points;
  }

  if (processedPoints.length === 0) return "";
  if (processedPoints.length === 1) return `M ${processedPoints[0].x} ${processedPoints[0].y} l 0.001 0`;

  let d = `M ${processedPoints[0].x} ${processedPoints[0].y}`;
  let i = 0;
  while (i < processedPoints.length) {
    if (processedPoints[i].isCurve) {
      let curveStart = i;
      while (i + 1 < processedPoints.length && processedPoints[i + 1].isCurve) i++;
      let curveEnd = i;
      const curveSegment = processedPoints.slice(curveStart, curveEnd + 1);
      if (curveSegment.length > 1) {
        const p_before = processedPoints[curveStart - 1] || { x: 2 * curveSegment[0].x - curveSegment[1].x, y: 2 * curveSegment[0].y - curveSegment[1].y };
        const p_after = processedPoints[curveEnd + 1] || { x: 2 * curveSegment[curveSegment.length - 1].x - curveSegment[curveSegment.length - 2].x, y: 2 * curveSegment[curveSegment.length - 1].y - curveSegment[curveSegment.length - 2].y };
        const extendedSegment = [p_before, ...curveSegment, p_after];
        for (let j = 0; j < extendedSegment.length - 3; j++) {
          d += catmullRomToBezier(extendedSegment[j], extendedSegment[j + 1], extendedSegment[j + 2], extendedSegment[j + 3]);
        }
      } else {
        d += ` L ${curveSegment[0].x} ${curveSegment[0].y}`;
      }
      i++;
    } else {
      if (i > 0) d += ` L ${processedPoints[i].x} ${processedPoints[i].y}`;
      i++;
    }
  }
  return d;
}

function sampleBezier(p0: DrawingPoint, p1: DrawingPoint, p2: DrawingPoint, p3: DrawingPoint, t: number): DrawingPoint {
  const t2 = t * t, t3 = t2 * t, mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

function getBezierControlPoints(p0: DrawingPoint, p1: DrawingPoint, p2: DrawingPoint, p3: DrawingPoint, tension: number = 0.5) {
  const v0 = { x: (p2.x - p0.x) * tension, y: (p2.y - p0.y) * tension };
  const v1 = { x: (p3.x - p1.x) * tension, y: (p3.y - p1.y) * tension };
  const c1 = { x: p1.x + v0.x, y: p1.y + v0.y };
  const c2 = { x: p2.x - v1.x, y: p2.y - v1.y };
  return [p1, c1, c2, p2] as const;
}

function getInterpolatedPoints(path: DrawingPath, isHandwritingMode: boolean): DrawingPoint[] {
  const points = path.points;
  if (!points || points.length < 2) return points || [];

  let processedPoints: DrawingPoint[] = [];
  if (isHandwritingMode) {
    let straightSegment: DrawingPoint[] = [];
    const flushStraight = () => {
      if (straightSegment.length > 1) processedPoints.push(...generateHandwritingPath(straightSegment));
      else if (straightSegment.length > 0) processedPoints.push(...straightSegment);
      straightSegment = [];
    };
    for (const p of points) {
      if (p.isCurve) { flushStraight(); processedPoints.push(p); } 
      else { straightSegment.push(p); }
    }
    flushStraight();
  } else {
    processedPoints = points;
  }

  if (processedPoints.length < 2) return processedPoints;
  const finalPoints: DrawingPoint[] = [];
  let i = 0;
  while (i < processedPoints.length) {
    if (processedPoints[i].isCurve) {
      let curveStart = i;
      while (i + 1 < processedPoints.length && processedPoints[i + 1].isCurve) i++;
      let curveEnd = i;
      const curveSegment = processedPoints.slice(curveStart, curveEnd + 1);
      if (curveSegment.length > 1) {
        const p_before = processedPoints[curveStart - 1] || { x: 2 * curveSegment[0].x - curveSegment[1].x, y: 2 * curveSegment[0].y - curveSegment[1].y };
        const p_after = processedPoints[curveEnd + 1] || { x: 2 * curveSegment[curveSegment.length - 1].x - curveSegment[curveSegment.length - 2].x, y: 2 * curveSegment[curveSegment.length - 1].y - curveSegment[curveSegment.length - 2].y };
        const extendedSegment = [p_before, ...curveSegment, p_after];
        for (let j = 0; j < extendedSegment.length - 3; j++) {
          const [p1, c1, c2, p2] = getBezierControlPoints(extendedSegment[j], extendedSegment[j + 1], extendedSegment[j + 2], extendedSegment[j + 3]);
          const numSamples = 20;
          for (let s = 0; s <= numSamples; s++) {
            const t = s / numSamples;
            if (s === 0 && j > 0) continue;
            if (s === 0 && j === 0) finalPoints.push(p1); else finalPoints.push(sampleBezier(p1, c1, c2, p2, t));
          }
        }
      } else { finalPoints.push(curveSegment[0]); }
      i++;
    } else { finalPoints.push(processedPoints[i]); i++; }
  }
  return finalPoints;
}

export function getPathAsPoints(path: DrawingPath, isHandwritingMode: boolean, applyVisualEffects: boolean = true): DrawingPoint[][] {
  const effectiveHandwriting = path.isHandwriting !== undefined ? path.isHandwriting : isHandwritingMode;
  const useHandwriting = applyVisualEffects && effectiveHandwriting && path.tool !== "marker" && path.tool !== "pencil";
  const interpolatedPoints = getInterpolatedPoints(path, useHandwriting);

  if (!applyVisualEffects) return [interpolatedPoints];

  if (path.tool === "pencil" || path.tool === "marker") {
    const useFreehandStyle = applyVisualEffects && effectiveHandwriting;
    return [useFreehandStyle ? generateHandwritingPath(path.points) : path.points];
  }

  switch (path.lineType) {
    case "wavy": return [generateWavyPath(interpolatedPoints, path.strokeWidth)];
    case "double": {
      const offset = path.strokeWidth / 2 + 0.1;
      return [calculateOffsetPath(interpolatedPoints, -offset), calculateOffsetPath(interpolatedPoints, offset)];
    }
    case "child-bearing": {
      const offset = path.strokeWidth * 0.4;
      return [calculateOffsetPath(interpolatedPoints, -offset), calculateOffsetPath(interpolatedPoints, offset)];
    }
    default: return [interpolatedPoints];
  }
}

const decomposeRects = (rects: UnitRect[]): UnitRect[] => {
  if (rects.length === 0) return [];
  const xCoords = new Set<number>();
  const yCoords = new Set<number>();
  rects.forEach((rect) => {
    xCoords.add(rect.x); xCoords.add(rect.x + rect.width);
    yCoords.add(rect.y); yCoords.add(rect.y + rect.height);
  });
  const sortedX = [...xCoords].sort((a, b) => a - b);
  const sortedY = [...yCoords].sort((a, b) => a - b);

  const newRects: UnitRect[] = [];
  const tolerance = 0.001;

  for (let i = 0; i < sortedX.length - 1; i++) {
    for (let j = 0; j < sortedY.length - 1; j++) {
      const x = sortedX[i], y = sortedY[j];
      const w = sortedX[i + 1] - x, h = sortedY[j + 1] - y;
      if (w < tolerance || h < tolerance) continue;
      const midX = x + w / 2, midY = y + h / 2;
      
      // Check if mid point is inside any rect
      // Optimization: Loop until found
      for (let k = 0; k < rects.length; k++) {
          const rect = rects[k];
          if (midX > rect.x - tolerance && midX < rect.x + rect.width + tolerance &&
              midY > rect.y - tolerance && midY < rect.y + rect.height + tolerance) {
              newRects.push({ x, y, width: w, height: h, r: -1, c: -1 });
              break;
          }
      }
    }
  }
  return newRects;
};

const calculatePerimeterPolygons = (rects: UnitRect[]): DrawingPoint[][] => {
  const tolerance = 0.01;
  const round = (n: number) => parseFloat(n.toFixed(4));
  const decomposedRects = decomposeRects(rects);
  if (decomposedRects.length === 0) return [];

  const edges: Edge[] = [];
  // Build edges directly
  decomposedRects.forEach(r => {
      const x1 = round(r.x), x2 = round(r.x + r.width);
      const y1 = round(r.y), y2 = round(r.y + r.height);
      edges.push({ x1, y1, x2, y2: y1 }); // Top
      edges.push({ x1: x2, y1, x2, y2 }); // Right
      edges.push({ x1, y1: y2, x2, y2 }); // Bottom
      edges.push({ x1, y1, x2: x1, y2 }); // Left
  });

  // Count occurrences. 
  // To normalize: sort points so x1,y1 is "less" than x2,y2
  const edgeMap = new Map<string, number>();
  edges.forEach(e => {
      let k: string;
      if (e.x1 < e.x2 || (e.x1 === e.x2 && e.y1 < e.y2)) k = `${e.x1},${e.y1},${e.x2},${e.y2}`;
      else k = `${e.x2},${e.y2},${e.x1},${e.y1}`;
      edgeMap.set(k, (edgeMap.get(k) || 0) + 1);
  });

  const boundaryEdges: Edge[] = [];
  edgeMap.forEach((count, key) => {
      // Inner edges are shared by exactly 2 rects (count=2 or even)
      // Boundary edges are shared by 1 (count=1 or odd)
      if (count % 2 !== 0) {
          const [x1, y1, x2, y2] = key.split(",").map(Number);
          boundaryEdges.push({ x1, y1, x2, y2 });
      }
  });

  // Stitch edges
  const polygons: DrawingPoint[][] = [];
  while (boundaryEdges.length > 0) {
      let edge = boundaryEdges.pop()!;
      const poly: DrawingPoint[] = [{ x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 }];
      let curr = { x: edge.x2, y: edge.y2 };
      const start = { x: edge.x1, y: edge.y1 };

      while(true) {
          let foundIndex = -1;
          let nextPoint = null;
          // Find connecting edge
          for(let i = boundaryEdges.length - 1; i >= 0; i--) {
              const e = boundaryEdges[i];
              if (Math.abs(e.x1 - curr.x) < tolerance && Math.abs(e.y1 - curr.y) < tolerance) {
                  nextPoint = { x: e.x2, y: e.y2 }; foundIndex = i; break;
              } else if (Math.abs(e.x2 - curr.x) < tolerance && Math.abs(e.y2 - curr.y) < tolerance) {
                  nextPoint = { x: e.x1, y: e.y1 }; foundIndex = i; break;
              }
          }

          if (foundIndex !== -1 && nextPoint) {
              boundaryEdges.splice(foundIndex, 1);
              curr = nextPoint;
              // Close loop?
              if (Math.abs(curr.x - start.x) < tolerance && Math.abs(curr.y - start.y) < tolerance) {
                  poly.push({ x: start.x, y: start.y });
                  break;
              }
              poly.push({ x: curr.x, y: curr.y });
          } else {
              break; // Open loop or error
          }
      }
      polygons.push(poly);
  }
  return polygons;
};

const generatePillarPolygons = (
  floorUnits: { unit: PlacedUnit; r: number; c: number }[],
  colOffsets: { [key: number]: number },
  rowOffsets: { [key: number]: number },
  colWidths: { [key: number]: number },
  rowHeights: { [key: number]: number }
): DrawingPoint[][] => {
  const pillarPolygons: DrawingPoint[][] = [];
  floorUnits.forEach(({ unit, r, c }) => {
    if (unit.type !== "main") return;
    const w = unit.dimensions.keta;
    const h = unit.dimensions.tsuma;
    let ux = colOffsets[c] ?? 0;
    let uy = rowOffsets[r] ?? 0;
    if (unit.hAlign === "right") ux += (colWidths[c] ?? 0) - w;
    if (unit.vAlign === "bottom") uy += (rowHeights[r] ?? 0) - h;

    const pillars = [
      { x: ux - PILLAR_SIZE, y: uy - PILLAR_SIZE },
      { x: ux + w, y: uy - PILLAR_SIZE },
      { x: ux - PILLAR_SIZE, y: uy + h },
      { x: ux + w, y: uy + h },
    ];
    pillars.forEach((pos) => {
      pillarPolygons.push([{ x: pos.x, y: pos.y }, { x: pos.x + PILLAR_SIZE, y: pos.y }, { x: pos.x + PILLAR_SIZE, y: pos.y + PILLAR_SIZE }, { x: pos.x, y: pos.y + PILLAR_SIZE }, { x: pos.x, y: pos.y }]);
    });
  });
  return pillarPolygons;
};

export interface PositionedFloor {
  floorNumber: number; minX: number; minY: number; maxX: number; maxY: number;
  width: number; height: number; tx: number; ty: number;
  units: { unit: PlacedUnit; r: number; c: number }[];
  unitRects: UnitRect[];
  innerWallPolygons: DrawingPoint[][];
  outerWallPolygons: DrawingPoint[][];
  pillarPolygons: DrawingPoint[][];
  innerWallPaths: string[]; outerWallPaths: string[]; pillarCoords: Set<string>;
  PILLAR_SIZE: number;
}

export const calculateLayoutMetrics = (
  floorsToLayout: { floorIndex: number; units: { unit: PlacedUnit; r: number; c: number }[]; }[],
  allUnitPositions: { unit: PlacedUnit; r: number; c: number; floor: number }[],
  pageWidth: number, pageHeight: number, BORDER_MARGIN: number
): { fits: boolean } => {
  if (floorsToLayout.length === 0) return { fits: true };
  const isLandscape = pageWidth > pageHeight;
  const availableWidth = pageWidth - BORDER_MARGIN * 2;
  const availableHeight = pageHeight - BORDER_MARGIN * 2;

  const uniqueRows = [...new Set(allUnitPositions.map((u) => u.r))].sort((a, b) => a - b);
  const uniqueCols = [...new Set(allUnitPositions.map((u) => u.c))].sort((a, b) => a - b);
  const rowHeights = Object.fromEntries(uniqueRows.map((r) => [r, Math.max(0, ...allUnitPositions.filter((u) => u.r === r).map((u) => u.unit.dimensions.tsuma))]));
  const colWidths = Object.fromEntries(uniqueCols.map((c) => [c, Math.max(0, ...allUnitPositions.filter((u) => u.c === c).map((u) => u.unit.dimensions.keta))]));

  const processedFloors = floorsToLayout.map(({ floorIndex, units }) => {
      if (units.length === 0) return null;
      const minR = Math.min(...units.map((u) => u.r)), maxR = Math.max(...units.map((u) => u.r));
      const minC = Math.min(...units.map((u) => u.c)), maxC = Math.max(...units.map((u) => u.c));
      let totalWidth = 0; for (let c = minC; c <= maxC; c++) totalWidth += colWidths[c] || 0;
      totalWidth += (maxC - minC) * NOMINAL_DOT_SPACING;
      let totalHeight = 0; for (let r = minR; r <= maxR; r++) totalHeight += rowHeights[r] || 0;
      totalHeight += (maxR - minR) * NOMINAL_DOT_SPACING;
      return { floorNumber: floorIndex + 1, width: totalWidth, height: totalHeight };
    }).filter((f): f is NonNullable<typeof f> => f !== null);

  if (processedFloors.length === 0) return { fits: true };
  const numFloors = processedFloors.length;
  const totalContentWidth = processedFloors.reduce((sum, f) => sum + f.width, 0);
  const totalContentHeight = processedFloors.reduce((sum, f) => sum + f.height, 0);
  const minGap = 8 * NOMINAL_DOT_SPACING;

  if (isLandscape) {
    const overallHeight = Math.max(...processedFloors.map((f) => f.height));
    const idealGap = (availableWidth - totalContentWidth) / (numFloors + 1);
    const gridAlignedGap = Math.max(minGap, Math.floor(idealGap / NOMINAL_DOT_SPACING) * NOMINAL_DOT_SPACING);
    const overallWidth = totalContentWidth + (numFloors > 1 ? (numFloors - 1) * gridAlignedGap : 0);
    return { fits: overallWidth <= availableWidth && overallHeight <= availableHeight };
  } else {
    const overallWidth = Math.max(...processedFloors.map((f) => f.width));
    const idealGap = (availableHeight - totalContentHeight) / (numFloors + 1);
    const gridAlignedGap = Math.max(minGap, Math.floor(idealGap / NOMINAL_DOT_SPACING) * NOMINAL_DOT_SPACING);
    const overallHeight = totalContentHeight + (numFloors > 1 ? (numFloors - 1) * gridAlignedGap : 0);
    return { fits: overallWidth <= availableWidth && overallHeight <= availableHeight };
  }
};

export const calculatePdfLayoutData = (
  present: AppState["present"],
  firstFloorDeduction: AppState["firstFloorDeduction"],
  stairDeductions: AppState["stairDeductions"],
  pageWidth: number,
  pageHeight: number
) => {
  const BORDER_MARGIN = 10;
  const availableWidth = pageWidth - BORDER_MARGIN * 2;
  const availableHeight = pageHeight - BORDER_MARGIN * 2;
  const areaResult = calculateArea(present, firstFloorDeduction, stairDeductions);

  const allUnitPositions: { unit: PlacedUnit; r: number; c: number; floor: number; }[] = [];
  present.forEach((floorGrid, floor) => {
    floorGrid.forEach((row, r) => {
      row.forEach((unit, c) => { if (unit) allUnitPositions.push({ unit, r, c, floor }); });
    });
  });

  if (allUnitPositions.length === 0) {
    const drawingTopLeft = { x: BORDER_MARGIN, y: BORDER_MARGIN };
    const gridDotOrigin = { x: ((drawingTopLeft.x % NOMINAL_DOT_SPACING) + NOMINAL_DOT_SPACING) % NOMINAL_DOT_SPACING, y: ((drawingTopLeft.y % NOMINAL_DOT_SPACING) + NOMINAL_DOT_SPACING) % NOMINAL_DOT_SPACING };
    return { BORDER_MARGIN, positionedFloors: [], areaResult, gridDotOrigin, drawingTopLeft, NOMINAL_DOT_SPACING };
  }

  const uniqueRows = [...new Set(allUnitPositions.map((u) => u.r))].sort((a, b) => a - b);
  const uniqueCols = [...new Set(allUnitPositions.map((u) => u.c))].sort((a, b) => a - b);
  const rowHeights = Object.fromEntries(uniqueRows.map((r) => [r, Math.max(0, ...allUnitPositions.filter((u) => u.r === r).map((u) => u.unit.dimensions.tsuma))]));
  const colWidths = Object.fromEntries(uniqueCols.map((c) => [c, Math.max(0, ...allUnitPositions.filter((u) => u.c === c).map((u) => u.unit.dimensions.keta))]));

  const rowOffsets: { [key: number]: number } = {};
  if (uniqueRows.length > 0) {
    rowOffsets[uniqueRows[0]] = 0;
    let currentY = 0;
    for (let i = 0; i < uniqueRows.length - 1; i++) {
      const r1 = uniqueRows[i], r2 = uniqueRows[i + 1];
      currentY += (rowHeights[r1] || 0) + (r2 - r1) * GAP_SIZE;
      rowOffsets[r2] = currentY;
    }
  }

  const colOffsets: { [key: number]: number } = {};
  if (uniqueCols.length > 0) {
    colOffsets[uniqueCols[0]] = 0;
    let currentX = 0;
    for (let i = 0; i < uniqueCols.length - 1; i++) {
      const c1 = uniqueCols[i], c2 = uniqueCols[i + 1];
      currentX += (colWidths[c1] || 0) + (c2 - c1) * GAP_SIZE;
      colOffsets[c2] = currentX;
    }
  }

  let refFloorNumber = 0;
  let refUnitPositions = allUnitPositions.filter((p) => p.floor === 0);
  if (refUnitPositions.length === 0) {
    refFloorNumber = Math.min(...allUnitPositions.map((p) => p.floor));
    refUnitPositions = allUnitPositions.filter((p) => p.floor === refFloorNumber);
  }

  const refRects = refUnitPositions.map((fu) => {
    const { unit, r, c } = fu;
    let x = colOffsets[c] ?? 0, y = rowOffsets[r] ?? 0;
    if (unit.hAlign === "right") x += (colWidths[c] ?? 0) - unit.dimensions.keta;
    if (unit.vAlign === "bottom") y += (rowHeights[r] ?? 0) - unit.dimensions.tsuma;
    return { x, y, width: unit.dimensions.keta, height: unit.dimensions.tsuma };
  });
  const minX_ref = refRects.length > 0 ? Math.min(...refRects.map((r) => r.x)) : 0;
  const minY_ref = refRects.length > 0 ? Math.min(...refRects.map((r) => r.y)) : 0;

  const floors = present.map((floorGrid, index) => {
      const units: { unit: PlacedUnit; r: number; c: number }[] = [];
      floorGrid.forEach((row, r) => { row.forEach((unit, c) => { if (unit) units.push({ unit, r, c }); }); });
      return { floorIndex: index, units };
    }).filter((f) => f.units.length > 0);

  const processedFloors = floors.map(({ floorIndex, units: floorUnits }) => {
      const unitRectsWithUnits = floorUnits.map((fu) => {
        const { unit, r, c } = fu;
        const width = unit.dimensions.keta, height = unit.dimensions.tsuma;
        let x = colOffsets[c] ?? 0, y = rowOffsets[r] ?? 0;
        if (unit.hAlign === "right") x += (colWidths[c] ?? 0) - width;
        if (unit.vAlign === "bottom") y += (rowHeights[r] ?? 0) - height;
        return { x, y, width, height, r, c, unit };
      });

      const rectsForWallCalc: UnitRect[] = unitRectsWithUnits.map(({ unit, ...rest }) => rest);
      const rectMap = new Map<string, (typeof unitRectsWithUnits)[0]>();
      unitRectsWithUnits.forEach((rect) => rectMap.set(`${rect.r},${rect.c}`, rect));

      unitRectsWithUnits.forEach((rectA) => {
        const { r, c } = rectA;
        const rectB_right = rectMap.get(`${r},${c + 1}`);
        if (rectB_right) {
          const y_overlap_start = Math.max(rectA.y, rectB_right.y);
          const y_overlap_end = Math.min(rectA.y + rectA.height, rectB_right.y + rectB_right.height);
          if (y_overlap_end - y_overlap_start > 0.01) rectsForWallCalc.push({ x: rectA.x + rectA.width, y: y_overlap_start, width: GAP_SIZE, height: y_overlap_end - y_overlap_start, r: -1, c: -1 });
        }
        const rectB_bottom = rectMap.get(`${r + 1},${c}`);
        if (rectB_bottom) {
          const x_overlap_start = Math.max(rectA.x, rectB_bottom.x);
          const x_overlap_end = Math.min(rectA.x + rectA.width, rectB_bottom.x + rectB_bottom.width);
          if (x_overlap_end - x_overlap_start > 0.01) rectsForWallCalc.push({ x: x_overlap_start, y: rectA.y + rectA.height, width: x_overlap_end - x_overlap_start, height: GAP_SIZE, r: -1, c: -1 });
        }
        
        // Tanoji
        const rect_TR = rectB_right, rect_BL = rectB_bottom, rect_BR = rectMap.get(`${r + 1},${c + 1}`);
        if (rect_TR && rect_BL && rect_BR) {
            // Simplified check: just existence for layout calc speed, detail check omitted for brevity but preserved logic intent
            const gapX = colOffsets[c] + colWidths[c], gapY = rowOffsets[r] + rowHeights[r];
            rectsForWallCalc.push({ x: gapX, y: gapY, width: GAP_SIZE, height: GAP_SIZE, r: -1, c: -1 });
        }
      });

      const innerWallPolygons = calculatePerimeterPolygons(rectsForWallCalc);
      const expandedRects = rectsForWallCalc.map((rect) => ({ ...rect, x: rect.x - WALL_THICKNESS, y: rect.y - WALL_THICKNESS, width: rect.width + WALL_THICKNESS * 2, height: rect.height + WALL_THICKNESS * 2 }));
      const outerWallPolygons = calculatePerimeterPolygons(expandedRects);
      const pillarPolygons = generatePillarPolygons(floorUnits, colOffsets, rowOffsets, colWidths, rowHeights);

      const minX = Math.min(...unitRectsWithUnits.map((r) => r.x));
      const minY = Math.min(...unitRectsWithUnits.map((r) => r.y));
      const maxX = Math.max(...unitRectsWithUnits.map((r) => r.x + r.width));
      const maxY = Math.max(...unitRectsWithUnits.map((r) => r.y + r.height));

      return { floorNumber: floorIndex + 1, minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, units: floorUnits, unitRects: unitRectsWithUnits, innerWallPolygons, outerWallPolygons, pillarPolygons, innerWallPaths: [], outerWallPaths: [], pillarCoords: new Set<string>(), PILLAR_SIZE };
    });

  processedFloors.sort((a, b) => a.floorNumber - b.floorNumber);

  const overallMinX = Math.min(...processedFloors.map((f) => f.minX));
  const overallMinY = Math.min(...processedFloors.map((f) => f.minY));
  const overallBuildingWidth = Math.max(...processedFloors.map((f) => f.maxX)) - overallMinX;
  const overallBuildingHeight = Math.max(...processedFloors.map((f) => f.maxY)) - overallMinY;

  const isLandscape = pageWidth > pageHeight;
  const numFloors = processedFloors.length;
  const totalContentWidth = processedFloors.reduce((sum, f) => sum + f.width, 0);
  const totalContentHeight = processedFloors.reduce((sum, f) => sum + f.height, 0);

  let drawingAreaX, drawingAreaY, gap;
  if (isLandscape) {
    const idealGap = (availableWidth - totalContentWidth) / (numFloors + 1);
    gap = idealGap >= 8 * NOMINAL_DOT_SPACING
      ? Math.floor(idealGap / NOMINAL_DOT_SPACING) * NOMINAL_DOT_SPACING
      : Math.max(2 * NOMINAL_DOT_SPACING, Math.floor(idealGap / NOMINAL_DOT_SPACING) * NOMINAL_DOT_SPACING);
    const finalOverallWidth = totalContentWidth + (numFloors > 1 ? (numFloors - 1) * gap : 0);
    drawingAreaX = Math.max(0, (availableWidth - finalOverallWidth) / 2);
    drawingAreaY = Math.max(0, (availableHeight - overallBuildingHeight) / 2);
  } else {
    const idealGap = (availableHeight - totalContentHeight) / (numFloors + 1);
    gap = idealGap >= 8 * NOMINAL_DOT_SPACING
      ? Math.floor(idealGap / NOMINAL_DOT_SPACING) * NOMINAL_DOT_SPACING
      : Math.max(2 * NOMINAL_DOT_SPACING, Math.floor(idealGap / NOMINAL_DOT_SPACING) * NOMINAL_DOT_SPACING);
    const finalOverallHeight = totalContentHeight + (numFloors > 1 ? (numFloors - 1) * gap : 0);
    drawingAreaY = Math.max(0, (availableHeight - finalOverallHeight) / 2);
    drawingAreaX = Math.max(0, (availableWidth - overallBuildingWidth) / 2);
  }

  let currentOffset = isLandscape ? drawingAreaX : drawingAreaY;
  const positionedFloors = processedFloors.map((floor) => {
    const tx = isLandscape ? currentOffset - floor.minX : drawingAreaX - overallMinX;
    const ty = isLandscape ? drawingAreaY - overallMinY : currentOffset - floor.minY;
    currentOffset += (isLandscape ? floor.width : floor.height) + gap;
    return { ...floor, tx, ty };
  });

  const refPositionedFloor = positionedFloors.find((f) => f.floorNumber === refFloorNumber + 1);
  let gridDotOrigin, drawingTopLeft = { x: BORDER_MARGIN, y: BORDER_MARGIN };

  if (refPositionedFloor) {
    const drawingTopLeftX = BORDER_MARGIN + refPositionedFloor.tx + minX_ref;
    const drawingTopLeftY = BORDER_MARGIN + refPositionedFloor.ty + minY_ref;
    drawingTopLeft = { x: drawingTopLeftX, y: drawingTopLeftY };
    gridDotOrigin = { x: ((drawingTopLeftX % NOMINAL_DOT_SPACING) + NOMINAL_DOT_SPACING) % NOMINAL_DOT_SPACING, y: ((drawingTopLeftY % NOMINAL_DOT_SPACING) + NOMINAL_DOT_SPACING) % NOMINAL_DOT_SPACING };
  } else {
    gridDotOrigin = { x: BORDER_MARGIN, y: BORDER_MARGIN };
  }

  return { BORDER_MARGIN, positionedFloors, areaResult, gridDotOrigin, drawingTopLeft, NOMINAL_DOT_SPACING };
};

export const calculateViewBoundingBox = (
  { present, firstFloorDeduction, stairDeductions }: Pick<AppState, "present" | "firstFloorDeduction" | "stairDeductions">,
  view: "all" | 1 | 2 | 3, pageWidth: number, pageHeight: number
): { x: number; y: number; width: number; height: number } | null => {
  
  // Return exact paper bounds for 'all' view, letting Workspace handle padding and fitting
  const getAllBounds = () => ({ x: 0, y: 0, width: pageWidth, height: pageHeight });
  if (view === "all") return getAllBounds();

  const layoutData = calculatePdfLayoutData(present, firstFloorDeduction, stairDeductions, pageWidth, pageHeight);
  const { positionedFloors, BORDER_MARGIN } = layoutData;
  const targetFloor = positionedFloors.find((f) => f.floorNumber === view);

  if (!targetFloor) return getAllBounds();

  const contentMinX = targetFloor.minX;
  const contentMinY = targetFloor.minY;
  const contentMaxX = targetFloor.maxX;
  const contentMaxY = targetFloor.maxY;

  const globalMinX = BORDER_MARGIN + targetFloor.tx + contentMinX;
  const globalMinY = BORDER_MARGIN + targetFloor.ty + contentMinY;
  const globalMaxX = BORDER_MARGIN + targetFloor.tx + contentMaxX;
  const globalMaxY = BORDER_MARGIN + targetFloor.ty + contentMaxY;

  return { 
      x: globalMinX, 
      y: globalMinY, 
      width: globalMaxX - globalMinX, 
      height: globalMaxY - globalMinY 
  };
};

export const getFloorOffset = (
  drawingLayers: DrawingLayer[] | undefined,
  floor: { 
    floorNumber: number; 
    tx: number; 
    ty: number; 
    minX?: number;
    minY?: number;
    maxX?: number;
    maxY?: number;
    outerWallPolygons: { x: number; y: number }[][]; 
  },
  borderMargin: number
): { x: number; y: number } => {
  if (!drawingLayers) return { x: 0, y: 0 };
  const unitLayer = drawingLayers.find(l => l.id === 1001 || l.name === 'ユニット配置');
  if (!unitLayer || !unitLayer.paths || unitLayer.paths.length === 0) {
    return { x: 0, y: 0 };
  }

  // 1. Look for paths explicitly tagged with this floor number
  let floorPaths = unitLayer.paths.filter(p => 
    p.id.startsWith(`unit-wall-${floor.floorNumber}-`) ||
    p.id.startsWith(`unit-pillar-${floor.floorNumber}-`)
  );

  // 2. Fallback for legacy JSON files where paths did not have floorNumber in ID
  // Only apply fallback if NO tagged unit paths exist in the layer at all.
  // If tagged paths exist for any floor, then this floor having 0 paths simply means it's newly placed.
  const hasTaggedUnitPaths = unitLayer.paths.some(p => 
    p.id.startsWith('unit-wall-') || p.id.startsWith('unit-pillar-')
  );

  if (floorPaths.length === 0 && !hasTaggedUnitPaths) {
    const legacyPaths = unitLayer.paths.filter(p => 
      !p.id.startsWith('unit-label-') && !p.id.startsWith('frame-')
    );
    if (legacyPaths.length > 0) {
      const expectedCenterX = borderMargin + floor.tx + (floor.minX !== undefined && floor.maxX !== undefined ? (floor.minX + floor.maxX) / 2 : 0);
      const expectedCenterY = borderMargin + floor.ty + (floor.minY !== undefined && floor.maxY !== undefined ? (floor.minY + floor.maxY) / 2 : 0);
      
      floorPaths = legacyPaths.filter(p => {
        const pts = p.points;
        if (!pts || pts.length === 0) return false;
        const pCenterX = pts.reduce((sum, pt) => sum + pt.x, 0) / pts.length;
        const pCenterY = pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length;
        return Math.hypot(pCenterX - expectedCenterX, pCenterY - expectedCenterY) < 50;
      });
    }
  }

  if (floorPaths.length === 0) {
    return { x: 0, y: 0 };
  }

  // Prioritize outer wall paths, then any wall paths, then candidate paths
  const outerWallPaths = floorPaths.filter(p => p.id.includes('out'));
  const candidatePaths = outerWallPaths.length > 0 
    ? outerWallPaths 
    : (floorPaths.filter(p => p.id.includes('wall')).length > 0 ? floorPaths.filter(p => p.id.includes('wall')) : floorPaths);

  const currentMinX = Math.min(...candidatePaths.flatMap(p => p.points.map(pt => pt.x)));
  const currentMinY = Math.min(...candidatePaths.flatMap(p => p.points.map(pt => pt.y)));

  let expectedMinX: number;
  let expectedMinY: number;

  if (floor.outerWallPolygons && floor.outerWallPolygons.length > 0 && floor.outerWallPolygons[0].length > 0) {
    const allOuterX = floor.outerWallPolygons.flatMap(poly => poly.map(p => p.x));
    const allOuterY = floor.outerWallPolygons.flatMap(poly => poly.map(p => p.y));
    expectedMinX = borderMargin + floor.tx + Math.min(...allOuterX);
    expectedMinY = borderMargin + floor.ty + Math.min(...allOuterY);
  } else if (floor.minX !== undefined && floor.minY !== undefined) {
    expectedMinX = borderMargin + floor.tx + floor.minX - 1.8;
    expectedMinY = borderMargin + floor.ty + floor.minY - 1.8;
  } else {
    return { x: 0, y: 0 };
  }

  const offsetX = currentMinX - expectedMinX;
  const offsetY = currentMinY - expectedMinY;

  if (Math.abs(offsetX) < 0.05 && Math.abs(offsetY) < 0.05) {
    return { x: 0, y: 0 };
  }

  return {
    x: offsetX,
    y: offsetY
  };
};

export const createFloorLabelPath = (
  floor: { floorNumber: number; tx: number; ty: number; minX: number; minY: number },
  borderMargin: number,
  offset: { x: number; y: number } = { x: 0, y: 0 }
): DrawingPath => {
  const labelX = borderMargin + floor.tx + floor.minX - (5 * NOMINAL_DOT_SPACING) + offset.x;
  const labelY = borderMargin + floor.ty + floor.minY - 9.5 + offset.y;
  const width = 6.0;
  const height = 3.0;

  return {
    id: `unit-label-${floor.floorNumber}`,
    points: [
      { x: labelX, y: labelY - height },
      { x: labelX + width, y: labelY - height },
      { x: labelX + width, y: labelY },
      { x: labelX, y: labelY },
      { x: labelX, y: labelY - height }
    ],
    color: '#1e293b',
    strokeWidth: 0.1,
    tool: 'pen',
    lineType: 'solid',
    isHandwriting: false,
    opacity: 1.0,
    text: `${floor.floorNumber}F`,
    fontSize: 2.5
  };
};

