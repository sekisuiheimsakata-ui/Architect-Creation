import { InputModal } from './InputModal';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAppContext } from "../state/AppContext";
import {
  DrawingPoint,
  DrawingPath,
  PartPlacementTransform,
} from "../types";
import { PAGE_DIMENSIONS } from "../constants";
import {
  getSnapPoint,
  getAngleSnapPoint,
  transformPoints,
  isPointInPolygon,
  getPointsBounds,
  getAllVertices,
  doRectsIntersect,
  Rect,
  getDistance,
  getPointFromPolar,
  getSegmentAngleUnderCursor,
  normalizeAngle,
  generateSvgArc
} from "../utils/geometry";
import {
  pointsToSvgPath,
  getPathAsPoints,
  calculatePdfLayoutData,
} from "../utils/layoutCalculator";
import { PdfLayout } from "./PdfLayout";

const HOVER_HIGHLIGHT_COLOR = "#38bdf8"; // tailwind sky-400
const SELECTION_HIGHLIGHT_COLOR = "#3b82f6"; // tailwind blue-500
const INFO_TEXT_COLOR = "rgba(59, 130, 246, 0.7)"; // Translucent Blue

type DrawingState = {
  isActive: boolean;
  step: number;
  points: DrawingPoint[];
  shiftPressed: boolean;
  spacePressed: boolean;
  isPartialErasing: boolean;
  // Advanced Inputs
  numericInput: string;
  fixedDistance: number | null;
  arcInvert: boolean; // Renamed from arcClockwise. True = Major Arc (inverted shortest path)
};

type MoveOperation = {
  initialSvgPos: DrawingPoint;
  currentSvgPos: DrawingPoint;
  basePoint: DrawingPoint;
  basePointIndex: number;
  availableBasePoints: DrawingPoint[];
  isCopy: boolean;
  transform: PartPlacementTransform;
};

type SelectionBox = {
    start: DrawingPoint;
    current: DrawingPoint;
};

const initialDrawingState: DrawingState = {
  isActive: false, step: 0, points: [], shiftPressed: false, spacePressed: false, isPartialErasing: false,
  numericInput: '', fixedDistance: null, arcInvert: false
};

export const DraftingCanvas: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const {
    draftingSettings, drawingLayers, activeDrawingLayer, activeTool, activeShape,
    penSettings,
    selectedPartForPlacement, partPlacementTransform, panZoom
  } = state;

  const svgRef = useRef<SVGSVGElement>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const drawingStateRef = useRef<DrawingState>({ ...initialDrawingState });
  const [drawingState, setDrawingState] = useState<DrawingState>(initialDrawingState);
  
  const moveOperationRef = useRef<MoveOperation | null>(null);
  const [moveOperation, setMoveOperation] = useState<MoveOperation | null>(null);

  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  const [cursorPos, setCursorPos] = useState<DrawingPoint | null>(null);
  const [snapIndicator, setSnapIndicator] = useState<{ point: DrawingPoint; type: 'grid' | 'point' | 'line' } | null>(null);
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);

  // Refs to access latest cursor state in keyboard event listener
  const cursorPosRef = useRef<DrawingPoint | null>(null);
  const snapIndicatorRef = useRef<{ point: DrawingPoint; type: 'grid' | 'point' | 'line' } | null>(null);
  useEffect(() => { cursorPosRef.current = cursorPos; }, [cursorPos]);
  useEffect(() => { snapIndicatorRef.current = snapIndicator; }, [snapIndicator]);

  // Scale Feedback State
    const [scaleFeedback, setScaleFeedback] = useState<{ text: string; center: DrawingPoint } | null>(null);
  // Alignment (A key) and Angle Tracking State
  const isAKeyDownRef = useRef<boolean>(false);
  const [isAlignModeActive, setIsAlignModeActive] = useState<boolean>(false);
  const pickedBaseAngleRef = useRef<number | null>(null);
  const [angleFeedback, setAngleFeedback] = useState<{ text: string; center: DrawingPoint; angle: number } | null>(null);

  const [textModalPos, setTextModalPos] = useState<DrawingPoint | null>(null);
  const [editingTextPath, setEditingTextPath] = useState<DrawingPath | null>(null);
  const scaleSessionRef = useRef<{ initialScale: number; currentScale: number; timer: number } | null>(null);

  const activeLayer = drawingLayers.find(l => l.id === activeDrawingLayer);
  const isLayerLocked = activeLayer?.isLocked || false;

  const { width: pageWidth, height: pageHeight } = PAGE_DIMENSIONS[draftingSettings.size][draftingSettings.orientation];

  const layoutData = useMemo(() => {
    return calculatePdfLayoutData(
        state.present,
        state.firstFloorDeduction,
        state.stairDeductions,
        pageWidth,
        pageHeight
    );
  }, [state.present, state.firstFloorDeduction, state.stairDeductions, pageWidth, pageHeight]);

  const gridOriginRef = useRef(layoutData.gridDotOrigin);
  useEffect(() => { gridOriginRef.current = layoutData.gridDotOrigin; }, [layoutData]);

  const getSvgMousePos = useCallback((e: React.MouseEvent | MouseEvent): DrawingPoint => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return { x: (e.clientX - CTM.e) / CTM.a, y: (e.clientY - CTM.f) / CTM.d };
  }, []);

  const calculateSnap = useCallback((rawPos: DrawingPoint, excludePathIds: string[] = []): { point: DrawingPoint, type: 'grid' | 'point' | 'line' | null } => {
    const { drawingLayers, isSnapToGrid, isSnapToPoints, isSnapToLines } = stateRef.current;
    if (drawingStateRef.current.shiftPressed) return { point: rawPos, type: null };

    const visiblePaths = drawingLayers
        .filter(l => l.visibility !== 'hidden')
        .flatMap(l => l.paths)
        .filter(p => !excludePathIds.includes(p.id));

    return getSnapPoint(rawPos, visiblePaths, isSnapToGrid, isSnapToPoints, isSnapToLines, false, gridOriginRef.current);
  }, []);

  const findPathUnderCursor = useCallback((cursor: DrawingPoint): DrawingPath | null => {
      const { drawingLayers } = stateRef.current;
      const tolerance = 2.0;

      for (let i = drawingLayers.length - 1; i >= 0; i--) {
          const layer = drawingLayers[i];
          if (layer.visibility === 'hidden' || layer.isLocked) continue;
          
          for (let j = layer.paths.length - 1; j >= 0; j--) {
              const path = layer.paths[j];
              const bounds = getPointsBounds(path.points);
              
              if (cursor.x < bounds.x - tolerance || cursor.x > bounds.x + bounds.width + tolerance ||
                  cursor.y < bounds.y - tolerance || cursor.y > bounds.y + bounds.height + tolerance) {
                  continue;
              }
              
              if (path.text) {
                  return path;
              }
              
              const pointGroups = getPathAsPoints(path, false, false);
              for (const points of pointGroups) {
                  for (let k = 0; k < points.length - 1; k++) {
                      const p1 = points[k], p2 = points[k+1];
                      const l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
                      let t = l2 === 0 ? 0 : ((cursor.x - p1.x) * (p2.x - p1.x) + (cursor.y - p1.y) * (p2.y - p1.y)) / l2;
                      t = Math.max(0, Math.min(1, t));
                      const dist = Math.hypot(cursor.x - (p1.x + t * (p2.x - p1.x)), cursor.y - (p1.y + t * (p2.y - p1.y)));
                      if (dist < tolerance) return path;
                  }
                  if (path.fill && isPointInPolygon(cursor, points)) return path;
              }
          }
      }
      return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    svgRef.current?.focus();

    // Reset scale feedback
    setScaleFeedback(null);
    if (scaleSessionRef.current) { window.clearTimeout(scaleSessionRef.current.timer); scaleSessionRef.current = null; }

    const rawPos = getSvgMousePos(e);
    const snapResult = calculateSnap(rawPos, moveOperationRef.current ? stateRef.current.selectedPathIds : []);
    let pos = snapResult.point;

    // --- Apply Angle Snap and Fixed Distance Constraint if active ---
    if (drawingStateRef.current.isActive && drawingStateRef.current.points.length > 0) {
        const dState = drawingStateRef.current;
        const sState = stateRef.current;
        const lastPoint = dState.points[dState.points.length - 1];
        
        // 1. Angle Snap (Shift)
        if (dState.shiftPressed) {
            if (sState.activeShape === 'arc') {
                pos = getAngleSnapPoint(dState.points[0], pos);
            } else {
                pos = getAngleSnapPoint(lastPoint, pos);
            }
        }

        // 2. Distance Snap (Numeric Input)
        if (dState.fixedDistance !== null) {
            if (sState.activeShape === 'rectangle' && dState.points.length >= 2) {
                // Rectangle Step 2: Use fixed distance as perpendicular height
                const p1 = dState.points[0];
                const p2 = dState.points[1];
                const baseDx = p2.x - p1.x;
                const baseDy = p2.y - p1.y;
                const len = Math.hypot(baseDx, baseDy);
                if (len > 0) {
                    const nx = -baseDy / len;
                    const ny = baseDx / len;
                    const v2p_x = pos.x - p2.x;
                    const v2p_y = pos.y - p2.y;
                    const h = v2p_x * nx + v2p_y * ny;
                    const sign = h >= 0 ? 1 : -1;
                    pos = {
                        x: p2.x + (dState.fixedDistance * sign) * nx,
                        y: p2.y + (dState.fixedDistance * sign) * ny
                    };
                }
            } else {
                // Standard polar projection
                const dx = pos.x - lastPoint.x;
                const dy = pos.y - lastPoint.y;
                const currentAngle = Math.atan2(dy, dx);
                pos = getPointFromPolar(lastPoint, currentAngle, dState.fixedDistance);
            }
        }
    }

    // --- Handle Part Placement ---
    if (stateRef.current.selectedPartForPlacement) {
        const part = stateRef.current.selectedPartForPlacement;
        const transform = stateRef.current.partPlacementTransform;
        dispatch({ 
            type: 'ADD_DRAWING_PATHS', 
            payload: { 
                paths: part.paths.map(p => {
                    const transformedPoints = transformPoints(p.points, transform);
                    return { ...p, id: `placed-${part.id}-${Date.now()}-${Math.random()}`, points: transformedPoints.map(pt => ({ x: pt.x + pos.x, y: pt.y + pos.y })) };
                })
            } 
        });
        return;
    }

    // --- Handle Part Registration ---
    if (stateRef.current.partRegistrationStep === 'selectBasePoint') {
        dispatch({ type: 'PART_REGISTRATION_SET_BASEPOINT', payload: { basePoint: pos } });
        return;
    }

    // --- Handle Drawing Tools ---
    if (['pen', 'pencil', 'marker'].includes(stateRef.current.activeTool)) {
        if (isLayerLocked) return;
        
        const shape = stateRef.current.activeShape;
        const tool = stateRef.current.activeTool;

        // Freehand (Pencil/Marker) - Just start drawing
        if (tool === 'pencil' || tool === 'marker') {
             setDrawingState(prev => {
                const newState = { ...prev, isActive: true, points: [pos], step: 1 };
                drawingStateRef.current = newState;
                return newState;
            });
            return;
        }

        // Geometric Shapes (Pen + Shape)
        if (!drawingStateRef.current.isActive) {
            // Start new shape
            setDrawingState(prev => {
                const newState = { ...prev, isActive: true, points: [pos], step: 1, numericInput: '', fixedDistance: null, arcInvert: false };
                drawingStateRef.current = newState;
                return newState;
            });
        } else {
            // Continue shape
            if (shape === 'line') {
                // Finish line
                finishDrawing(pos);
            } else if (shape === 'polyline') {
                // Add point
                setDrawingState(prev => {
                    const newState = { ...prev, points: [...prev.points, pos], step: prev.step + 1, numericInput: '', fixedDistance: null };
                    drawingStateRef.current = newState;
                    return newState;
                });
            } else if (shape === 'rectangle') {
                if (drawingStateRef.current.step === 1) {
                    // Finish Base Line -> Go to Height
                    setDrawingState(prev => {
                        const newState = { ...prev, points: [...prev.points, pos], step: 2, numericInput: '', fixedDistance: null };
                        drawingStateRef.current = newState;
                        return newState;
                    });
                } else if (drawingStateRef.current.step === 2) {
                    // Finish Height -> Complete
                    finishDrawing(pos); // pos here determines width
                }
            } else if (shape === 'arc') {
                if (drawingStateRef.current.step === 1) {
                    // Set Radius (Start Point)
                    setDrawingState(prev => {
                        const newState = { ...prev, points: [...prev.points, pos], step: 2, numericInput: '', fixedDistance: null };
                        drawingStateRef.current = newState;
                        return newState;
                    });
                } else if (drawingStateRef.current.step === 2) {
                    // Set Angle (End Point) -> Complete
                    finishDrawing(pos);
                }
            }
        }
        return;
    }

    // --- Text Tool (T) ---
    if (stateRef.current.activeTool === 'text') {
        if (isLayerLocked) return;
        const currentText = stateRef.current.textSettings.text?.trim();
        if (currentText) {
            // Place text directly using current settings
            const fs = stateRef.current.textSettings.fontSize || 2.5;
            const estCharWidth = fs * 0.7;
            const estTotalWidth = Math.max(fs, currentText.length * estCharWidth);
            const textPolygon: DrawingPoint[] = [
                { x: pos.x, y: pos.y },
                { x: pos.x + estTotalWidth, y: pos.y },
                { x: pos.x + estTotalWidth, y: pos.y + fs },
                { x: pos.x, y: pos.y + fs },
            ];
            dispatch({
                type: 'ADD_DRAWING_PATH',
                payload: {
                    path: {
                        id: `text-${Date.now()}`,
                        points: textPolygon,
                        color: stateRef.current.textSettings.color || '#1e293b',
                        strokeWidth: 0.1,
                        tool: 'pen',
                        lineType: 'solid',
                        text: currentText,
                        fontSize: fs,
                        fontFamily: stateRef.current.textSettings.fontFamily || 'sans-serif',
                        isHandwriting: false,
                        opacity: 1.0,
                    }
                }
            });
        } else {
            // Open modal to enter text at clicked position
            setTextModalPos(pos);
        }
        return;
    }

    // --- Eraser & Bucket ---
    if (stateRef.current.activeTool === 'eraser') {
        if (isLayerLocked) return;
        if (drawingStateRef.current.spacePressed) {
            setDrawingState(prev => ({ ...prev, isActive: true, isPartialErasing: true, points: [pos] }));
        } else {
            const clickedPath = findPathUnderCursor(rawPos);
            if (clickedPath) dispatch({ type: 'DELETE_DRAWING_PATH', payload: { pathId: clickedPath.id } });
        }
        return;
    }

    if (stateRef.current.activeTool === 'bucket') {
        const clickedPath = findPathUnderCursor(rawPos);
        if (clickedPath) {
            const layer = stateRef.current.drawingLayers.find(l => l.paths.some(p => p.id === clickedPath.id));
            if (layer && !layer.isLocked) {
                dispatch({ type: 'UPDATE_SPECIFIC_PATH', payload: { pathId: clickedPath.id, updates: { fill: stateRef.current.penSettings.fill, fillOpacity: stateRef.current.penSettings.fillOpacity } } });
            }
        }
        return;
    }

    // --- Selection Tool ---
    if (stateRef.current.activeTool === 'select') {
        const clickedPath = findPathUnderCursor(rawPos);

        // --- A-Key Line Angle Sampling / Align Feature ---
        // If 'A' key is held and a target line is clicked, pick its angle and align selection or active part
        if (isAKeyDownRef.current && clickedPath) {
            const pickedAngle = getSegmentAngleUnderCursor(rawPos, clickedPath);
            if (pickedAngle !== null) {
                pickedBaseAngleRef.current = pickedAngle;
                // If placing a registered part:
                if (stateRef.current.selectedPartForPlacement) {
                    dispatch({ type: 'SET_PART_ROTATION', payload: pickedAngle });
                    setAngleFeedback({
                        text: "📐 角度拾い: " + pickedAngle.toFixed(1) + "° (Shift+Rで刻み回転)",
                        center: rawPos,
                        angle: pickedAngle
                    });
                    window.setTimeout(() => setAngleFeedback(null), 2500);
                    return;
                }
                // If moving or has selection:
                if (stateRef.current.selectedPathIds.length > 0) {
                    const selectedPaths = stateRef.current.drawingLayers
                        .flatMap(l => l.paths)
                        .filter(p => stateRef.current.selectedPathIds.includes(p.id));
                    const allPoints: DrawingPoint[] = [];
                    selectedPaths.forEach(path => {
                        const pointGroups = getPathAsPoints(path, false, false);
                        pointGroups.flat().forEach(p => allPoints.push(p));
                    });
                    if (allPoints.length > 0) {
                        const bounds = getPointsBounds(allPoints);
                        const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                        
                        if (moveOperationRef.current) {
                            setMoveOperation(prev => {
                                if (!prev) return null;
                                const ns = { ...prev, transform: { ...prev.transform, rotation: pickedAngle } };
                                moveOperationRef.current = ns;
                                return ns;
                            });
                        } else {
                            // Apply rotation directly to selection around its center
                            dispatch({
                                type: 'TRANSFORM_PATHS',
                                payload: {
                                    dx: 0,
                                    dy: 0,
                                    isCopy: false,
                                    transform: { rotation: pickedAngle, scale: 1, flipX: false, flipY: false },
                                    centerPoint: center
                                }
                            });
                        }
                        setAngleFeedback({
                            text: "📐 角度拾い: " + pickedAngle.toFixed(1) + "° (Shift+Rで刻み回転)",
                            center: center,
                            angle: pickedAngle
                        });
                        window.setTimeout(() => setAngleFeedback(null), 2500);
                        return;
                    }
                }
            }
        }
        if (e.detail === 2 && clickedPath && clickedPath.text !== undefined) {
            // Double click on text entity in select mode opens text editor modal
            setEditingTextPath(clickedPath);
            return;
        }
        
        if (!clickedPath) {
            if (!e.shiftKey) dispatch({ type: 'CLEAR_SELECTION' });
            setSelectionBox({ start: rawPos, current: rawPos });
            return;
        }

        let targetPathIds = [clickedPath.id];
        const floorMatch = clickedPath.id.match(/^unit-(?:wall|pillar|label)-(\d+)/);
        if (floorMatch) {
            const floorNum = floorMatch[1];
            const unitLayer = stateRef.current.drawingLayers.find(l => l.id === 1001 || l.name === 'ユニット配置');
            if (unitLayer) {
                const floorPaths = unitLayer.paths.filter(p => 
                    p.id.startsWith(`unit-wall-${floorNum}-`) ||
                    p.id.startsWith(`unit-pillar-${floorNum}-`) ||
                    p.id.startsWith(`unit-label-${floorNum}`)
                );
                if (floorPaths.length > 0) {
                    targetPathIds = floorPaths.map(p => p.id);
                }
            }
        }

        const isSelected = targetPathIds.every(id => stateRef.current.selectedPathIds.includes(id));
        if (e.shiftKey) {
            dispatch({ type: 'SELECT_PATHS', payload: { pathIds: targetPathIds, additive: true } });
        } else if (!isSelected) {
            dispatch({ type: 'SELECT_PATHS', payload: { pathIds: targetPathIds, additive: false } });
        }

        const currentSelection = e.shiftKey 
            ? [...stateRef.current.selectedPathIds, ...targetPathIds] 
            : (isSelected ? stateRef.current.selectedPathIds : targetPathIds);
        
        const selectedPaths = stateRef.current.drawingLayers.flatMap(l => l.paths).filter(p => currentSelection.includes(p.id));
        const candidates = getAllVertices(selectedPaths);
        candidates.unshift(pos); 

        const op: MoveOperation = {
            initialSvgPos: pos, currentSvgPos: pos, basePoint: pos, basePointIndex: 0,
            availableBasePoints: candidates, isCopy: e.altKey,
            transform: { rotation: 0, scale: 1, flipX: false, flipY: false }
        };
        setMoveOperation(op);
        moveOperationRef.current = op;
    }
  }, [dispatch, getSvgMousePos, calculateSnap, findPathUnderCursor, isLayerLocked]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rawPos = getSvgMousePos(e);
    setCursorPos(rawPos);

    if (selectionBox) {
        setSelectionBox(prev => prev ? { ...prev, current: rawPos } : null);
        return; 
    }

    if (['select', 'eraser', 'bucket'].includes(stateRef.current.activeTool) && !moveOperationRef.current) {
        const path = findPathUnderCursor(rawPos);
        setHoveredPathId(path ? path.id : null);
    } else {
        setHoveredPathId(null);
    }

    const snapExclude = moveOperationRef.current ? stateRef.current.selectedPathIds : [];
    const snapResult = calculateSnap(rawPos, snapExclude);
    setSnapIndicator(snapResult.type ? (snapResult as { point: DrawingPoint; type: 'grid' | 'point' | 'line' }) : null);
    const pos = snapResult.point;

    if (moveOperationRef.current) {
        setMoveOperation(prev => {
            if (!prev) return null;
            const newState = { ...prev, currentSvgPos: pos, isCopy: e.altKey };
            moveOperationRef.current = newState;
            return newState;
        });
    }
  }, [getSvgMousePos, calculateSnap, findPathUnderCursor, selectionBox]);

  const finishDrawing = useCallback((finalPos?: DrawingPoint) => {
      const { points, isPartialErasing, arcInvert, fixedDistance } = drawingStateRef.current;
      const { activeShape, activeTool, penSettings, isHandwritingMode } = stateRef.current;
      
      let effectivePoints = [...points];
      if (finalPos) {
          // Apply constraints to finalPos if needed
          let constrainedPos = finalPos;
          if (fixedDistance !== null && points.length > 0) {
              if (activeShape === 'rectangle' && points.length >= 2) {
                  const p1 = points[0];
                  const p2 = points[1];
                  const baseDx = p2.x - p1.x;
                  const baseDy = p2.y - p1.y;
                  const len = Math.hypot(baseDx, baseDy);
                  if (len > 0) {
                      const nx = -baseDy / len;
                      const ny = baseDx / len;
                      const v2p_x = finalPos.x - p2.x;
                      const v2p_y = finalPos.y - p2.y;
                      const h = v2p_x * nx + v2p_y * ny;
                      const sign = h >= 0 ? 1 : -1;
                      constrainedPos = {
                          x: p2.x + (fixedDistance * sign) * nx,
                          y: p2.y + (fixedDistance * sign) * ny
                      };
                  }
              } else {
                  // Normal distance locking (Line, Arc, Rect Step 1)
                  const last = points[points.length - 1];
                  const angle = Math.atan2(finalPos.y - last.y, finalPos.x - last.x);
                  constrainedPos = getPointFromPolar(last, angle, fixedDistance);
              }
          }
          effectivePoints.push(constrainedPos);
      }

      if (isPartialErasing) {
          setDrawingState(initialDrawingState);
          drawingStateRef.current = initialDrawingState;
          return;
      }

      if (effectivePoints.length < 2) {
          setDrawingState(initialDrawingState);
          drawingStateRef.current = initialDrawingState;
          return;
      }

      let finalPathPoints: DrawingPoint[] = effectivePoints;

      if (activeShape === 'rectangle') {
          if (effectivePoints.length < 3) return;
          const p1 = effectivePoints[0]; // Start
          const p2 = effectivePoints[1]; // Base End
          const p3 = effectivePoints[2]; // Width Definer (Mouse Pos)

          const baseDx = p2.x - p1.x;
          const baseDy = p2.y - p1.y;
          const len = Math.hypot(baseDx, baseDy);
          const nx = -baseDy / len;
          const ny = baseDx / len;

          // Project p3-p2 onto perpendicular
          const v32x = p3.x - p2.x;
          const v32y = p3.y - p2.y;
          const h = v32x * nx + v32y * ny;
          
          // Determine final height: use fixedDistance if set, preserving direction of mouse relative to line
          // If fixedDistance is set, we use its magnitude but keep the sign from 'h' (mouse direction)
          let finalHeight = h;
          if (fixedDistance !== null) {
              const sign = h >= 0 ? 1 : -1;
              finalHeight = fixedDistance * sign;
          }

          const p4 = { x: p1.x + nx * finalHeight, y: p1.y + ny * finalHeight };
          const p3_final = { x: p2.x + nx * finalHeight, y: p2.y + ny * finalHeight };

          finalPathPoints = [p1, p2, p3_final, p4, p1];
      } 
      else if (activeShape === 'arc') {
          if (effectivePoints.length < 3) return;
          const center = effectivePoints[0];
          const start = effectivePoints[1];
          const endIndicator = effectivePoints[2];

          const radius = getDistance(center, start);
          const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
          const endAngle = Math.atan2(endIndicator.y - center.y, endIndicator.x - center.x);

          const numSegments = 64; // Increased for smoother large arcs
          finalPathPoints = [];
          
          // Determine shortest path total angle
          let diff = endAngle - startAngle;
          // Normalize to -PI ... PI
          while (diff <= -Math.PI) diff += 2 * Math.PI;
          while (diff > Math.PI) diff -= 2 * Math.PI;

          let totalAngle = diff;
          if (arcInvert) {
              // Take the long way
              if (diff > 0) totalAngle = diff - 2 * Math.PI;
              else totalAngle = diff + 2 * Math.PI;
          }

          for (let i = 0; i <= numSegments; i++) {
              const t = i / numSegments;
              const ang = startAngle + totalAngle * t;
              finalPathPoints.push(getPointFromPolar(center, ang, radius));
          }
      }

      dispatch({
          type: 'ADD_DRAWING_PATH',
          payload: { path: { 
              id: `path-${Date.now()}`, 
              points: finalPathPoints, 
              color: penSettings.color, 
              strokeWidth: penSettings.strokeWidth, 
              tool: activeTool as any, 
              lineType: penSettings.lineType, 
              isHandwriting: isHandwritingMode, 
              fill: penSettings.fill,
              fillOpacity: penSettings.fillOpacity,
              opacity: penSettings.opacity 
          } }
      });

      setDrawingState(initialDrawingState);
      drawingStateRef.current = initialDrawingState;
  }, [dispatch]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const rawPos = getSvgMousePos(e);
    const snapResult = calculateSnap(rawPos, moveOperationRef.current ? stateRef.current.selectedPathIds : []);
    let pos = snapResult.point;

    // --- Apply Angle Snap and Fixed Distance Constraint if active ---
    if (drawingStateRef.current.isActive && drawingStateRef.current.points.length > 0) {
        const dState = drawingStateRef.current;
        const sState = stateRef.current;
        const lastPoint = dState.points[dState.points.length - 1];
        
        // 1. Angle Snap (Shift)
        if (dState.shiftPressed) {
            if (sState.activeShape === 'arc') {
                pos = getAngleSnapPoint(dState.points[0], pos);
            } else {
                pos = getAngleSnapPoint(lastPoint, pos);
            }
        }

        // 2. Distance Snap (Numeric Input)
        if (dState.fixedDistance !== null) {
            if (sState.activeShape === 'rectangle' && dState.points.length >= 2) {
                // Rectangle Step 2: Use fixed distance as perpendicular height
                const p1 = dState.points[0];
                const p2 = dState.points[1];
                const baseDx = p2.x - p1.x;
                const baseDy = p2.y - p1.y;
                const len = Math.hypot(baseDx, baseDy);
                if (len > 0) {
                    const nx = -baseDy / len;
                    const ny = baseDx / len;
                    const v2p_x = pos.x - p2.x;
                    const v2p_y = pos.y - p2.y;
                    const h = v2p_x * nx + v2p_y * ny;
                    const sign = h >= 0 ? 1 : -1;
                    pos = {
                        x: p2.x + (dState.fixedDistance * sign) * nx,
                        y: p2.y + (dState.fixedDistance * sign) * ny
                    };
                }
            } else {
                // Standard polar projection
                const dx = pos.x - lastPoint.x;
                const dy = pos.y - lastPoint.y;
                const currentAngle = Math.atan2(dy, dx);
                pos = getPointFromPolar(lastPoint, currentAngle, dState.fixedDistance);
            }
        }
    }

    if (selectionBox) {
        const boxRect: Rect = {
            x: Math.min(selectionBox.start.x, selectionBox.current.x),
            y: Math.min(selectionBox.start.y, selectionBox.current.y),
            width: Math.abs(selectionBox.current.x - selectionBox.start.x),
            height: Math.abs(selectionBox.current.y - selectionBox.start.y)
        };

        const selectedIds: string[] = [];
        stateRef.current.drawingLayers.forEach(layer => {
            if (layer.visibility === 'hidden' || layer.isLocked) return;
            layer.paths.forEach(path => {
                const pathBounds = getPointsBounds(path.points);
                if (doRectsIntersect(boxRect, pathBounds)) {
                    selectedIds.push(path.id);
                }
            });
        });

        dispatch({ 
            type: 'SELECT_PATHS', 
            payload: { pathIds: selectedIds, additive: e.shiftKey } 
        });
        setSelectionBox(null);
        return;
    }

    if (drawingStateRef.current.isActive) {
        const tool = stateRef.current.activeTool;
        if (tool === 'pencil' || tool === 'marker' || tool === 'eraser') {
            finishDrawing();
        }
    }

    if (moveOperationRef.current) {
        const op = moveOperationRef.current;
        const dx = op.currentSvgPos.x - op.basePoint.x;
        const dy = op.currentSvgPos.y - op.basePoint.y;
        const hasTransform = op.transform.rotation !== 0 || op.transform.scale !== 1 || op.transform.flipX || op.transform.flipY;
        if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001 || op.isCopy || hasTransform) {
            dispatch({ type: 'TRANSFORM_PATHS', payload: { dx, dy, isCopy: op.isCopy, transform: op.transform, centerPoint: op.basePoint } });
        }
        setMoveOperation(null);
        moveOperationRef.current = null;
    }
  }, [dispatch, getSvgMousePos, calculateSnap, finishDrawing, selectionBox]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
          const isModifier = isMac ? e.metaKey : e.ctrlKey;

          // --- Numeric Input Handling ---
          // Allow digits even if Shift is held (extract from code e.g. Digit1, Numpad1)
          const digitMatch = e.code.match(/^(?:Digit|Numpad)([0-9])$/);
          const isDigit = !!digitMatch;
          const isDecimalOrMinus = e.key === '.' || e.key === '-';

          if (drawingStateRef.current.isActive && (isDigit || isDecimalOrMinus)) {
              const char = isDigit ? digitMatch![1] : e.key;
              setDrawingState(prev => {
                  const ns = { ...prev, numericInput: prev.numericInput + char };
                  drawingStateRef.current = ns; return ns;
              });
              return;
          }
          if (drawingStateRef.current.isActive && e.key === 'Backspace' && drawingStateRef.current.numericInput.length > 0) {
              setDrawingState(prev => {
                  const ns = { ...prev, numericInput: prev.numericInput.slice(0, -1) };
                  drawingStateRef.current = ns; return ns;
              });
              return;
          }

          if (e.key === 'Enter') {
              // If numeric input exists, apply it (Convert mm to internal units /100)
              if (drawingStateRef.current.isActive && drawingStateRef.current.numericInput) {
                  const val = parseFloat(drawingStateRef.current.numericInput);
                  if (!isNaN(val)) {
                      // SPECIAL CASE: Rectangle Step 2 (Width) -> Commit immediately based on mouse direction
                      if (stateRef.current.activeShape === 'rectangle' && drawingStateRef.current.step === 2) {
                          const widthMm = val;
                          const widthUnit = widthMm / 100; // Convert to internal units
                          
                          const p1 = drawingStateRef.current.points[0];
                          const p2 = drawingStateRef.current.points[1];
                          const cursor = cursorPosRef.current || { x: 0, y: 0 };
                          
                          const baseDx = p2.x - p1.x;
                          const baseDy = p2.y - p1.y;
                          const len = Math.hypot(baseDx, baseDy);
                          const nx = -baseDy / len; // Normal vector
                          const ny = baseDx / len;
                          
                          // Project cursor onto normal to get sign
                          const v2c_x = cursor.x - p2.x;
                          const v2c_y = cursor.y - p2.y;
                          const dot = v2c_x * nx + v2c_y * ny;
                          const sign = dot >= 0 ? 1 : -1;
                          
                          // Calculate P3 (Width defining point)
                          // P3 is P2 + normal * width * sign
                          const p3 = {
                              x: p2.x + nx * widthUnit * sign,
                              y: p2.y + ny * widthUnit * sign
                          };
                          
                          finishDrawing(p3);
                          return;
                      }

                      setDrawingState(prev => {
                          const ns = { ...prev, fixedDistance: val / 100, numericInput: '' }; // Convert MM to Units
                          drawingStateRef.current = ns; return ns;
                      });
                  } else {
                      setDrawingState(prev => ({ ...prev, numericInput: '' }));
                  }
                  return;
              }
              
              if (drawingStateRef.current.isActive) {
                  if (stateRef.current.activeShape === 'polyline') {
                      finishDrawing(); 
                  }
              }
              return; 
          }

          // --- Standard Shortcuts ---
          if (e.key === 'Escape') {
              if (selectionBox) {
                  setSelectionBox(null);
              } else if (drawingStateRef.current.isActive) {
                  if (drawingStateRef.current.step > 1) {
                      setDrawingState(prev => {
                          const nextPoints = [...prev.points];
                          nextPoints.pop();
                          const ns = { ...prev, step: prev.step - 1, numericInput: '', fixedDistance: null };
                          drawingStateRef.current = ns; return ns;
                      });
                  } else {
                      setDrawingState(initialDrawingState);
                      drawingStateRef.current = initialDrawingState;
                  }
              } else if (stateRef.current.selectedPartForPlacement) {
                  dispatch({ type: 'SELECT_PART_FOR_PLACEMENT', payload: null });
              } else if (moveOperationRef.current) {
                  setMoveOperation(null);
                  moveOperationRef.current = null;
              } else {
                  dispatch({ type: 'CLEAR_SELECTION' });
              }
              setScaleFeedback(null);
              return;
          }
          
          if (isModifier && (e.key === 'v' || e.key === 'V')) {
              e.preventDefault();
              const pos = snapIndicatorRef.current?.point || cursorPosRef.current;
              if (pos) dispatch({ type: 'PASTE_SELECTION', payload: { position: pos } });
              else dispatch({ type: 'PASTE_SELECTION' });
              return;
          }

          if ((e.key === 'Backspace' || e.key === 'Delete') && !drawingStateRef.current.isActive) {
              if (stateRef.current.selectedPathIds.length > 0) dispatch({ type: 'DELETE_SELECTED_PATHS' });
              return;
          }

          // Arrow keys nudge moving for selected paths
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !drawingStateRef.current.isActive && stateRef.current.selectedPathIds.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              // Standard step: 1.0 (approx 100mm), Shift for large: 4.5 (approx 450mm = 1 module/half), Ctrl/Cmd or Alt for fine: 0.1 (approx 10mm)
              const isFine = isModifier || e.altKey;
              const step = isFine ? 0.1 : (e.shiftKey ? 4.5 : 1.0);
              let dx = 0, dy = 0;
              if (e.key === 'ArrowUp') dy = -step;
              if (e.key === 'ArrowDown') dy = step;
              if (e.key === 'ArrowLeft') dx = -step;
              if (e.key === 'ArrowRight') dx = step;
              dispatch({
                  type: 'TRANSFORM_PATHS',
                  payload: { dx, dy, isCopy: false }
              });
              return;
          }

          if (e.key === 'a' || e.key === 'A') {
              isAKeyDownRef.current = true;
              if (stateRef.current.selectedPathIds.length > 0 || stateRef.current.selectedPartForPlacement) {
                  setIsAlignModeActive(true);
              }
          }
          if (e.key === 'Shift') {
              if (!drawingStateRef.current.shiftPressed) {
                  setDrawingState(prev => {
                      const ns = { ...prev, shiftPressed: true };
                      drawingStateRef.current = ns;
                      return ns;
                  });
              }
          }
          if (e.key === ' ') {
              if (drawingStateRef.current.isActive) { 
                  drawingStateRef.current.spacePressed = true;
                  if (stateRef.current.activeShape === 'arc') {
                      setDrawingState(prev => {
                          const ns = { ...prev, arcInvert: !prev.arcInvert };
                          drawingStateRef.current = ns; return ns;
                      });
                  }
              }
          }

          // Transformation Keys
          const isMoving = !!moveOperationRef.current;
          const isPlacing = !!stateRef.current.selectedPartForPlacement;
          const hasSelection = stateRef.current.selectedPathIds.length > 0;
          let rot = 0, scaleDelta = 0, scaleMultiplier = 1, flipX = false, flipY = false;
          let actionTriggered = false;
          const k = e.key.toLowerCase();

          if (k === 'r') {
              // If Shift is pressed, perform step rotation (15 degrees) relative to picked base angle or standard
              if (e.shiftKey) {
                  rot = 15; // 15-degree increment
              } else {
                  rot = 90; // Standard 90-degree rotation
              }
              actionTriggered = true;
          }
          if (k === 'h') { flipX = true; actionTriggered = true; }
          if (k === 'v') { flipY = true; actionTriggered = true; }
          if (k === 'g') { scaleDelta = -0.1; scaleMultiplier = 0.9; actionTriggered = true; }
          if (k === 'b') { scaleDelta = 0.1; scaleMultiplier = 1.1; actionTriggered = true; }

          if (actionTriggered) {
              e.preventDefault();
              if (isPlacing) {
                  if (rot) dispatch({ type: 'ROTATE_PART', payload: rot });
                  if (scaleDelta) dispatch({ type: 'SCALE_PART', payload: scaleDelta });
                  if (flipX) dispatch({ type: 'FLIP_PART', payload: 'horizontal' });
                  if (flipY) dispatch({ type: 'FLIP_PART', payload: 'vertical' });
              } else if (isMoving && moveOperationRef.current) {
                  setMoveOperation(prev => {
                      if (!prev) return null;
                      const t = prev.transform;
                      const newT = { ...t };
                      if (rot) newT.rotation = (t.rotation + rot) % 360;
                      if (scaleDelta) newT.scale = Math.max(0.1, t.scale + scaleDelta);
                      if (flipX) newT.flipX = !t.flipX;
                      if (flipY) newT.flipY = !t.flipY;
                      const ns = { ...prev, transform: newT };
                      moveOperationRef.current = ns;
                      return ns;
                  });
              } else if (hasSelection && !drawingStateRef.current.isActive) {
                  const selectedPaths = stateRef.current.drawingLayers.flatMap(l => l.paths).filter(p => stateRef.current.selectedPathIds.includes(p.id));
                  const allPoints: DrawingPoint[] = [];
                  selectedPaths.forEach(path => {
                      const pointGroups = getPathAsPoints(path, false, false);
                      pointGroups.flat().forEach(p => allPoints.push(p));
                  });
                  if (allPoints.length > 0) {
                      const bounds = getPointsBounds(allPoints);
                      const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                      dispatch({ type: 'TRANSFORM_PATHS', payload: { dx: 0, dy: 0, isCopy: false, transform: { rotation: rot, scale: scaleMultiplier, flipX, flipY }, centerPoint: center } });
                      if (k === 'g' || k === 'b') {
                          if (!scaleSessionRef.current) { scaleSessionRef.current = { initialScale: 1.0, currentScale: 1.0, timer: 0 }; }
                          window.clearTimeout(scaleSessionRef.current.timer);
                          scaleSessionRef.current.currentScale *= scaleMultiplier;
                          const percentage = Math.round(scaleSessionRef.current.currentScale * 100);
                          setScaleFeedback({ text: `${percentage}%`, center: center });
                          scaleSessionRef.current.timer = window.setTimeout(() => { setScaleFeedback(null); scaleSessionRef.current = null; }, 1500);
                      }
                  }
              }
          }

          if (e.key === 'Tab' && moveOperationRef.current) {
              e.preventDefault();
              setMoveOperation(prev => {
                  if (!prev) return null;
                  const nextIndex = (prev.basePointIndex + 1) % prev.availableBasePoints.length;
                  const ns = { ...prev, basePointIndex: nextIndex, basePoint: prev.availableBasePoints[nextIndex] };
                  moveOperationRef.current = ns; return ns;
              });
          }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
          if (e.key === 'a' || e.key === 'A') {
              isAKeyDownRef.current = false;
              setIsAlignModeActive(false);
          }
          if (e.key === 'Shift') {
              setDrawingState(prev => {
                  const ns = { ...prev, shiftPressed: false };
                  drawingStateRef.current = ns;
                  return ns;
              });
          }
          if (e.key === ' ') drawingStateRef.current.spacePressed = false;
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, [dispatch, selectionBox]);

  const isSelectTool = activeTool === 'select';
  const visualScale = 1 / panZoom.scale;
  const fontSize = 12 * visualScale * 3; // Increased Size (3x base) for visibility
  const unitScale = 100; // Factor to convert internal units to mm

  // --- GHOST & VISUAL FEEDBACK CALCULATIONS ---
  let ghostPath = '';
  let ghostInfoText = '';
  let ghostInfoPos: DrawingPoint | null = null;
  
  // The "Effective Pointer" is the result of Snapping
  let effectiveDraftingPos: DrawingPoint | null = snapIndicator ? { ...snapIndicator.point } : cursorPos ? { ...cursorPos } : null;
  const isDrawingTool = ['line', 'polyline', 'rectangle', 'arc', 'pencil', 'marker'].includes(activeTool);
  
  if ((drawingState.isActive || isDrawingTool) && effectiveDraftingPos) {
      const points = drawingState.points;
      const lastPoint = points.length > 0 ? points[points.length - 1] : null;
      
      // Now apply geometric constraints (Angle Snap, Fixed Distance)
      let constrainedPos = { ...effectiveDraftingPos };

       // 1. Angle Snap (Shift) - Only if we have a reference point
       if (drawingStateRef.current.shiftPressed && lastPoint) {
           if (activeShape === 'arc') {
               constrainedPos = getAngleSnapPoint(points[0], constrainedPos);
           } else {
               constrainedPos = getAngleSnapPoint(lastPoint, constrainedPos);
           }
       }

       // 2. Distance Snap (Numeric Input) - Only if we have a reference point
       if (drawingState.fixedDistance !== null && lastPoint) {
           if (activeShape === 'rectangle' && points.length >= 2) {
               const p1 = points[0];
               const p2 = points[1];
               const baseDx = p2.x - p1.x;
               const baseDy = p2.y - p1.y;
               const len = Math.hypot(baseDx, baseDy);
               if (len > 0) {
                   const nx = -baseDy / len;
                   const ny = baseDx / len;
                   const v2p_x = constrainedPos.x - p2.x;
                   const v2p_y = constrainedPos.y - p2.y;
                   const h = v2p_x * nx + v2p_y * ny;
                   const sign = h >= 0 ? 1 : -1;
                   constrainedPos = {
                       x: p2.x + (drawingState.fixedDistance * sign) * nx,
                       y: p2.y + (drawingState.fixedDistance * sign) * ny
                   };
               }
           } else {
               const ang = Math.atan2(constrainedPos.y - lastPoint.y, constrainedPos.x - lastPoint.x);
               constrainedPos = getPointFromPolar(lastPoint, ang, drawingState.fixedDistance);
           }
       }
       
       // Use the constrained version for ghosting
       const finalGhostPos = constrainedPos;

      // 1. Line / Polyline
      if (activeShape === 'line' || activeShape === 'polyline') {
          if (points.length > 0 && lastPoint) {
              ghostPath = `M ${lastPoint.x} ${lastPoint.y} L ${finalGhostPos.x} ${finalGhostPos.y}`;
              const dist = getDistance(lastPoint, finalGhostPos);
              const angleDeg = normalizeAngle(Math.atan2(finalGhostPos.y - lastPoint.y, finalGhostPos.x - lastPoint.x)) * 180 / Math.PI;
              ghostInfoText = `L:${Math.round(dist * unitScale)}mm A:${angleDeg.toFixed(1)}°`;
              ghostInfoPos = finalGhostPos;
          }
      }
      // 2. Rectangle
      else if (activeShape === 'rectangle') {
          if (drawingState.step === 1) {
              // Base line
              ghostPath = `M ${points[0].x} ${points[0].y} L ${finalGhostPos.x} ${finalGhostPos.y}`;
              const dist = getDistance(points[0], finalGhostPos);
              const angleDeg = normalizeAngle(Math.atan2(finalGhostPos.y - points[0].y, finalGhostPos.x - points[0].x)) * 180 / Math.PI;
              ghostInfoText = `L:${Math.round(dist * unitScale)}mm A:${angleDeg.toFixed(1)}°`;
              ghostInfoPos = finalGhostPos;
          } else if (drawingState.step === 2) {
              // Height
              const p1 = points[0];
              const p2 = points[1];
              // Calc perpendicular height
              const baseDx = p2.x - p1.x;
              const baseDy = p2.y - p1.y;
              const len = Math.hypot(baseDx, baseDy);
              const nx = -baseDy / len;
              const ny = baseDx / len;
              
              // Project cursor-p2 onto normal
              const v2c_x = finalGhostPos.x - p2.x;
              const v2c_y = finalGhostPos.y - p2.y;
              const h = v2c_x * nx + v2c_y * ny;
              
              // Determine final height: use fixedDistance magnitude but respect mouse direction
              let height = h;
              if (drawingState.fixedDistance !== null) {
                  const sign = h >= 0 ? 1 : -1;
                  height = drawingState.fixedDistance * sign;
              }

              const p4 = { x: p1.x + nx * height, y: p1.y + ny * height };
              const p3 = { x: p2.x + nx * height, y: p2.y + ny * height };
              
              ghostPath = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`;
              ghostInfoText = `W:${Math.round(Math.abs(height * unitScale))}mm`;
              ghostInfoPos = p3;
          }
      }
      // 3. Arc
      else if (activeShape === 'arc') {
          if (drawingState.step === 1) {
              // Radius
              ghostPath = `M ${points[0].x} ${points[0].y} L ${finalGhostPos.x} ${finalGhostPos.y}`;
              const r = getDistance(points[0], finalGhostPos);
              ghostInfoText = `R:${Math.round(r * unitScale)}mm`;
              ghostInfoPos = finalGhostPos;
          } else if (drawingState.step === 2) {
              // Angle
              const center = points[0];
              const start = points[1];
              const radius = getDistance(center, start);
              
              const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
              const endAngle = Math.atan2(finalGhostPos.y - center.y, finalGhostPos.x - center.x);
              
              ghostPath = generateSvgArc(center, radius, startAngle, endAngle, drawingState.arcInvert);
              ghostPath += ` M ${center.x} ${center.y} L ${start.x} ${start.y}`;
              const endP = getPointFromPolar(center, endAngle, radius);
              ghostPath += ` M ${center.x} ${center.y} L ${endP.x} ${endP.y}`;

              let diff = endAngle - startAngle;
              // Normalize to -PI ... PI
              while (diff <= -Math.PI) diff += 2 * Math.PI;
              while (diff > Math.PI) diff -= 2 * Math.PI;

              let displayAngle = Math.abs(diff);
              // Adjust display angle for Major Arc
              if (drawingState.arcInvert) {
                  displayAngle = 2 * Math.PI - displayAngle;
              }
              
              ghostInfoText = `A:${(displayAngle * 180 / Math.PI).toFixed(1)}°`;
              ghostInfoPos = endP;
          }
      }
  }

  return (
    <>
    <svg
        ref={svgRef}
        width={pageWidth}
        height={pageHeight}
        viewBox={`0 0 ${pageWidth} ${pageHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        className="bg-white shadow-lg outline-none"
        tabIndex={0}
        style={{ cursor: isSelectTool ? 'default' : 'none', userSelect: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={() => finishDrawing()}
        onContextMenu={(e) => { e.preventDefault(); finishDrawing(); }}
    >
        <defs>
            <filter id="pencilTexture" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" stitchTiles="stitch" result="texture"/>
                <feColorMatrix in="texture" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 8 -3" result="mask"/>
                <feComposite in="SourceGraphic" in2="mask" operator="in" />
            </filter>
        </defs>

        <PdfLayout state={state} pageWidth={pageWidth} pageHeight={pageHeight} renderAsRootSvg={false} moveOperation={moveOperation} />

        <g id="interaction-overlay">
            {/* Hover Effect */}
            {hoveredPathId && !drawingState.isActive && !moveOperation && !selectionBox && (
                state.drawingLayers.flatMap(l => l.paths).filter(p => p.id === hoveredPathId).map(path => {
                    if (path.text) {
                        const bounds = getPointsBounds(path.points);
                        return (
                            <rect
                                key={`hover-${path.id}`}
                                x={bounds.x - 0.5}
                                y={bounds.y - 0.5}
                                width={bounds.width + 1}
                                height={bounds.height + 1}
                                fill="none"
                                stroke={HOVER_HIGHLIGHT_COLOR}
                                strokeWidth={0.5}
                                rx={0.5}
                                pointerEvents="none"
                            />
                        );
                    }
                    return (
                        <path
                            key={`hover-${path.id}`}
                            d={pointsToSvgPath(getPathAsPoints(path, false, true)[0], false)}
                            stroke={HOVER_HIGHLIGHT_COLOR}
                            strokeWidth={(path.strokeWidth || 0.5) + 1}
                            fill="none"
                            opacity={0.5}
                            pointerEvents="none"
                        />
                    );
                })
            )}

            {/* Selection Highlights & Drag Ghost */}
            {state.selectedPathIds.map(id => {
                const path = state.drawingLayers.flatMap(l => l.paths).find(p => p.id === id);
                if (!path) return null;

                if (moveOperation) {
                    const relPoints = path.points.map(p => ({ x: p.x - moveOperation.basePoint.x, y: p.y - moveOperation.basePoint.y }));
                    const transformedRel = transformPoints(relPoints, moveOperation.transform);
                    const finalPoints = transformedRel.map(p => ({ x: p.x + moveOperation.currentSvgPos.x, y: p.y + moveOperation.currentSvgPos.y }));

                    if (path.text) {
                        const bounds = getPointsBounds(finalPoints);
                        const fs = path.fontSize || 2.2;
                        const lines = path.text.split('\n');
                        const isFloorLabel = path.id.startsWith('unit-label-');
                        return (
                            <g key={`ghost-${id}`}>
                                <text
                                    x={bounds.x}
                                    y={bounds.y + fs * 0.85}
                                    fill={HOVER_HIGHLIGHT_COLOR}
                                    fontSize={fs}
                                    fontFamily={path.fontFamily || "sans-serif"}
                                    fontWeight={isFloorLabel ? "bold" : "normal"}
                                    opacity={0.8}
                                    pointerEvents="none"
                                >
                                    {lines.map((line, idx) => (
                                        <tspan
                                            key={idx}
                                            x={bounds.x}
                                            dy={idx === 0 ? 0 : `${fs * 1.25}`}
                                        >
                                            {line}
                                        </tspan>
                                    ))}
                                </text>
                                <rect
                                    x={bounds.x - 0.5}
                                    y={bounds.y - 0.5}
                                    width={bounds.width + 1}
                                    height={bounds.height + 1}
                                    fill="none"
                                    stroke={HOVER_HIGHLIGHT_COLOR}
                                    strokeWidth={0.4}
                                    strokeDasharray="1 1"
                                    rx={0.5}
                                    pointerEvents="none"
                                />
                            </g>
                        );
                    }

                    return (
                        <path
                            key={`ghost-${id}`}
                            d={pointsToSvgPath(finalPoints, false)}
                            stroke={HOVER_HIGHLIGHT_COLOR}
                            strokeWidth={path.strokeWidth}
                            fill="none"
                            opacity={0.8}
                            pointerEvents="none"
                        />
                    );
                } else {
                    if (path.text) {
                        const bounds = getPointsBounds(path.points);
                        return (
                            <rect
                                key={`sel-${id}`}
                                x={bounds.x - 0.5}
                                y={bounds.y - 0.5}
                                width={bounds.width + 1}
                                height={bounds.height + 1}
                                fill="none"
                                stroke={SELECTION_HIGHLIGHT_COLOR}
                                strokeWidth={0.5}
                                strokeDasharray="1 1"
                                rx={0.5}
                                pointerEvents="none"
                            />
                        );
                    }

                    return (
                        <path
                            key={`sel-${id}`}
                            d={pointsToSvgPath(getPathAsPoints(path, false, true)[0], false)}
                            stroke={SELECTION_HIGHLIGHT_COLOR}
                            strokeWidth={(path.strokeWidth || 0.5) + 1.2}
                            fill="none"
                            opacity={0.5}
                            pointerEvents="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    );
                }
            })}

            {/* Active Drawing Ghost */}
            {(drawingState.isActive || isDrawingTool) && (
                <>
                    {/* Existing committed segments for Polyline */}
                    {drawingState.isActive && drawingState.points.length > 1 && activeShape === 'polyline' && (
                        <path 
                            d={pointsToSvgPath(drawingState.points, false)}
                            stroke={penSettings.color}
                            strokeWidth={penSettings.strokeWidth}
                            fill="none"
                            opacity={0.6}
                        />
                    )}
                    
                    {/* Active Ghost Path (Current Step) */}
                    {ghostPath && (
                        <path
                            d={ghostPath}
                            stroke={HOVER_HIGHLIGHT_COLOR}
                            strokeWidth={penSettings.strokeWidth || 0.5}
                            fill="none"
                            opacity={0.8}
                            pointerEvents="none"
                        />
                    )}

                    {/* Info Text (Dimensions/Input) */}
                    {ghostInfoPos && (
                        <g transform={`translate(${ghostInfoPos.x + 2}, ${ghostInfoPos.y - 2})`}>
                            <text fontSize={fontSize} fill={INFO_TEXT_COLOR} fontWeight="bold">
                                {drawingState.numericInput ? `In: ${drawingState.numericInput}mm` : ghostInfoText}
                            </text>
                        </g>
                    )}
                </>
            )}

            {/* Crosshair Cursor (Restored) */}
            {!moveOperation && !selectionBox && effectiveDraftingPos && (
                <g pointerEvents="none">
                    <line x1="0" y1={effectiveDraftingPos.y} x2={pageWidth} y2={effectiveDraftingPos.y} stroke="#ef4444" strokeWidth={0.3} opacity={0.5} />
                    <line x1={effectiveDraftingPos.x} y1="0" x2={effectiveDraftingPos.x} y2={pageHeight} stroke="#ef4444" strokeWidth={0.3} opacity={0.5} />
                </g>
            )}

            {/* Text Tool Preview Ghost */}
            {activeTool === 'text' && effectiveDraftingPos && (
                <g pointerEvents="none" opacity={0.75} transform={`translate(${effectiveDraftingPos.x}, ${effectiveDraftingPos.y})`}>
                    <text
                        x={0}
                        y={(state.textSettings.fontSize || 2.5) * 0.85}
                        fill={state.textSettings.color || '#1e293b'}
                        fontSize={state.textSettings.fontSize || 2.5}
                        fontFamily={state.textSettings.fontFamily || 'sans-serif'}
                        fontWeight="bold"
                    >
                        {state.textSettings.text || 'テキスト入力'}
                    </text>
                    <rect
                        x={-0.5}
                        y={-0.5}
                        width={Math.max((state.textSettings.fontSize || 2.5), (state.textSettings.text || 'テキスト入力').length * (state.textSettings.fontSize || 2.5) * 0.7) + 1}
                        height={(state.textSettings.fontSize || 2.5) + 1}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={0.3}
                        strokeDasharray="1 1"
                        rx={0.5}
                    />
                </g>
            )}

            {/* Placed Part Ghost */}
            {selectedPartForPlacement && cursorPos && (
                <g pointerEvents="none" opacity={0.7}>
                    {selectedPartForPlacement.paths.map((p, i) => {
                        const transformed = transformPoints(p.points, partPlacementTransform);
                        const moved = transformed.map(pt => ({ x: pt.x + cursorPos.x, y: pt.y + cursorPos.y }));
                        return (
                            <path 
                                key={i}
                                d={pointsToSvgPath(moved, false)}
                                stroke={p.color}
                                strokeWidth={p.strokeWidth}
                                fill={p.fill || "none"}
                            />
                        );
                    })}
                </g>
            )}

            {/* Move Markers */}
            {moveOperation && (
                <g transform={`translate(${moveOperation.currentSvgPos.x}, ${moveOperation.currentSvgPos.y})`} pointerEvents="none">
                    <circle r={2} stroke={HOVER_HIGHLIGHT_COLOR} strokeWidth={0.5} fill="none" />
                </g>
            )}

            {/* Scale Feedback */}
            {scaleFeedback && (
                <text
                    x={scaleFeedback.center.x}
                    y={scaleFeedback.center.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={SELECTION_HIGHLIGHT_COLOR}
                    stroke="white"
                    strokeWidth={0.5}
                    paintOrder="stroke"
                    fontSize={fontSize * 1.5}
                    fontWeight="bold"
                    pointerEvents="none"
                    opacity={0.9}
                >
                    {scaleFeedback.text}
                </text>
            )}
            {/* Angle Alignment Feedback */}
            {angleFeedback && (
                <g pointerEvents="none">
                    <text
                        x={angleFeedback.center.x}
                        y={angleFeedback.center.y - 4}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#2563eb"
                        stroke="white"
                        strokeWidth={0.6}
                        paintOrder="stroke"
                        fontSize={fontSize * 1.3}
                        fontWeight="bold"
                        opacity={0.95}
                    >
                        {angleFeedback.text}
                    </text>
                </g>
            )}
            {/* Alignment Mode Active Guide Banner */}
            {isAlignModeActive && cursorPos && (
                <g pointerEvents="none" transform={`translate(${cursorPos.x + 3}, ${cursorPos.y + 3})`}>
                    <rect x={0} y={-3.5} width={38} height={4.8} rx={1} fill="#1e293b" opacity={0.85} />
                    <text x={2} y={0} fill="#ffffff" fontSize={2.2} fontWeight="bold">
                        [A] クリックで線の角度を拾う
                    </text>
                </g>
            )}

            {/* Selection Box */}
            {selectionBox && (
                <rect
                    x={Math.min(selectionBox.start.x, selectionBox.current.x)}
                    y={Math.min(selectionBox.start.y, selectionBox.current.y)}
                    width={Math.abs(selectionBox.current.x - selectionBox.start.x)}
                    height={Math.abs(selectionBox.current.y - selectionBox.start.y)}
                    fill="#3b82f6"
                    fillOpacity="0.2"
                    stroke="#3b82f6"
                    strokeWidth="0.2"
                    strokeDasharray="2 2"
                    pointerEvents="none"
                />
            )}

            {/* Snap Indicators */}
            {effectiveDraftingPos && snapIndicator && (
                <g transform={`translate(${effectiveDraftingPos.x}, ${effectiveDraftingPos.y})`} pointerEvents="none">
                    {snapIndicator.type === 'point' && <circle r={1} fill="none" stroke="#ef4444" strokeWidth={0.3} opacity="0.8" />}
                    {snapIndicator.type === 'line' && <circle r={1} fill="none" stroke="#3b82f6" strokeWidth={0.3} opacity="0.8" />}
                    {snapIndicator.type === 'grid' && <circle r={1} fill="none" stroke="#f59e0b" strokeWidth={0.3} opacity="0.8" />}
                </g>
            )}
        </g>
    </svg>
    {/* Text Tool Input Modal */}
    <InputModal
        isOpen={!!textModalPos}
        title="文字の配置"
        placeholder="配置する文字を入力..."
        defaultValue={state.textSettings.text}
        onClose={() => setTextModalPos(null)}
        onConfirm={(val) => {
            if (textModalPos && val.trim()) {
                const fs = state.textSettings.fontSize || 2.5;
                const estCharWidth = fs * 0.7;
                const estTotalWidth = Math.max(fs, val.trim().length * estCharWidth);
                const textPolygon: DrawingPoint[] = [
                    { x: textModalPos.x, y: textModalPos.y },
                    { x: textModalPos.x + estTotalWidth, y: textModalPos.y },
                    { x: textModalPos.x + estTotalWidth, y: textModalPos.y + fs },
                    { x: textModalPos.x, y: textModalPos.y + fs },
                ];
                dispatch({
                    type: 'ADD_DRAWING_PATH',
                    payload: {
                        path: {
                            id: `text-${Date.now()}`,
                            points: textPolygon,
                            color: state.textSettings.color || '#1e293b',
                            strokeWidth: 0.1,
                            tool: 'pen',
                            lineType: 'solid',
                            text: val.trim(),
                            fontSize: fs,
                            fontFamily: state.textSettings.fontFamily || 'sans-serif',
                            isHandwriting: false,
                            opacity: 1.0,
                        }
                    }
                });
                dispatch({ type: 'SET_TEXT_SETTINGS', payload: { text: val.trim() } });
            }
            setTextModalPos(null);
        }}
        confirmText="配置"
    />
    {/* Text Entity Edit Modal */}
    <InputModal
        isOpen={!!editingTextPath}
        title={editingTextPath?.id.startsWith('unit-area-summary') ? "図面情報・面積データの編集" : "文字の編集"}
        defaultValue={editingTextPath?.text || ''}
        placeholder={editingTextPath?.id.startsWith('unit-area-summary') ? "面積・縮尺・図面情報を入力..." : "文字を入力..."}
        onClose={() => setEditingTextPath(null)}
        onConfirm={(val) => {
            if (editingTextPath && val.trim()) {
                const fs = editingTextPath.fontSize || 1.8;
                const lines = val.trim().split('\n');
                let maxLineW = 0;
                for (const line of lines) {
                    let lineW = 0;
                    for (const ch of line) {
                        lineW += ch.charCodeAt(0) > 255 ? fs * 1.05 : fs * 0.6;
                    }
                    if (lineW > maxLineW) maxLineW = lineW;
                }
                const totalW = Math.max(fs, maxLineW);
                const totalH = Math.max(fs, lines.length * fs * 1.25);
                const minX = Math.min(...editingTextPath.points.map(p => p.x));
                const minY = Math.min(...editingTextPath.points.map(p => p.y));
                const updatedPolygon: DrawingPoint[] = [
                    { x: minX, y: minY },
                    { x: minX + totalW, y: minY },
                    { x: minX + totalW, y: minY + totalH },
                    { x: minX, y: minY + totalH },
                    { x: minX, y: minY },
                ];
                dispatch({
                    type: 'UPDATE_SPECIFIC_PATH',
                    payload: {
                        pathId: editingTextPath.id,
                        updates: {
                            text: val.trim(),
                            points: updatedPolygon,
                            isCustomText: true,
                        }
                    }
                });
            }
            setEditingTextPath(null);
        }}
        confirmText="更新"
    />
    </>
  );
};
