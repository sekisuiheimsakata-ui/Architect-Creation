

import { PaperOrientation, PaperSize } from "./components/PrintLayout";

export interface Unit {
  name: string;
  area: number;
  type: 'main' | 'alpha';
  color: string;
  hexColor: string;
  dimensions: {
    keta: number; // 桁 (horizontal)
    tsuma: number; // 妻 (vertical)
  };
}

export interface PlacedUnit extends Unit {
  id: string; // Unique identifier for each placed unit instance
  vAlign?: 'top' | 'bottom';
  hAlign?: 'left' | 'right';
}

export interface DeductionOption {
  type: 'genkan' | 'stairs';
  label: string;
  value: number;
  conditions: { [key: string]: string };
}

export interface FloorCalculation {
  floorNumber: number;
  totalArea: number; // Truncated to 2 decimal places
  baseUnitArea: number;
  ketamenArea: number;
  tsumamenArea: number;
  tanojiArea: number;
  unitCount: number; // Total units on this floor
  mainUnitCount: number; // Main units (フル/サブ) on this floor
  deductionArea?: number;
  deductionLabel?: string;
}

export interface MultiFloorCalculationResult {
  totalArea: number; // Sum of all truncated floor.totalArea values
  floors: FloorCalculation[];
  totalUnitCount: number;
  totalMainUnitCount: number;
}

export interface DeductionValues {
  [unitType: string]: number;
}

export interface DimensionDeductions {
  [dimension: string]: DeductionValues | number;
}

export interface EntryTypeDeductions {
  [entryType: string]: DimensionDeductions;
}

export interface DeductionMap {
  [size: string]: EntryTypeDeductions;
}

export interface PanZoom {
  scale: number;
  translate: { x: number, y: number };
}

export type AppMode = 'placement' | 'drafting';
export type DrawingTool = 'select' | 'pen' | 'pencil' | 'marker' | 'eraser' | 'bucket';
export type ShapeType = 'line' | 'polyline' | 'rectangle' | 'arc';
export type LineType = 
  | 'solid'
  | 'dotted'
  | 'dashed'
  | 'wavy'
  | 'double'
  | 'child-bearing'
  | 'dash-dot'
  | 'dash-dot-dot';


export interface DrawingPoint {
  x: number;
  y: number;
  isCurve?: boolean;
}

export interface DrawingPath {
  id: string;
  points: DrawingPoint[];
  color: string;
  strokeWidth: number;
  tool: 'pen' | 'pencil' | 'marker';
  lineType: LineType;
  isHandwriting?: boolean;
  fill?: string; // Optional fill color
  fillOpacity?: number; // 0.0 to 1.0
  opacity?: number; // 0.0 to 1.0 (Stroke opacity)
  text?: string; // Text for labels (e.g. 1F, 2F)
  fontSize?: number; // Font size in mm
}

export type LayerVisibility = 'visible' | 'faint' | 'hidden';

export interface DrawingLayer {
  id: number;
  name: string;
  paths: DrawingPath[];
  visibility: LayerVisibility;
  isLocked: boolean;
}

export interface RegisteredPart {
  id: string;
  name: string;
  paths: DrawingPath[]; // Relative to basePoint
  basePoint: DrawingPoint;
  sourcePath: string; // Folder path (e.g., "Furniture/Chairs/" or "" for root)
}

// Updated: added 'naming' step
export type PartRegistrationStep = 'inactive' | 'selectBasePoint' | 'naming';

export interface PartPlacementTransform {
  rotation: number; // degrees
  scale: number;
  flipX: boolean;
  flipY: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ControlPanelRect = Rect;

export interface AppState {
  past: ((PlacedUnit | null)[][][])[];
  present: (PlacedUnit | null)[][][];
  future: ((PlacedUnit | null)[][][])[];
  selectedUnit: Unit | null;
  panZoom: PanZoom;
  fitScale: number; // Scale factor that fits the content to the screen (100%)
  isNewProjectConfirmVisible: boolean;
  isClearUnitsConfirmVisible: boolean;
  isClearDrawingConfirmVisible: boolean;
  isControlPanelOpen: boolean;
  controlPanelRect: ControlPanelRect;
  propertyWindowRect: Rect | null; // Position of property window
  isHelpVisible: boolean;
  isPdfOptionsVisible: boolean;
  isPrintOptionsVisible: boolean;
  isSvgOptionsVisible: boolean;
  isCopilotModalVisible: boolean;
  firstFloorDeduction: DeductionOption | null;
  stairDeductions: { [floorNumber: number]: DeductionOption | null };
  mode: AppMode;
  draftingSettings: {
    size: PaperSize;
    orientation: PaperOrientation;
  };
  drawingLayers: DrawingLayer[];
  drawingLayersPast: DrawingLayer[][];
  drawingLayersFuture: DrawingLayer[][];
  activeDrawingLayer: number;
  activeTool: DrawingTool;
  activeShape: ShapeType;
  penSettings: {
    color: string;
    strokeWidth: number;
    lineType: LineType;
    fill?: string; // Optional fill setting for new shapes
    fillOpacity?: number; // 0.0 to 1.0
    opacity: number; // 0.0 to 1.0
  };
  eraserSettings: {
    strokeWidth: number;
    segmentRadius: number;
  };
  isSnapToGrid: boolean;
  isDraftingSettingsVisible: boolean;
  isHandwritingMode: boolean;
  isSnapToPoints: boolean;
  isSnapToLines: boolean;
  draftingView: 'all' | 1 | 2 | 3;
  viewFitTrigger: number; // Increment to force re-calculation of view fitting
  
  showBaseGrid: boolean;
  showModuleGrid: boolean;

  selectedPathIds: string[];
  registeredParts: RegisteredPart[];
  selectedPartForPlacement: RegisteredPart | null;
  partRegistrationStep: PartRegistrationStep;
  tempRegistrationBasePoint: DrawingPoint | null;
  partPlacementTransform: PartPlacementTransform;
  clipboard: DrawingPath[];
}

export type Action =
  | { type: 'SELECT_UNIT'; payload: Unit | null }
  | { type: 'PLACE_UNIT'; payload: { row: number; col: number; hAlign: 'left' | 'right'; vAlign: 'top' | 'bottom' } }
  | { type: 'DELETE_UNIT'; payload: { row: number; col: number } }
  | { type: 'NEW_PROJECT' }
  | { type: 'CLEAR_UNITS' }
  | { type: 'CLEAR_DRAWING' }
  | { type: 'RESET_VIEW' }
  | { type: 'SET_PAN_ZOOM'; payload: PanZoom }
  | { type: 'SET_FIT_SCALE'; payload: number }
  | { type: 'SHOW_NEW_PROJECT_CONFIRM' }
  | { type: 'HIDE_NEW_PROJECT_CONFIRM' }
  | { type: 'SHOW_CLEAR_UNITS_CONFIRM' }
  | { type: 'HIDE_CLEAR_UNITS_CONFIRM' }
  | { type: 'SHOW_CLEAR_DRAWING_CONFIRM' }
  | { type: 'HIDE_CLEAR_DRAWING_CONFIRM' }
  | { type: 'TOGGLE_CONTROL_PANEL' }
  | { type: 'UPDATE_CONTROL_PANEL_RECT'; payload: ControlPanelRect }
  | { type: 'UPDATE_PROPERTY_WINDOW_RECT'; payload: Rect }
  | { type: 'SHOW_HELP' }
  | { type: 'HIDE_HELP' }
  | { type: 'SHOW_PDF_OPTIONS' }
  | { type: 'HIDE_PDF_OPTIONS' }
  | { type: 'SHOW_PRINT_OPTIONS' }
  | { type: 'HIDE_PRINT_OPTIONS' }
  | { type: 'SHOW_SVG_OPTIONS' }
  | { type: 'HIDE_SVG_OPTIONS' }
  | { type: 'SHOW_COPILOT_MODAL' }
  | { type: 'HIDE_COPILOT_MODAL' }
  | { type: 'SET_DEDUCTION', payload: DeductionOption | null }
  | { type: 'SET_STAIR_DEDUCTION', payload: { floorNumber: number, option: DeductionOption | null } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD_STATE', payload: {
        present: (PlacedUnit | null)[][][],
        firstFloorDeduction: DeductionOption | { label: string; value: number } | null,
        stairDeductions: { [floorNumber: number]: DeductionOption | { label: string; value: number } | null },
        drawingLayers?: DrawingLayer[],
        registeredParts?: RegisteredPart[],
        draftingSettings?: { size: PaperSize; orientation: PaperOrientation },
        showBaseGrid?: boolean,
        showModuleGrid?: boolean,
        showGrid?: boolean,
        controlPanelRect?: ControlPanelRect,
        propertyWindowRect?: Rect
    } }
  | { type: 'SET_MODE'; payload: AppMode }
  | { type: 'SHOW_DRAFTING_SETTINGS' }
  | { type: 'HIDE_DRAFTING_SETTINGS' }
  | { type: 'SET_DRAFTING_SETTINGS'; payload: { size: PaperSize; orientation: PaperOrientation } }
  | { type: 'SET_ACTIVE_TOOL'; payload: DrawingTool }
  | { type: 'SET_ACTIVE_SHAPE'; payload: ShapeType }
  | { type: 'SET_PEN_SETTINGS'; payload: { color?: string; strokeWidth?: number; lineType?: LineType; fill?: string; fillOpacity?: number; opacity?: number; } }
  | { type: 'SET_ERASER_SETTINGS'; payload: { strokeWidth?: number; segmentRadius?: number } }
  | { type: 'SET_ACTIVE_DRAWING_LAYER'; payload: number }
  | { type: 'TOGGLE_LAYER_VISIBILITY'; payload: number }
  | { type: 'TOGGLE_LAYER_LOCK'; payload: number }
  | { type: 'TOGGLE_SNAP_TO_GRID' }
  | { type: 'START_DRAWING_MODIFICATION' }
  | { type: 'UPDATE_PATHS'; payload: { newLayers: DrawingLayer[] } }
  | { type: 'ADD_DRAWING_PATH'; payload: { path: DrawingPath } }
  | { type: 'ADD_DRAWING_PATHS'; payload: { paths: DrawingPath[] } }
  | { type: 'DELETE_DRAWING_PATH'; payload: { pathId: string } }
  | { type: 'UNDO_DRAWING' }
  | { type: 'REDO_DRAWING' }
  | { type: 'TOGGLE_HANDWRITING_MODE' }
  | { type: 'TOGGLE_SNAP_TO_POINTS' }
  | { type: 'TOGGLE_SNAP_TO_LINES' }
  | { type: 'SET_DRAFTING_VIEW'; payload: 'all' | 1 | 2 | 3 }
  | { type: 'RENAME_LAYER'; payload: { layerId: number; newName: string } }
  | { type: 'COPY_LAYER'; payload: { layerId: number } }
  | { type: 'ADD_LAYER' }
  | { type: 'DELETE_LAYER'; payload: { layerId: number } }
  | { type: 'REORDER_LAYERS'; payload: { newOrder: DrawingLayer[] } }
  | { type: 'TOGGLE_BASE_GRID' }
  | { type: 'TOGGLE_MODULE_GRID' }
  | { type: 'TOGGLE_UNITS' }
  | { type: 'PAN'; payload: { dx: number, dy: number } }
  | { type: 'ZOOM_IN_OUT', payload: { direction: 'in' | 'out', centerX: number, centerY: number } }
  | { type: 'ZOOM', payload: { delta: number, mouseX: number, mouseY: number } }
  | { type: 'SELECT_PATHS'; payload: { pathIds: string[]; additive: boolean } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'UPDATE_SELECTED_PATHS'; payload: Partial<DrawingPath> }
  | { type: 'UPDATE_SPECIFIC_PATH'; payload: { pathId: string; updates: Partial<DrawingPath> } }
  | { type: 'SCALE_SELECTION'; payload: { scaleX: number; scaleY: number; centerPoint: DrawingPoint } }
  | { type: 'TRANSFORM_PATHS'; payload: { dx: number; dy: number; isCopy: boolean; transform?: PartPlacementTransform; centerPoint?: DrawingPoint } }
  | { type: 'DELETE_SELECTED_PATHS' }
  | { type: 'MOVE_SELECTED_PATHS_TO_LAYER'; payload: { targetLayerId: number } }
  | { type: 'COPY_SELECTION' }
  | { type: 'CUT_SELECTION' }
  | { type: 'PASTE_SELECTION'; payload?: { position: DrawingPoint } }
  | { type: 'INITIATE_PART_REGISTRATION' }
  | { type: 'PART_REGISTRATION_SET_BASEPOINT'; payload: { basePoint: DrawingPoint } }
  | { type: 'COMPLETE_PART_REGISTRATION'; payload: { name: string; folderPath?: string } }
  | { type: 'CANCEL_PART_REGISTRATION' }
  | { type: 'SELECT_PART_FOR_PLACEMENT'; payload: RegisteredPart | null }
  | { type: 'DELETE_REGISTERED_PART'; payload: { partId: string } }
  | { type: 'RENAME_REGISTERED_PART'; payload: { partId: string; newName: string } }
  | { type: 'REORDER_REGISTERED_PARTS'; payload: { newOrder: RegisteredPart[] } }
  | { type: 'IMPORT_REGISTERED_PARTS'; payload: { parts: RegisteredPart[] } }
  | { type: 'MOVE_PART_TO_FOLDER'; payload: { partId: string; newPath: string } }
  | { type: 'RENAME_FOLDER'; payload: { oldPath: string; newPath: string } }
  | { type: 'DELETE_FOLDER'; payload: { path: string } }
  | { type: 'MOVE_FOLDER'; payload: { sourcePath: string; targetPath: string } }
  | { type: 'ROTATE_PART'; payload: number }
  | { type: 'FLIP_PART'; payload: 'horizontal' | 'vertical' }
  | { type: 'SCALE_PART'; payload: number };


declare global {
  interface Window {
    jspdf: any;
  }
}