

import type { AppState, Action, PlacedUnit, DrawingPath, DrawingLayer, DeductionOption, RegisteredPart, LayerVisibility } from '../types';
import { isPlacementValid } from '../utils/validation';
import { DEDUCTION_OPTIONS, STAIR_DEDUCTION_OPTIONS, PAGE_DIMENSIONS, GRID_ROWS, GRID_COLS, MAX_FLOORS, MIN_SCALE, MAX_SCALE } from '../constants';
import { transformPoints } from '../utils/geometry';
import { calculatePdfLayoutData, getFloorOffset, createFloorLabelPath } from '../utils/layoutCalculator';
import { PaperSize, PaperOrientation } from '../components/PrintLayout';

const initialGrid: (PlacedUnit | null)[][][] = Array.from({ length: MAX_FLOORS }, () =>
  Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null))
);

const createFrameLayer = (size: PaperSize, orientation: PaperOrientation): DrawingLayer => {
    const dim = PAGE_DIMENSIONS[size][orientation];
    const margin = 10;
    
    const tl = { x: margin, y: margin };
    const tr = { x: dim.width - margin, y: margin };
    const br = { x: dim.width - margin, y: dim.height - margin };
    const bl = { x: margin, y: dim.height - margin };

    const commonPathProps = {
        color: '#64748b',
        strokeWidth: 0.7, 
        tool: 'pen' as const,
        lineType: 'solid' as const,
        isHandwriting: false,
        opacity: 1.0
    };

    return {
        id: 1000, // Fixed low ID for frame
        name: '用紙枠',
        visibility: 'visible' as LayerVisibility,
        isLocked: true, // Frame is locked by default
        paths: [
            { ...commonPathProps, id: 'frame-top', points: [tl, tr] },
            { ...commonPathProps, id: 'frame-right', points: [tr, br] },
            { ...commonPathProps, id: 'frame-bottom', points: [br, bl] },
            { ...commonPathProps, id: 'frame-left', points: [bl, tl] },
        ]
    };
};

const createUnitLayer = (
    present: AppState['present'], 
    firstFloorDeduction: AppState['firstFloorDeduction'], 
    stairDeductions: AppState['stairDeductions'],
    size: PaperSize, 
    orientation: PaperOrientation,
    existingLayers?: DrawingLayer[],
    preserveOffsets: boolean = false
): DrawingLayer => {
    const { width, height } = PAGE_DIMENSIONS[size][orientation];
    const layoutData = calculatePdfLayoutData(present, firstFloorDeduction, stairDeductions, width, height);
    
    const BORDER_MARGIN = layoutData.BORDER_MARGIN;
    const paths: DrawingPath[] = [];
    
    const LINE_WIDTH = 0.1;
    const existingUnitLayer = existingLayers?.find(l => l.id === 1001 || l.name === 'ユニット配置');

    layoutData.positionedFloors.forEach(floor => {
        const floorOffset = preserveOffsets ? getFloorOffset(existingLayers, floor, BORDER_MARGIN) : { x: 0, y: 0 };
        const tx = BORDER_MARGIN + floor.tx + floorOffset.x;
        const ty = BORDER_MARGIN + floor.ty + floorOffset.y;

        // Walls
        const addWallPaths = (polygons: any[], isOuter: boolean) => {
            polygons.forEach((poly: any, i: number) => {
                paths.push({
                    id: `unit-wall-${floor.floorNumber}-${isOuter ? 'out' : 'in'}-${i}-${Date.now()}`,
                    points: poly.map((p: any) => ({ x: p.x + tx, y: p.y + ty })),
                    color: '#1e293b',
                    strokeWidth: LINE_WIDTH,
                    tool: 'pen',
                    lineType: 'solid',
                    isHandwriting: false,
                    opacity: 1.0
                });
            });
        };

        addWallPaths(floor.innerWallPolygons, false);
        addWallPaths(floor.outerWallPolygons, true);

        // Pillars
        floor.pillarPolygons.forEach((poly, i) => {
             paths.push({
                id: `unit-pillar-${floor.floorNumber}-${i}-${Date.now()}`,
                points: poly.map((p: any) => ({ x: p.x + tx, y: p.y + ty })),
                color: '#1e293b',
                strokeWidth: LINE_WIDTH,
                tool: 'pen',
                lineType: 'solid',
                isHandwriting: false,
                opacity: 1.0
            });
        });

        // Floor Number Label (e.g. 1F, 2F, 3F)
        // If user already moved the label, keep their custom moved position!
        const existingLabel = existingUnitLayer?.paths.find(p => p.id === `unit-label-${floor.floorNumber}`);
        if (preserveOffsets && existingLabel) {
            paths.push(existingLabel);
        } else {
            paths.push(createFloorLabelPath(floor, BORDER_MARGIN, floorOffset));
        }
    });

    return {
        id: 1001, // Fixed ID for Unit Layer
        name: 'ユニット配置',
        visibility: 'visible' as LayerVisibility,
        isLocked: false, // Unlocked so user can select, move, and rotate units in drafting mode
        paths: paths
    };
};

// Initial setup needs a default unit layer even if empty
const initialUnitLayer = createUnitLayer(initialGrid, null, {}, 'a3', 'landscape');

const initialDrawingLayers: DrawingLayer[] = [
  createFrameLayer('a3', 'landscape'),
  initialUnitLayer,
  { id: Date.now() + 1, name: 'レイヤー 1', paths: [], visibility: 'visible' as LayerVisibility, isLocked: false },
];

export const initialState: AppState = {
  past: [],
  present: initialGrid,
  future: [],
  selectedUnit: null,
  panZoom: { scale: 1, translate: { x: 0, y: 0 } },
  fitScale: 1,
  isNewProjectConfirmVisible: false,
  isClearUnitsConfirmVisible: false,
  isClearDrawingConfirmVisible: false,
  isControlPanelOpen: true,
  controlPanelRect: { x: 10, y: 10, width: 320, height: 600 }, // Initial top-left position
  propertyWindowRect: null, // Position of property window
  isHelpVisible: false,
  isPdfOptionsVisible: false,
  isPrintOptionsVisible: false,
  isSvgOptionsVisible: false,
  isDxfOptionsVisible: false,
  isCopilotModalVisible: false,
  isCadImportModalVisible: false,
  firstFloorDeduction: null,
  stairDeductions: {},
  mode: 'drafting', // Start in drafting mode
  draftingSettings: { size: 'a3', orientation: 'landscape' },
  drawingLayers: initialDrawingLayers,
  drawingLayersPast: [],
  drawingLayersFuture: [],
  activeDrawingLayer: initialDrawingLayers[2]?.id || 0, // Default to the first custom layer
  activeTool: 'pen',
  activeShape: 'line',
  penSettings: { color: '#404040', strokeWidth: 0.1, lineType: 'solid', fill: undefined, opacity: 1.0, fillOpacity: 1.0 }, // Default width 0.1, no fill, opacity 1.0
  eraserSettings: { strokeWidth: 5, segmentRadius: 1.5 },
  isSnapToGrid: true,
  isDraftingSettingsVisible: false,
  isHandwritingMode: true,
  isSnapToPoints: false, // Default OFF
  isSnapToLines: true,
  draftingView: 'all',
  viewFitTrigger: 0,
  
  showBaseGrid: true,
  showModuleGrid: true,

  selectedPathIds: [],
  registeredParts: [],
  selectedPartForPlacement: null,
  partRegistrationStep: 'inactive',
  tempRegistrationBasePoint: null,
  partPlacementTransform: { rotation: 0, scale: 1, flipX: false, flipY: false },
  clipboard: [],
};

// --- Helper Functions for Reducer Decomposition ---

// Helper to regenerate the "Unit Placement" layer and "Paper Frame" based on current state
// Modified to preserve layer order and other properties (like visibility) if they already exist.
const updateSystemLayers = (
    layers: DrawingLayer[], 
    present: AppState['present'], 
    firstFloorDeduction: AppState['firstFloorDeduction'],
    stairDeductions: AppState['stairDeductions'],
    size: PaperSize, 
    orientation: PaperOrientation,
    preserveOffsets: boolean = false
): DrawingLayer[] => {
    const unitLayerContent = createUnitLayer(present, firstFloorDeduction, stairDeductions, size, orientation, layers, preserveOffsets);
    const frameLayerContent = createFrameLayer(size, orientation);
    
    // Check by ID first (robustness for renamed layers), then by Name (legacy support)
    const existingUnitIndex = layers.findIndex(l => l.id === 1001 || l.name === 'ユニット配置');

    const hasUnit = existingUnitIndex !== -1;

    let newLayers = [...layers];

    // Update Unit Layer
    if (hasUnit) {
        newLayers = newLayers.map((l, index) => {
            if (index === existingUnitIndex) {
                return { 
                    ...l, 
                    paths: unitLayerContent.paths,
                    // Ensure ID is normalized to fixed ID if it was legacy
                    id: 1001 
                } as DrawingLayer;
            }
            return l;
        });
    } else {
        // If missing, insert at appropriate place (after frame if exists, or at start)
        // But to keep simple: insert at start if not present
        newLayers.unshift(unitLayerContent);
    }

    // Update Frame Layer
    // Re-evaluate index in case unshift changed things (though map above preserves length)
    const currentFrameIndex = newLayers.findIndex(l => l.id === 1000 || l.name === '用紙枠');
    if (currentFrameIndex !== -1) {
        newLayers = newLayers.map((l, index) => {
            if (index === currentFrameIndex) {
                return { 
                    ...l, 
                    paths: frameLayerContent.paths,
                    id: 1000 
                } as DrawingLayer;
            }
            return l;
        });
    } else {
        newLayers.unshift(frameLayerContent);
    }
    
    return newLayers;
};

const handleUnitPlacement = (state: AppState, action: Extract<Action, { type: 'PLACE_UNIT' }>) => {
    const { past, present, draftingSettings, firstFloorDeduction, stairDeductions } = state;
    if (!state.selectedUnit) return state;
    
    const { row, col, hAlign, vAlign } = action.payload;
    const unitToPlace = state.selectedUnit;
    
    let targetFloor = -1;
    for (let f = 0; f < MAX_FLOORS; f++) {
        if (!present[f][row][col]) {
            targetFloor = f;
            break;
        }
    }
    if (targetFloor === -1 || !isPlacementValid(unitToPlace, present, targetFloor, row, col)) {
        return state;
    }

    const newGrid = present.map(floor => floor.map(r => [...r]));
    newGrid[targetFloor][row][col] = {
        ...unitToPlace,
        id: `${targetFloor}-${row}-${col}-${Date.now()}`,
        hAlign,
        vAlign,
    };
    
    // Regenerate unit layer
    const newLayers = updateSystemLayers(
        state.drawingLayers, newGrid, firstFloorDeduction, stairDeductions, 
        draftingSettings.size, draftingSettings.orientation
    );

    return { 
        ...state, 
        past: [...past, present],
        present: newGrid,
        future: [],
        drawingLayers: newLayers
    };
};

const handleUndoRedo = (state: AppState, type: 'UNDO' | 'REDO' | 'UNDO_DRAWING' | 'REDO_DRAWING') => {
    if (type === 'UNDO') {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, state.past.length - 1);
        
        // Regenerate unit layer for undo
        const newLayers = updateSystemLayers(
            state.drawingLayers, previous, state.firstFloorDeduction, state.stairDeductions,
            state.draftingSettings.size, state.draftingSettings.orientation
        );

        return { ...state, past: newPast, present: previous, future: [state.present, ...state.future], drawingLayers: newLayers };
    }
    if (type === 'REDO') {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const newFuture = state.future.slice(1);

        // Regenerate unit layer for redo
        const newLayers = updateSystemLayers(
            state.drawingLayers, next, state.firstFloorDeduction, state.stairDeductions,
            state.draftingSettings.size, state.draftingSettings.orientation
        );

        return { ...state, past: [...state.past, state.present], present: next, future: newFuture, drawingLayers: newLayers };
    }
    if (type === 'UNDO_DRAWING') {
        if (state.drawingLayersPast.length === 0) return state;
        const previous = state.drawingLayersPast[state.drawingLayersPast.length - 1];
        const newPast = state.drawingLayersPast.slice(0, state.drawingLayersPast.length - 1);
        return { ...state, drawingLayersPast: newPast, drawingLayers: previous, drawingLayersFuture: [state.drawingLayers, ...state.drawingLayersFuture] };
    }
    if (type === 'REDO_DRAWING') {
        if (state.drawingLayersFuture.length === 0) return state;
        const next = state.drawingLayersFuture[0];
        const newFuture = state.drawingLayersFuture.slice(1);
        return { ...state, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayers: next, drawingLayersFuture: newFuture };
    }
    return state;
};

const handleLoadState = (state: AppState, payload: any): AppState => {
    const { present, firstFloorDeduction, stairDeductions, drawingLayers, registeredParts, draftingSettings, showBaseGrid, showModuleGrid, showGrid, controlPanelRect, propertyWindowRect } = payload;

    // Sanitize Grid
    const sanitizedGrid = Array.from({ length: MAX_FLOORS }, (_, floorIndex) => {
        const floor = present?.[floorIndex];
        if (!Array.isArray(floor)) return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
        return Array.from({ length: GRID_ROWS }, (_, rowIndex) => {
            const row = floor[rowIndex];
            if (!Array.isArray(row)) return Array(GRID_COLS).fill(null);
            const sanitizedRow = [...row];
            while(sanitizedRow.length < GRID_COLS) sanitizedRow.push(null);
            return sanitizedRow.slice(0, GRID_COLS);
        });
    });
    
    // Migrate Deductions
    let migratedFirstFloorDeduction: DeductionOption | null = null;
    if (firstFloorDeduction) {
        migratedFirstFloorDeduction = 'type' in firstFloorDeduction 
            ? firstFloorDeduction 
            : DEDUCTION_OPTIONS.find(opt => opt.label === firstFloorDeduction.label) || null;
    }

    const migratedStairDeductions: { [floorNumber: number]: DeductionOption | null } = {};
    const loadedStairs = stairDeductions || {};
    for (const floorNum in loadedStairs) {
        if (Object.prototype.hasOwnProperty.call(loadedStairs, floorNum)) {
            const deduction = loadedStairs[floorNum];
            if (deduction) {
                migratedStairDeductions[Number(floorNum)] = 'type' in deduction 
                    ? deduction 
                    : STAIR_DEDUCTION_OPTIONS.find(opt => opt.label === deduction.label) || null;
            }
        }
    }

    let loadedDrawingLayers: DrawingLayer[] = [];
    if (drawingLayers && drawingLayers.length > 0) {
        loadedDrawingLayers = drawingLayers.map((layer: any, index: number): DrawingLayer => {
            // Migrate visibility
            let visibility: LayerVisibility = 'visible';
            if (layer.visibility === 'hidden' || layer.isVisible === false) {
                visibility = 'hidden';
            } else if (layer.visibility === 'faint') {
                visibility = 'faint';
            } else {
                visibility = 'visible';
            }

            return {
                ...layer,
                id: layer.name === '用紙枠' ? 1000 : (layer.name === 'ユニット配置' ? 1001 : (layer.id || Date.now() + index)),
                name: layer.name || `レイヤー ${index + 1}`,
                visibility,
                // Initialize isLocked if not present. Frame and Unit layers are locked by default.
                isLocked: layer.isLocked !== undefined ? layer.isLocked : (layer.name === '用紙枠' || layer.name === 'ユニット配置'),
                paths: (layer.paths || []).map((path: any) => ({
                    ...path,
                    points: (path.points || []).filter((p: any) => p && typeof p.x === 'number' && typeof p.y === 'number'),
                    isHandwriting: path.isHandwriting !== undefined ? path.isHandwriting : false,
                    fill: path.fill || undefined, 
                    fillOpacity: path.fillOpacity !== undefined ? path.fillOpacity : (path.fill ? 1.0 : undefined), // Handle fill opacity migration
                    opacity: path.opacity !== undefined ? path.opacity : 1.0 // Handle stroke opacity migration
                })) as DrawingPath[]
            };
        });
    } else {
        loadedDrawingLayers = [
            { id: Date.now() + 1, name: 'レイヤー 1', paths: [], visibility: 'visible' as LayerVisibility, isLocked: false } as DrawingLayer
        ];
    }

    // Ensure System Layers exist and are updated based on loaded grid
    // 1. Determine draftingSettings (paper size and orientation)
    let loadedSize = draftingSettings?.size;
    let loadedOrientation = draftingSettings?.orientation;

    if (!loadedSize || !loadedOrientation) {
        const frameLayer = loadedDrawingLayers.find(l => l.id === 1000 || l.name === '用紙枠');
        if (frameLayer && frameLayer.paths.length > 0) {
            const allX = frameLayer.paths.flatMap(p => p.points.map(pt => pt.x));
            const allY = frameLayer.paths.flatMap(p => p.points.map(pt => pt.y));
            if (allX.length > 0 && allY.length > 0) {
                const maxX = Math.max(...allX);
                const maxY = Math.max(...allY);
                const w = maxX + 10;
                const h = maxY + 10;
                if (w > 350) {
                    loadedSize = 'a3';
                    loadedOrientation = 'landscape';
                } else if (h > 350) {
                    loadedSize = 'a3';
                    loadedOrientation = 'portrait';
                } else if (w > 250 && h < 250) {
                    loadedSize = 'a4';
                    loadedOrientation = 'landscape';
                } else if (w < 250 && h > 250) {
                    loadedSize = 'a4';
                    loadedOrientation = 'portrait';
                }
            }
        }
    }

    const effectiveDraftingSettings: { size: PaperSize; orientation: PaperOrientation } = {
        size: loadedSize || state.draftingSettings.size,
        orientation: loadedOrientation || state.draftingSettings.orientation
    };

    // 2. Synchronize and preserve System Layers
    const existingUnitIndex = loadedDrawingLayers.findIndex(l => l.id === 1001 || l.name === 'ユニット配置');
    const existingFrameIndex = loadedDrawingLayers.findIndex(l => l.id === 1000 || l.name === '用紙枠');

    const { width: pWidth, height: pHeight } = PAGE_DIMENSIONS[effectiveDraftingSettings.size][effectiveDraftingSettings.orientation];
    const layoutData = calculatePdfLayoutData(sanitizedGrid, migratedFirstFloorDeduction, migratedStairDeductions, pWidth, pHeight);
    const BORDER_MARGIN = layoutData.BORDER_MARGIN;

    // Check if the loaded JSON already contains a unit placement layer with paths
    if (existingUnitIndex !== -1 && loadedDrawingLayers[existingUnitIndex].paths.length > 0) {
        const unitLayer = loadedDrawingLayers[existingUnitIndex];
        const updatedPaths = [...unitLayer.paths];

        // Normalize IDs: If older JSON paths don't have floorNumber (e.g. `unit-wall-in-0-`),
        // tag them with their floor number based on which floor they belong to
        const needsFloorTagging = updatedPaths.some(p => 
            (p.id.startsWith('unit-wall-') || p.id.startsWith('unit-pillar-')) && 
            !/^unit-(?:wall|pillar)-\d+-/.test(p.id)
        );

        if (needsFloorTagging && layoutData.positionedFloors.length > 0) {
            for (let i = 0; i < updatedPaths.length; i++) {
                const p = updatedPaths[i];
                if ((p.id.startsWith('unit-wall-') || p.id.startsWith('unit-pillar-')) && !/^unit-(?:wall|pillar)-\d+-/.test(p.id)) {
                    if (layoutData.positionedFloors.length === 1) {
                        const fNum = layoutData.positionedFloors[0].floorNumber;
                        updatedPaths[i] = {
                            ...p,
                            id: p.id.replace(/^unit-(wall|pillar)-/, `unit-$1-${fNum}-`)
                        };
                    } else {
                        const pts = p.points;
                        if (pts && pts.length > 0) {
                            const pCenterX = pts.reduce((sum, pt) => sum + pt.x, 0) / pts.length;
                            const pCenterY = pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length;
                            let closestFloor = layoutData.positionedFloors[0];
                            let closestDist = Infinity;
                            for (const f of layoutData.positionedFloors) {
                                const fCenterX = BORDER_MARGIN + f.tx + (f.minX + f.maxX) / 2;
                                const fCenterY = BORDER_MARGIN + f.ty + (f.minY + f.maxY) / 2;
                                const d = Math.hypot(pCenterX - fCenterX, pCenterY - fCenterY);
                                if (d < closestDist) {
                                    closestDist = d;
                                    closestFloor = f;
                                }
                            }
                            updatedPaths[i] = {
                                ...p,
                                id: p.id.replace(/^unit-(wall|pillar)-/, `unit-$1-${closestFloor.floorNumber}-`)
                            };
                        }
                    }
                }
            }
        }

        // Ensure each positioned floor has a movable floor label (unit-label-${floorNumber})
        layoutData.positionedFloors.forEach(floor => {
            const hasLabel = updatedPaths.some(p => p.id === `unit-label-${floor.floorNumber}`);
            if (!hasLabel) {
                const floorOffset = getFloorOffset(loadedDrawingLayers, floor, BORDER_MARGIN);
                updatedPaths.push(createFloorLabelPath(floor, BORDER_MARGIN, floorOffset));
            }
        });

        loadedDrawingLayers[existingUnitIndex] = {
            ...unitLayer,
            id: 1001,
            paths: updatedPaths
        };
    } else {
        // Unit layer is missing or empty, generate from sanitizedGrid
        const generatedUnitLayer = createUnitLayer(
            sanitizedGrid, migratedFirstFloorDeduction, migratedStairDeductions,
            effectiveDraftingSettings.size, effectiveDraftingSettings.orientation,
            loadedDrawingLayers,
            true
        );
        if (existingUnitIndex !== -1) {
            loadedDrawingLayers[existingUnitIndex] = generatedUnitLayer;
        } else {
            loadedDrawingLayers.unshift(generatedUnitLayer);
        }
    }

    // Ensure Frame Layer exists
    if (existingFrameIndex !== -1 && loadedDrawingLayers[existingFrameIndex].paths.length > 0) {
        loadedDrawingLayers[existingFrameIndex] = {
            ...loadedDrawingLayers[existingFrameIndex],
            id: 1000
        };
    } else {
        const frameLayer = createFrameLayer(effectiveDraftingSettings.size, effectiveDraftingSettings.orientation);
        if (existingFrameIndex !== -1) {
            loadedDrawingLayers[existingFrameIndex] = frameLayer;
        } else {
            loadedDrawingLayers.unshift(frameLayer);
        }
    }
    
    // Migrate Parts & Sanitize Points
    const rawParts = Array.isArray(registeredParts) ? registeredParts : [];
    const migratedParts = rawParts.filter((p: any) => p && typeof p === 'object').map((p: any) => ({
        ...p,
        sourcePath: p.sourcePath || "",
        paths: (p.paths || []).map((path: any) => ({
            ...path,
            points: (path.points || []).filter((p: any) => p && typeof p.x === 'number' && typeof p.y === 'number'),
            isHandwriting: path.isHandwriting !== undefined ? path.isHandwriting : false,
            fill: path.fill || undefined,
            fillOpacity: path.fillOpacity !== undefined ? path.fillOpacity : (path.fill ? 1.0 : undefined),
            opacity: path.opacity !== undefined ? path.opacity : 1.0
        }))
    }));
    
    // Migrate Grid Visibility
    const migratedShowBaseGrid = showBaseGrid !== undefined ? showBaseGrid : (showGrid !== undefined ? showGrid : true);
    const migratedShowModuleGrid = showModuleGrid !== undefined ? showModuleGrid : (showGrid !== undefined ? showGrid : true);

    return {
        ...state,
        past: [], future: [], drawingLayersPast: [], drawingLayersFuture: [],
        present: sanitizedGrid,
        firstFloorDeduction: migratedFirstFloorDeduction,
        stairDeductions: migratedStairDeductions,
        drawingLayers: loadedDrawingLayers,
        // Default active layer to first non-system layer if possible
        activeDrawingLayer: loadedDrawingLayers.find(l => l.id > 1001)?.id || loadedDrawingLayers[loadedDrawingLayers.length - 1]?.id || 0,
        selectedPathIds: [],
        registeredParts: migratedParts,
        clipboard: [],
        draftingSettings: effectiveDraftingSettings,
        showBaseGrid: migratedShowBaseGrid,
        showModuleGrid: migratedShowModuleGrid,
        // FORCE RESET VIEW ON LOAD & TRIGGER FIT
        draftingView: 'all',
        viewFitTrigger: state.viewFitTrigger + 1, // Force recalculation
        panZoom: { scale: 1, translate: { x: 0, y: 0 } },
        // Restore Window Positions if available
        controlPanelRect: controlPanelRect || state.controlPanelRect,
        propertyWindowRect: propertyWindowRect || state.propertyWindowRect,
    };
};

// --- Main Reducer ---

export function appReducer(state: AppState, action: Action): AppState {
  const { past, present } = state;

  switch (action.type) {
    // --- Unit Actions ---
    case 'SELECT_UNIT': return { ...state, selectedUnit: action.payload };
    case 'PLACE_UNIT': return handleUnitPlacement(state, action);
    
    case 'DELETE_UNIT': {
      const { row, col } = action.payload;
      let targetFloor = -1;
      for (let f = MAX_FLOORS - 1; f >= 0; f--) {
        if (present[f][row][col]) { targetFloor = f; break; }
      }
      if (targetFloor === -1) return state;
      const newGrid = present.map(floor => floor.map(r => [...r]));
      newGrid[targetFloor][row][col] = null;
      
      // Regenerate unit layer
      const newLayers = updateSystemLayers(
        state.drawingLayers, newGrid, state.firstFloorDeduction, state.stairDeductions,
        state.draftingSettings.size, state.draftingSettings.orientation
      );

      return { ...state, past: [...past, present], present: newGrid, future: [], drawingLayers: newLayers };
    }

    // --- File / System Actions ---
    case 'NEW_PROJECT': {
      const initialUnitLayer = createUnitLayer(initialGrid, null, {}, 'a3', 'landscape');
      const layers = [
          createFrameLayer('a3', 'landscape'),
          initialUnitLayer,
          { id: Date.now() + 1, name: 'レイヤー 1', paths: [], visibility: 'visible' as LayerVisibility, isLocked: false }
      ];
      return { 
        ...initialState, 
        drawingLayers: layers,
        activeDrawingLayer: layers[2].id,
        viewFitTrigger: state.viewFitTrigger + 1
      };
    }
    case 'CLEAR_UNITS': {
        const emptyGrid = Array.from({ length: MAX_FLOORS }, () => Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null)));
        const newLayers = updateSystemLayers(
            state.drawingLayers, emptyGrid, state.firstFloorDeduction, state.stairDeductions,
            state.draftingSettings.size, state.draftingSettings.orientation
        );
        return { ...state, past: [...past, present], present: emptyGrid, future: [], drawingLayers: newLayers };
    }
    case 'CLEAR_DRAWING': 
        return { 
            ...state, 
            // Preserve system layers (Frame 1000, Unit 1001) by ID or Name
            drawingLayers: state.drawingLayers.map(layer => ({ 
                ...layer, 
                paths: (layer.id === 1000 || layer.id === 1001 || layer.name === '用紙枠' || layer.name === 'ユニット配置') ? layer.paths : [] 
            })), 
            drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], 
            drawingLayersFuture: [], selectedPathIds: [] 
        };
    case 'LOAD_STATE': return handleLoadState(state, action.payload);
    
    // --- View & Modals ---
    case 'RESET_VIEW': return { ...state, panZoom: { scale: 1, translate: {x: 0, y: 0 } }, draftingView: 'all', viewFitTrigger: state.viewFitTrigger + 1 };
    case 'SET_PAN_ZOOM': return { ...state, panZoom: action.payload };
    case 'SET_FIT_SCALE': return { ...state, fitScale: action.payload };
    case 'ZOOM': {
        const { delta, mouseX, mouseY } = action.payload;
        const { panZoom } = state;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, panZoom.scale - delta * 0.001));
        const scaleChange = newScale / panZoom.scale;
        return { ...state, panZoom: { scale: newScale, translate: { x: mouseX - (mouseX - panZoom.translate.x) * scaleChange, y: mouseY - (mouseY - panZoom.translate.y) * scaleChange } } };
    }
    case 'ZOOM_IN_OUT': {
      const { direction, centerX, centerY } = action.payload;
      const { panZoom } = state;
      const newScale = direction === 'in' ? Math.min(MAX_SCALE, panZoom.scale * 1.1) : Math.max(MIN_SCALE, panZoom.scale / 1.1);
      const scaleChange = newScale / panZoom.scale;
      return { ...state, panZoom: { scale: newScale, translate: { x: centerX - (centerX - panZoom.translate.x) * scaleChange, y: centerY - (centerY - panZoom.translate.y) * scaleChange } } };
    }
    case 'PAN': return { ...state, panZoom: { ...state.panZoom, translate: { x: state.panZoom.translate.x + action.payload.dx, y: state.panZoom.translate.y + action.payload.dy } } };

    case 'SHOW_NEW_PROJECT_CONFIRM': return { ...state, isNewProjectConfirmVisible: true };
    case 'HIDE_NEW_PROJECT_CONFIRM': return { ...state, isNewProjectConfirmVisible: false };
    case 'SHOW_CLEAR_UNITS_CONFIRM': return { ...state, isClearUnitsConfirmVisible: true };
    case 'HIDE_CLEAR_UNITS_CONFIRM': return { ...state, isClearUnitsConfirmVisible: false };
    case 'SHOW_CLEAR_DRAWING_CONFIRM': return { ...state, isClearDrawingConfirmVisible: true };
    case 'HIDE_CLEAR_DRAWING_CONFIRM': return { ...state, isClearDrawingConfirmVisible: false };
    case 'TOGGLE_CONTROL_PANEL': return { ...state, isControlPanelOpen: !state.isControlPanelOpen };
    case 'UPDATE_CONTROL_PANEL_RECT': return { ...state, controlPanelRect: action.payload };
    case 'UPDATE_PROPERTY_WINDOW_RECT': return { ...state, propertyWindowRect: action.payload };
    case 'SHOW_HELP': return { ...state, isHelpVisible: true };
    case 'HIDE_HELP': return { ...state, isHelpVisible: false };
    case 'SHOW_PDF_OPTIONS': return { ...state, isPdfOptionsVisible: true };
    case 'HIDE_PDF_OPTIONS': return { ...state, isPdfOptionsVisible: false };
    case 'SHOW_PRINT_OPTIONS': return { ...state, isPrintOptionsVisible: true };
    case 'HIDE_PRINT_OPTIONS': return { ...state, isPrintOptionsVisible: false };
    case 'SHOW_SVG_OPTIONS': return { ...state, isSvgOptionsVisible: true };
    case 'HIDE_SVG_OPTIONS': return { ...state, isSvgOptionsVisible: false };
    case 'SHOW_DXF_OPTIONS': return { ...state, isDxfOptionsVisible: true };
    case 'HIDE_DXF_OPTIONS': return { ...state, isDxfOptionsVisible: false };
    case 'SHOW_COPILOT_MODAL': return { ...state, isCopilotModalVisible: true };
    case 'HIDE_COPILOT_MODAL': return { ...state, isCopilotModalVisible: false };
    case 'SHOW_CAD_IMPORT_MODAL': return { ...state, isCadImportModalVisible: true };
    case 'HIDE_CAD_IMPORT_MODAL': return { ...state, isCadImportModalVisible: false };
    case 'IMPORT_CAD_LAYER': {
        const { name, paths } = action.payload;
        const newLayer: DrawingLayer = {
            id: Date.now(),
            name,
            paths,
            visibility: 'visible',
            isLocked: false,
        };
        return {
            ...state,
            drawingLayers: [...state.drawingLayers, newLayer],
            activeDrawingLayer: newLayer.id,
            mode: 'drafting',
            isCadImportModalVisible: false,
            drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers],
            drawingLayersFuture: [],
        };
    }
    
    case 'SET_DEDUCTION': {
        const newState = { ...state, firstFloorDeduction: action.payload };
        const newLayers = updateSystemLayers(
            state.drawingLayers, state.present, action.payload, state.stairDeductions,
            state.draftingSettings.size, state.draftingSettings.orientation
        );
        return { ...newState, drawingLayers: newLayers };
    }
    case 'SET_STAIR_DEDUCTION': {
      const { floorNumber, option } = action.payload;
      const newStairDeductions = { ...state.stairDeductions };
      if (option) newStairDeductions[floorNumber] = option;
      else delete newStairDeductions[floorNumber];
      
      const newLayers = updateSystemLayers(
            state.drawingLayers, state.present, state.firstFloorDeduction, newStairDeductions,
            state.draftingSettings.size, state.draftingSettings.orientation
        );
      
      return { ...state, stairDeductions: newStairDeductions, drawingLayers: newLayers };
    }

    case 'UNDO': case 'REDO': case 'UNDO_DRAWING': case 'REDO_DRAWING': 
        return handleUndoRedo(state, action.type);

    case 'SET_MODE':
      if (state.mode === action.payload) return state;
      return { ...state, mode: action.payload, draftingView: 'all', viewFitTrigger: state.viewFitTrigger + 1, selectedPathIds: [], selectedPartForPlacement: null, partRegistrationStep: 'inactive', partPlacementTransform: { rotation: 0, scale: 1, flipX: false, flipY: false }, panZoom: { scale: 1, translate: { x: 0, y: 0 } } };

    // --- Drafting Settings ---
    case 'SHOW_DRAFTING_SETTINGS': return { ...state, isDraftingSettingsVisible: true };
    case 'HIDE_DRAFTING_SETTINGS': return { ...state, isDraftingSettingsVisible: false };
    case 'SET_DRAFTING_SETTINGS': {
        const { size, orientation } = action.payload;
        const newLayers = updateSystemLayers(
            state.drawingLayers, state.present, state.firstFloorDeduction, state.stairDeductions,
            size, orientation, true
        );
        return { 
            ...state, 
            draftingSettings: action.payload, 
            isDraftingSettingsVisible: false,
            drawingLayers: newLayers,
            drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], 
            drawingLayersFuture: [],
            viewFitTrigger: state.viewFitTrigger + 1
        };
    }
    case 'SET_ACTIVE_TOOL': return { ...state, activeTool: action.payload, selectedPathIds: action.payload !== 'select' ? [] : state.selectedPathIds };
    case 'SET_ACTIVE_SHAPE': return { ...state, activeShape: action.payload };
    case 'SET_PEN_SETTINGS': return { ...state, penSettings: { ...state.penSettings, ...action.payload } };
    case 'SET_ERASER_SETTINGS': return { ...state, eraserSettings: { ...state.eraserSettings, ...action.payload } };
    case 'SET_ACTIVE_DRAWING_LAYER': return { ...state, activeDrawingLayer: action.payload, selectedPathIds: [] };
    case 'TOGGLE_SNAP_TO_GRID': return { ...state, isSnapToGrid: !state.isSnapToGrid };
    case 'TOGGLE_SNAP_TO_POINTS': return { ...state, isSnapToPoints: !state.isSnapToPoints };
    case 'TOGGLE_SNAP_TO_LINES': return { ...state, isSnapToLines: !state.isSnapToLines };
    case 'TOGGLE_HANDWRITING_MODE': return { ...state, isHandwritingMode: !state.isHandwritingMode };
    
    case 'TOGGLE_LAYER_VISIBILITY': {
      const newLayers = state.drawingLayers.map(layer => {
        if (layer.id === action.payload) {
            // Cycle: visible -> faint -> hidden -> visible
            let nextVisibility: LayerVisibility;
            if (layer.visibility === 'visible') nextVisibility = 'faint';
            else if (layer.visibility === 'faint') nextVisibility = 'hidden';
            else nextVisibility = 'visible';
            
            return { ...layer, visibility: nextVisibility };
        }
        return layer;
      });
      return { ...state, drawingLayers: newLayers, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }

    case 'TOGGLE_LAYER_LOCK': {
        const newLayers = state.drawingLayers.map(layer => {
            if (layer.id === action.payload) {
                return { ...layer, isLocked: !layer.isLocked };
            }
            return layer;
        });
        // Clear selection if the locked layer had selected items
        const lockedLayer = newLayers.find(l => l.id === action.payload);
        let newSelectedIds = state.selectedPathIds;
        if (lockedLayer?.isLocked) {
            const idsOnLayer = new Set(lockedLayer.paths.map(p => p.id));
            newSelectedIds = state.selectedPathIds.filter(id => !idsOnLayer.has(id));
        }
        return { ...state, drawingLayers: newLayers, selectedPathIds: newSelectedIds, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }

    // --- Drawing Operations ---
    case 'ADD_DRAWING_PATH': {
      // Check if active layer is locked
      const activeLayer = state.drawingLayers.find(l => l.id === state.activeDrawingLayer);
      if (activeLayer?.isLocked) {
          return state;
      }

      const pathWithProps = { 
          ...action.payload.path, 
          isHandwriting: action.payload.path.isHandwriting !== undefined ? action.payload.path.isHandwriting : state.isHandwritingMode,
          fill: state.penSettings.fill, // Use global fill setting for new paths
          fillOpacity: state.penSettings.fillOpacity, // Use global fill opacity
          opacity: state.penSettings.opacity // Use global stroke opacity
      };
      const newLayers = state.drawingLayers.map(layer => layer.id === state.activeDrawingLayer ? { ...layer, paths: [...layer.paths, pathWithProps] } : layer);
      return { ...state, drawingLayers: newLayers, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }
    case 'ADD_DRAWING_PATHS': {
        // Check lock status
        const activeLayer = state.drawingLayers.find(l => l.id === state.activeDrawingLayer);
        if (activeLayer?.isLocked) return state;

        const pathsWithProps = action.payload.paths.map(p => ({ 
            ...p, 
            isHandwriting: p.isHandwriting !== undefined ? p.isHandwriting : state.isHandwritingMode,
            opacity: p.opacity !== undefined ? p.opacity : (state.penSettings.opacity || 1.0),
            fillOpacity: p.fillOpacity !== undefined ? p.fillOpacity : (state.penSettings.fillOpacity || 1.0)
        }));
        const newLayers = state.drawingLayers.map(layer => layer.id === state.activeDrawingLayer ? { ...layer, paths: [...layer.paths, ...pathsWithProps] } : layer);
        return { ...state, drawingLayers: newLayers, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }
    case 'DELETE_DRAWING_PATH': {
      // Search all layers for the path to delete (allow deleting from any visible layer)
      // Only delete if the layer is 'visible' AND 'unlocked'
      const newLayers = state.drawingLayers.map(layer => 
        (layer.visibility === 'visible' && !layer.isLocked)
            ? { ...layer, paths: layer.paths.filter(p => p.id !== action.payload.pathId) } 
            : layer
      );
      if (JSON.stringify(newLayers) === JSON.stringify(state.drawingLayers)) return state;
      return { ...state, drawingLayers: newLayers, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }
    case 'START_DRAWING_MODIFICATION': return { ...state, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    case 'UPDATE_PATHS': return { ...state, drawingLayers: action.payload.newLayers };
    
    case 'UPDATE_SPECIFIC_PATH': {
        const { pathId, updates } = action.payload;
        const newLayers = state.drawingLayers.map(layer => {
            if (layer.isLocked || layer.visibility === 'hidden') return layer;
            
            const pathIndex = layer.paths.findIndex(p => p.id === pathId);
            if (pathIndex !== -1) {
                const newPaths = [...layer.paths];
                newPaths[pathIndex] = { ...newPaths[pathIndex], ...updates };
                return { ...layer, paths: newPaths };
            }
            return layer;
        });
        
        if (JSON.stringify(newLayers) === JSON.stringify(state.drawingLayers)) return state;
        return { ...state, drawingLayers: newLayers, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }

    // --- Layer Management ---
    case 'RENAME_LAYER': return { ...state, drawingLayers: state.drawingLayers.map(l => l.id === action.payload.layerId ? { ...l, name: action.payload.newName } : l), drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    case 'COPY_LAYER': {
      const layerToCopy = state.drawingLayers.find(l => l.id === action.payload.layerId);
      if (!layerToCopy) return state;
      const newLayer = { ...JSON.parse(JSON.stringify(layerToCopy)), id: Date.now(), name: `${layerToCopy.name} のコピー` };
      const originalIndex = state.drawingLayers.findIndex(l => l.id === action.payload.layerId);
      const newLayers = [...state.drawingLayers.slice(0, originalIndex + 1), newLayer, ...state.drawingLayers.slice(originalIndex + 1)];
      return { ...state, drawingLayers: newLayers, activeDrawingLayer: newLayer.id, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }
    case 'ADD_LAYER': {
      // Generate name: Find lowest available "レイヤー N"
      const existingNames = new Set(state.drawingLayers.map(l => l.name));
      let counter = 1;
      let newName = `レイヤー ${counter}`;
      while (existingNames.has(newName)) {
          counter++;
          newName = `レイヤー ${counter}`;
      }

      const newLayer: DrawingLayer = { 
          id: Date.now(), 
          name: newName, 
          paths: [], 
          visibility: 'visible',
          isLocked: false
      };
      // Append to the end (Top of list/Front)
      return { ...state, drawingLayers: [...state.drawingLayers, newLayer], activeDrawingLayer: newLayer.id, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }
    case 'DELETE_LAYER': {
      const newLayers = state.drawingLayers.filter(l => l.id !== action.payload.layerId);
      if (newLayers.length === 0) {
        const defaultLayer: DrawingLayer = { id: Date.now(), name: 'レイヤー 1', paths: [], visibility: 'visible', isLocked: false };
        return { ...state, drawingLayers: [defaultLayer], activeDrawingLayer: defaultLayer.id, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
      }
      const newActive = state.activeDrawingLayer === action.payload.layerId ? newLayers[0].id : state.activeDrawingLayer;
      return { ...state, drawingLayers: newLayers, activeDrawingLayer: newActive, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }
    case 'REORDER_LAYERS': return { ...state, drawingLayers: action.payload.newOrder, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    case 'SET_DRAFTING_VIEW': return { ...state, draftingView: action.payload, viewFitTrigger: state.viewFitTrigger + 1 };
    
    case 'TOGGLE_BASE_GRID': return { ...state, showBaseGrid: !state.showBaseGrid };
    case 'TOGGLE_MODULE_GRID': return { ...state, showModuleGrid: !state.showModuleGrid };
    case 'TOGGLE_UNITS': return state; // Deprecated

    // --- Selection & Transformation ---
    case 'SELECT_PATHS': {
        const { pathIds, additive } = action.payload;
        // Validation: Ensure selected paths are NOT on locked layers
        const lockedLayerIds = new Set(state.drawingLayers.filter(l => l.isLocked || l.visibility === 'hidden').map(l => l.id));
        
        const validPathIds = pathIds.filter(id => {
            const layer = state.drawingLayers.find(l => l.paths.some(p => p.id === id));
            return layer && !lockedLayerIds.has(layer.id);
        });

        // Calculate property window position logic to prevent flash
        let nextPropertyWindowRect = state.propertyWindowRect;
        if (!nextPropertyWindowRect && validPathIds.length > 0) {
             // Auto-snap to the left of control panel, aligned with stroke section (approx y+160)
             nextPropertyWindowRect = {
                 x: state.controlPanelRect.x,
                 y: state.controlPanelRect.y + 160,
                 width: 240,
                 height: 400
             };
        }

        if (additive) {
            const newSelection = new Set(state.selectedPathIds);
            validPathIds.forEach(id => newSelection.has(id) ? newSelection.delete(id) : newSelection.add(id));
            const newSelectionArray = Array.from(newSelection);
            return { ...state, selectedPathIds: newSelectionArray, propertyWindowRect: nextPropertyWindowRect };
        }
        return { ...state, selectedPathIds: validPathIds, propertyWindowRect: nextPropertyWindowRect };
    }
    case 'CLEAR_SELECTION': return { ...state, selectedPathIds: [], partRegistrationStep: 'inactive' };
    case 'DELETE_SELECTED_PATHS': {
        if (state.selectedPathIds.length === 0) return state;
        // Only delete from visible AND UNLOCKED layers
        const newLayers = state.drawingLayers.map(l => (
            (l.visibility === 'visible' && !l.isLocked)
            ? { ...l, paths: l.paths.filter(p => !state.selectedPathIds.includes(p.id)) }
            : l
        ));
        return { ...state, drawingLayers: newLayers, selectedPathIds: [], drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }
    case 'UPDATE_SELECTED_PATHS': {
        if (state.selectedPathIds.length === 0) return state;
        // Only update on unlocked layers
        const newLayers = state.drawingLayers.map(l => 
            !l.isLocked
            ? { ...l, paths: l.paths.map(p => state.selectedPathIds.includes(p.id) ? { ...p, ...action.payload } : p) }
            : l
        );
        return { ...state, drawingLayers: newLayers, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }
    case 'SCALE_SELECTION': {
        const { scaleX, scaleY, centerPoint } = action.payload;
        if (state.selectedPathIds.length === 0) return state;
        const newLayers = state.drawingLayers.map(l => 
            !l.isLocked
            ? { ...l, paths: l.paths.map(p => !state.selectedPathIds.includes(p.id) ? p : { ...p, points: p.points.map(pt => ({ ...pt, x: centerPoint.x + (pt.x - centerPoint.x) * scaleX, y: centerPoint.y + (pt.y - centerPoint.y) * scaleY })) }) }
            : l
        );
        return { ...state, drawingLayers: newLayers, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }
    case 'TRANSFORM_PATHS': {
        const { dx, dy, isCopy, transform, centerPoint } = action.payload;
        const selectionSet = new Set(state.selectedPathIds);
        const newCopiedIds: string[] = [];
        
        const newLayers = state.drawingLayers.map(layer => {
            if (layer.isLocked) return layer;

            const pathsToTransform = layer.paths.filter(p => selectionSet.has(p.id));
            if (pathsToTransform.length === 0 && isCopy) return layer;
            
            if (isCopy) {
                const newPaths = pathsToTransform.map(path => {
                    const newId = `path-${Date.now()}-${Math.random()}`;
                    newCopiedIds.push(newId);
                    const newPoints = path.points.map(p => {
                        let x = p.x, y = p.y;
                        if (transform && centerPoint) {
                            const trans = transformPoints([{ x: x - centerPoint.x, y: y - centerPoint.y }], transform)[0];
                            x = trans.x + centerPoint.x; y = trans.y + centerPoint.y;
                        }
                        return { ...p, x: x + dx, y: y + dy };
                    });
                    return { ...path, id: newId, points: newPoints };
                });
                return { ...layer, paths: [...layer.paths, ...newPaths] };
            } else {
                return {
                    ...layer,
                    paths: layer.paths.map(path => {
                        if (!selectionSet.has(path.id)) return path;
                        const newPoints = path.points.map(p => {
                            let x = p.x, y = p.y;
                            if (transform && centerPoint) {
                                const trans = transformPoints([{ x: x - centerPoint.x, y: y - centerPoint.y }], transform)[0];
                                x = trans.x + centerPoint.x; y = trans.y + centerPoint.y;
                            }
                            return { ...p, x: x + dx, y: y + dy };
                        });
                        return { ...path, points: newPoints };
                    }),
                };
            }
        });
        return { ...state, drawingLayers: newLayers, selectedPathIds: isCopy ? newCopiedIds : state.selectedPathIds, drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], drawingLayersFuture: [] };
    }
    case 'MOVE_SELECTED_PATHS_TO_LAYER': {
        const { targetLayerId } = action.payload;
        if (state.selectedPathIds.length === 0) return state;
        
        const targetLayer = state.drawingLayers.find(l => l.id === targetLayerId);
        if (!targetLayer || targetLayer.isLocked) return state;

        const pathsToMove: DrawingPath[] = [];
        
        const layersAfterRemoval = state.drawingLayers.map(layer => {
            if (layer.isLocked) return layer; // Cannot take from locked layer
            const remainingPaths = layer.paths.filter(p => !state.selectedPathIds.includes(p.id));
            const movingPaths = layer.paths.filter(p => state.selectedPathIds.includes(p.id));
            pathsToMove.push(...movingPaths);
            return { ...layer, paths: remainingPaths };
        });

        const newLayers = layersAfterRemoval.map(layer => {
            if (layer.id === targetLayerId) {
                return { ...layer, paths: [...layer.paths, ...pathsToMove] };
            }
            return layer;
        });

        return {
            ...state,
            drawingLayers: newLayers,
            drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers],
            drawingLayersFuture: []
        };
    }
    
    case 'COPY_SELECTION': {
        if (state.selectedPathIds.length === 0) return state;
        // Filter from all visible layers (can copy from locked layers)
        const pathsToCopy = state.drawingLayers
            .filter(l => l.visibility !== 'hidden') // Can copy from faint? Yes.
            .flatMap(l => l.paths.filter(p => state.selectedPathIds.includes(p.id)));
        return { ...state, clipboard: pathsToCopy };
    }
    case 'CUT_SELECTION': {
        if (state.selectedPathIds.length === 0) return state;
        // Can only cut from unlocked layers
        const pathsToCut = state.drawingLayers
            .filter(l => l.visibility !== 'hidden' && !l.isLocked)
            .flatMap(l => l.paths.filter(p => state.selectedPathIds.includes(p.id)));
        
        const newLayers = state.drawingLayers.map(l => (
            (l.visibility !== 'hidden' && !l.isLocked)
            ? { ...l, paths: l.paths.filter(p => !state.selectedPathIds.includes(p.id)) }
            : l
        ));
        
        return { 
            ...state, 
            clipboard: pathsToCut, 
            drawingLayers: newLayers, 
            selectedPathIds: [], 
            drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], 
            drawingLayersFuture: [] 
        };
    }
    case 'PASTE_SELECTION': {
        if (state.clipboard.length === 0) return state;
        
        // Paste to active layer
        const activeLayer = state.drawingLayers.find(l => l.id === state.activeDrawingLayer);
        if (activeLayer?.isLocked) {
            alert("アクティブレイヤーがロックされているため貼り付けできません。");
            return state;
        }

        let dx = 5;
        let dy = 5;

        if (action.payload?.position) {
            // Calculate bounds of clipboard to center it on mouse position
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let hasPoints = false;
            state.clipboard.forEach(path => {
                path.points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                    hasPoints = true;
                });
            });

            if (hasPoints) {
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                dx = action.payload.position.x - centerX;
                dy = action.payload.position.y - centerY;
            }
        }
        
        const newPaths = state.clipboard.map(path => ({
            ...path,
            id: `pasted-${Date.now()}-${Math.random()}`,
            points: path.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
        }));
        
        const newIds = newPaths.map(p => p.id);
        
        const newLayers = state.drawingLayers.map(l => 
            l.id === state.activeDrawingLayer 
            ? { ...l, paths: [...l.paths, ...newPaths] }
            : l
        );
        
        return {
            ...state,
            drawingLayers: newLayers,
            selectedPathIds: newIds, // Select the pasted items
            activeTool: 'select', // Switch to select tool automatically
            drawingLayersPast: [...state.drawingLayersPast, state.drawingLayers], 
            drawingLayersFuture: []
        };
    }

    // --- Part Registration ---
    case 'INITIATE_PART_REGISTRATION': return state.selectedPathIds.length === 0 ? state : { ...state, partRegistrationStep: 'selectBasePoint' };
    case 'PART_REGISTRATION_SET_BASEPOINT': return { ...state, partRegistrationStep: 'naming', tempRegistrationBasePoint: action.payload.basePoint };
    case 'COMPLETE_PART_REGISTRATION': {
        const { name, folderPath } = action.payload;
        const basePoint = state.tempRegistrationBasePoint;
        if (!basePoint) return { ...state, partRegistrationStep: 'inactive', tempRegistrationBasePoint: null };
        const selectionSet = new Set(state.selectedPathIds);
        const pathsToRegister = state.drawingLayers.flatMap(l => l.paths.filter(p => selectionSet.has(p.id)));
        const relativePaths = pathsToRegister.map(path => ({ ...path, points: path.points.map(p => ({ ...p, x: p.x - basePoint.x, y: p.y - basePoint.y })) }));
        const newPart: RegisteredPart = { id: `part-${Date.now()}`, name, basePoint, paths: relativePaths, sourcePath: folderPath || "" };
        return { ...state, registeredParts: [...state.registeredParts, newPart], partRegistrationStep: 'inactive', tempRegistrationBasePoint: null, selectedPathIds: [] };
    }
    case 'CANCEL_PART_REGISTRATION': return { ...state, partRegistrationStep: 'inactive', tempRegistrationBasePoint: null };
    case 'SELECT_PART_FOR_PLACEMENT': return { ...state, selectedPartForPlacement: action.payload, partPlacementTransform: { rotation: 0, scale: 1, flipX: false, flipY: false } };
    case 'DELETE_REGISTERED_PART': return { ...state, registeredParts: state.registeredParts.filter(p => p.id !== action.payload.partId), selectedPartForPlacement: state.selectedPartForPlacement?.id === action.payload.partId ? null : state.selectedPartForPlacement };
    case 'RENAME_REGISTERED_PART': {
        let name = action.payload.newName, sourcePath = undefined;
        if (action.payload.newName.includes('/')) { 
            const parts = action.payload.newName.split('/'); 
            name = parts.pop() || action.payload.newName; 
            sourcePath = parts.join('/') + '/'; 
        }
        return { ...state, registeredParts: state.registeredParts.map(p => p.id === action.payload.partId ? { ...p, name, sourcePath: sourcePath !== undefined ? sourcePath : p.sourcePath } : p) };
    }
    case 'REORDER_REGISTERED_PARTS': return { ...state, registeredParts: action.payload.newOrder };
    case 'IMPORT_REGISTERED_PARTS': return { ...state, registeredParts: [...state.registeredParts, ...action.payload.parts] };
    case 'MOVE_PART_TO_FOLDER': return { ...state, registeredParts: state.registeredParts.map(p => p.id === action.payload.partId ? { ...p, sourcePath: action.payload.newPath } : p) };
    case 'RENAME_FOLDER': return { ...state, registeredParts: state.registeredParts.map(p => p.sourcePath.startsWith(action.payload.oldPath) ? { ...p, sourcePath: action.payload.newPath + p.sourcePath.substring(action.payload.oldPath.length) } : p) };
    case 'DELETE_FOLDER': return { ...state, registeredParts: state.registeredParts.filter(p => !p.sourcePath.startsWith(action.payload.path)), selectedPartForPlacement: state.selectedPartForPlacement?.sourcePath.startsWith(action.payload.path) ? null : state.selectedPartForPlacement };
    case 'MOVE_FOLDER': {
        const { sourcePath, targetPath } = action.payload;
        const folderName = sourcePath.split('/').filter(Boolean).pop() || '';
        const newBasePath = targetPath ? targetPath + folderName + '/' : folderName + '/';
        return { ...state, registeredParts: state.registeredParts.map(p => p.sourcePath.startsWith(sourcePath) ? { ...p, sourcePath: newBasePath + p.sourcePath.substring(sourcePath.length) } : p) };
    }
    case 'ROTATE_PART': return { ...state, partPlacementTransform: { ...state.partPlacementTransform, rotation: (state.partPlacementTransform.rotation + action.payload) % 360 } };
    case 'FLIP_PART': return { ...state, partPlacementTransform: { ...state.partPlacementTransform, flipX: action.payload === 'horizontal' ? !state.partPlacementTransform.flipX : state.partPlacementTransform.flipX, flipY: action.payload === 'vertical' ? !state.partPlacementTransform.flipY : state.partPlacementTransform.flipY } };
    case 'SCALE_PART': return { ...state, partPlacementTransform: { ...state.partPlacementTransform, scale: parseFloat(Math.max(0.1, Math.min(5.0, state.partPlacementTransform.scale + action.payload)).toFixed(1)) } };

    default: return state;
  }
}