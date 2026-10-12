
import React, { useState, useRef, useMemo, memo } from 'react';
import { useAppContext } from '../state/AppContext';
import { DrawingLayer, LineType } from '../types';
import {
    EyeOpenIcon, EyeClosedIcon, PenIcon, TextIcon, EraserIcon, BucketIcon,
    SnapPointIcon, RectangleIcon, ArcIcon, SnapLineIcon,
    LineIcon, PolylineIcon, ChevronDownIcon, PlusIcon, TrashIcon, DragHandleIcon,
    GridDotsIcon, GridLinesIcon, CopyIcon, SelectIcon,
    LockClosedIcon, LockOpenIcon, HelpPencilIcon, XCircleIcon
} from './Icons';
import { PartSelector } from './PartSelector';
import { InputModal } from './InputModal';
import { ConfirmModal } from './ConfirmModal';

// Helper component for small header icons
const HeaderIconButton: React.FC<{
    isActive?: boolean;
    onClick: (e: React.MouseEvent) => void;
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
}> = ({ isActive, onClick, children, title, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-6 h-6 flex items-center justify-center rounded-sm transition-colors shrink-0 ${
            isActive 
                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300 z-10' 
                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        title={title}
    >
        {children}
    </button>
);

// --- Collapsible Section Component ---
interface ToolbarSectionProps {
    title: string;
    children?: React.ReactNode;
    inlineContent?: React.ReactNode; // Content next to title
    collapsible?: boolean;
    defaultOpen?: boolean;
    headerActions?: React.ReactNode; // Actions on the far right
}

const ToolbarSection: React.FC<ToolbarSectionProps> = ({ title, children, inlineContent, collapsible = true, defaultOpen = true, headerActions }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    // If not collapsible, force visible if children exist
    const isContentVisible = !collapsible || isOpen;

    return (
        <div className="border-b border-slate-100 last:border-0 pb-1">
            <div 
                className={`flex items-center justify-between px-1 py-0.5 rounded-md select-none ${collapsible ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                onClick={collapsible ? () => setIsOpen(prev => !prev) : undefined}
            >
                {/* Left: Title */}
                <h3 className="text-xs font-bold text-slate-600 shrink-0 mr-2">{title}</h3>
                
                {/* Right: Icons & Actions */}
                <div className="flex items-center space-x-0.5 justify-end flex-grow min-w-0" onClick={e => e.stopPropagation()}>
                    {inlineContent && (
                        <div className="flex items-center space-x-0.5 shrink-0">
                            {inlineContent}
                        </div>
                    )}
                    {headerActions && (
                        <div className="flex items-center space-x-0.5 shrink-0">
                            {headerActions}
                        </div>
                    )}
                    {collapsible && (
                        <div 
                            className="pl-1 text-slate-400 flex items-center justify-center w-5 h-5 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(prev => !prev);
                            }}
                        >
                            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                    )}
                </div>
            </div>
            {children && (
                <div className={`grid transition-all duration-300 ease-in-out ${isContentVisible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden px-1">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};


interface LayerItemProps {
  layer: DrawingLayer;
  isActive: boolean;
  dragIndicatorPosition: 'top' | 'bottom' | null;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onRenameRequest: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

const LayerItem: React.FC<LayerItemProps> = memo(({ 
    layer, isActive, dragIndicatorPosition, 
    onSelect, onToggleVisibility, onToggleLock, onCopy, onDelete, onRenameRequest,
    onDragStart, onDragOver, onDragLeave, onDrop 
}) => {
    return (
        <div className="relative">
            {dragIndicatorPosition === 'top' && (
                <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 z-10"></div>
            )}
            <div
                onClick={onSelect}
                className={`group relative flex items-center space-x-2 p-1.5 rounded-sm cursor-pointer transition-colors ${isActive ? 'bg-blue-100 ring-1 ring-blue-300' : 'hover:bg-slate-200'}`}
                draggable={true}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                {/* Drag Handle */}
                <div 
                    className="text-slate-400 cursor-grab active:cursor-grabbing shrink-0" 
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <DragHandleIcon className="w-4 h-4"/>
                </div>

                {/* Visibility */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
                    className="p-0.5 rounded-sm hover:bg-slate-300 text-slate-600 shrink-0"
                    title={layer.visibility === 'visible' ? "表示中" : (layer.visibility === 'faint' ? "半透明" : "非表示")}
                >
                    {layer.visibility === 'visible' && <EyeOpenIcon className="w-4 h-4"/>}
                    {layer.visibility === 'faint' && <EyeOpenIcon className="w-4 h-4 opacity-40"/>}
                    {layer.visibility === 'hidden' && <EyeClosedIcon className="w-4 h-4 opacity-50"/>}
                </button>

                {/* Lock */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
                    className={`p-0.5 rounded-sm hover:bg-slate-300 shrink-0 ${layer.isLocked ? 'text-red-500' : 'text-slate-400'}`}
                    title={layer.isLocked ? "ロック中" : "ロック解除"}
                >
                    {layer.isLocked ? <LockClosedIcon className="w-3.5 h-3.5"/> : <LockOpenIcon className="w-3.5 h-3.5 opacity-50 hover:opacity-100"/>}
                </button>

                {/* Name */}
                <span className={`flex-grow text-sm font-medium truncate ${isActive ? 'text-blue-800' : 'text-slate-700'} ${layer.visibility === 'hidden' ? 'opacity-50' : ''}`}>
                    {layer.name}
                </span>

                {/* Actions (Hover) */}
                <div className="absolute right-1 top-1 bottom-1 flex items-center bg-white/90 rounded-sm shadow-sm opacity-0 group-hover:opacity-100 transition-opacity px-1 space-x-0.5">
                    <button onClick={(e) => { e.stopPropagation(); onRenameRequest(); }} className="p-1 text-slate-500 hover:text-blue-600 rounded-sm hover:bg-slate-100">
                        <HelpPencilIcon className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="p-1 text-slate-500 hover:text-blue-600 rounded-sm hover:bg-slate-100">
                        <CopyIcon className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-slate-500 hover:text-red-600 rounded-sm hover:bg-red-50">
                        <TrashIcon className="w-3.5 h-3.5"/>
                    </button>
                </div>
            </div>
            {dragIndicatorPosition === 'bottom' && (
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 z-10"></div>
            )}
        </div>
    );
});

// Helper for visual line types
const getLineTypeDashArray = (type: LineType) => {
    switch (type) {
        case 'dotted': return '1 2';
        case 'dashed': return '4 3';
        case 'wavy': return undefined; 
        case 'double': return undefined;
        case 'child-bearing': return undefined;
        case 'dash-dot': return '6 2 1 2';
        case 'dash-dot-dot': return '6 2 1 2 1 2';
        default: return 'none';
    }
};

export const DraftingToolbar: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { drawingLayers, activeDrawingLayer, activeTool, activeShape, penSettings, textSettings, eraserSettings, isSnapToGrid, isSnapToPoints, isSnapToLines, isHandwritingMode, showBaseGrid, showModuleGrid } = state;

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragIndicator, setDragIndicator] = useState<{index: number, position: 'top' | 'bottom'} | null>(null);
  
  const [renameLayerModal, setRenameLayerModal] = useState<{ id: number, currentName: string } | null>(null);
  const [deleteLayerModal, setDeleteLayerModal] = useState<{ id: number, name: string } | null>(null);

  const reversedLayers = useMemo(() => [...drawingLayers].reverse(), [drawingLayers]);

  const lineTypes: { value: LineType; label: string }[] = [
    { value: 'solid', label: '実線' },
    { value: 'dotted', label: '点線' },
    { value: 'dashed', label: '破線' },
    { value: 'dash-dot', label: '一点鎖' },
    { value: 'dash-dot-dot', label: '二点鎖' },
    { value: 'wavy', label: '波線' },
    { value: 'double', label: '双柱' },
    { value: 'child-bearing', label: '子持' },
  ];
  
  // --- Layer Drag Handlers ---
  const handleDragStart = React.useCallback((e: React.DragEvent, id: number) => {
    dragItem.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent, id: number, displayIndex: number) => {
    e.preventDefault();
    dragOverItem.current = id;
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'top' : 'bottom';
    setDragIndicator({ index: displayIndex, position });
  }, []);
  
  const handleDragLeave = React.useCallback(() => {
      setDragIndicator(null);
  }, []);

  const handleDrop = React.useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      setDragIndicator(null);
      return;
    }
    
    const dragId = dragItem.current;
    const dropId = dragOverItem.current;
    const dragIndex = drawingLayers.findIndex(l => l.id === dragId);
    
    const newOrder = [...drawingLayers];
    const [draggedItem] = newOrder.splice(dragIndex, 1);
    
    let finalDropIndex = drawingLayers.findIndex(l => l.id === dropId);
    if (dragIndex < finalDropIndex) finalDropIndex--;

    if (dragIndicator?.position === 'top') {
        newOrder.splice(finalDropIndex + 1, 0, draggedItem);
    } else {
        newOrder.splice(finalDropIndex, 0, draggedItem);
    }

    dispatch({ type: 'REORDER_LAYERS', payload: { newOrder } });
    
    dragItem.current = null;
    dragOverItem.current = null;
    setDragIndicator(null);
  }, [drawingLayers, dragIndicator, dispatch]);

  // --- Pen Handlers ---
  const handleLineTypeSelect = (lineType: LineType) => {
    dispatch({ type: 'SET_PEN_SETTINGS', payload: { lineType } });
  };

  const colors = ['#1e293b', '#404040', '#808080', '#c0c0c0', '#ef4444', '#3b82f6'];
  const isDrawingToolActive = ['pen', 'bucket'].includes(activeTool);

  return (
    <div className="flex flex-col space-y-1">
        {/* 1. Tools: 選択、フリーハンド、ペン、バケツ、消しゴム */}
        <ToolbarSection 
            title="ツール"
            collapsible={false}
            inlineContent={
                <>
                    <HeaderIconButton title="選択" isActive={activeTool === 'select'} onClick={() => dispatch({type: 'SET_ACTIVE_TOOL', payload: 'select'})}>
                        <SelectIcon className="w-4 h-4" />
                    </HeaderIconButton>
                    <HeaderIconButton title="文字 (T)" isActive={activeTool === 'text'} onClick={() => dispatch({type: 'SET_ACTIVE_TOOL', payload: 'text'})}>
                        <TextIcon className="w-4 h-4" />
                    </HeaderIconButton>
                    <HeaderIconButton title="ペン" isActive={activeTool === 'pen'} onClick={() => dispatch({type: 'SET_ACTIVE_TOOL', payload: 'pen'})}>
                        <PenIcon className="w-4 h-4" />
                    </HeaderIconButton>
                    <HeaderIconButton title="バケツ (塗りつぶし)" isActive={activeTool === 'bucket'} onClick={() => dispatch({type: 'SET_ACTIVE_TOOL', payload: 'bucket'})}>
                        <BucketIcon className="w-4 h-4" />
                    </HeaderIconButton>
                    <HeaderIconButton title="消しゴム" isActive={activeTool === 'eraser'} onClick={() => dispatch({type: 'SET_ACTIVE_TOOL', payload: 'eraser'})}>
                        <EraserIcon className="w-4 h-4" />
                    </HeaderIconButton>
                </>
            }
        />
        
        {/* 2. Shapes: 直線、連続線、矩形、円弧 */}
        <ToolbarSection 
            title="図形"
            collapsible={false}
            inlineContent={
                <>
                    <HeaderIconButton title="直線" isActive={activeShape === 'line'} disabled={!isDrawingToolActive || activeTool === 'bucket'} onClick={() => dispatch({type: 'SET_ACTIVE_SHAPE', payload: 'line'})}>
                        <LineIcon className="w-4 h-4" />
                    </HeaderIconButton>
                    <HeaderIconButton title="連続線" isActive={activeShape === 'polyline'} disabled={!isDrawingToolActive || activeTool === 'bucket'} onClick={() => dispatch({type: 'SET_ACTIVE_SHAPE', payload: 'polyline'})}>
                        <PolylineIcon className="w-4 h-4" />
                    </HeaderIconButton>
                    <HeaderIconButton title="矩形" isActive={activeShape === 'rectangle'} disabled={!isDrawingToolActive || activeTool === 'bucket'} onClick={() => dispatch({type: 'SET_ACTIVE_SHAPE', payload: 'rectangle'})}>
                        <RectangleIcon className="w-4 h-4" />
                    </HeaderIconButton>
                    <HeaderIconButton title="円弧" isActive={activeShape === 'arc'} disabled={!isDrawingToolActive || activeTool === 'bucket'} onClick={() => dispatch({type: 'SET_ACTIVE_SHAPE', payload: 'arc'})}>
                        <ArcIcon className="w-4 h-4" />
                    </HeaderIconButton>
                </>
            }
        />

        {/* 3. Snaps: 交点/頂点、グリッド、ライン */}
        <ToolbarSection 
            title="スナップ" 
            collapsible={false}
            inlineContent={
                <>
                    <HeaderIconButton title="交点/端点スナップ" isActive={isSnapToPoints} onClick={() => dispatch({ type: 'TOGGLE_SNAP_TO_POINTS' })}>
                        <SnapPointIcon className="w-4 h-4"/>
                    </HeaderIconButton>
                    <HeaderIconButton title="グリッドスナップ" isActive={isSnapToGrid} onClick={() => dispatch({ type: 'TOGGLE_SNAP_TO_GRID' })}>
                        <GridDotsIcon className="w-4 h-4"/>
                    </HeaderIconButton>
                    <HeaderIconButton title="ラインスナップ" isActive={isSnapToLines} onClick={() => dispatch({ type: 'TOGGLE_SNAP_TO_LINES' })}>
                        <SnapLineIcon className="w-4 h-4"/>
                    </HeaderIconButton>
                </>
            }
        />
        
        {/* 4. Pen Settings (Stroke): 手書き風、カラーパレット -> 太さ等 */}
        <ToolbarSection 
            title="ストローク" 
            collapsible={false}
            inlineContent={
                <>
                    <button 
                        onClick={() => dispatch({ type: 'TOGGLE_HANDWRITING_MODE' })}
                        className={`flex items-center justify-center rounded-sm border transition-colors h-6 w-6 shrink-0 ${isHandwritingMode ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                        title="手書き風"
                    >
                        <HelpPencilIcon className="w-4 h-4" />
                    </button>
                    <div className="flex space-x-0.5">
                        {colors.map(color => (
                            <button key={color} onClick={() => dispatch({ type: 'SET_PEN_SETTINGS', payload: { color } })}
                                className={`w-5 h-6 rounded-sm border transition-all ${penSettings.color === color ? 'border-blue-500 ring-1 ring-blue-500 scale-110 z-10' : 'border-transparent hover:border-slate-300'}`}
                                style={{ backgroundColor: color }} 
                                title={color}
                            />
                        ))}
                    </div>
                </>
            }
        >
            <div className="space-y-2 pb-1 pt-1">
                {/* Row 1: Thickness Buttons + Numeric Input + Opacity Slider */}
                <div className="flex items-center space-x-2">
                    <div className="flex space-x-1 flex-shrink-0">
                        {[0.1, 0.7, 2.25].map(width => (
                            <button 
                                key={width}
                                onClick={() => dispatch({ type: 'SET_PEN_SETTINGS', payload: { strokeWidth: width } })} 
                                className={`px-2 py-1.5 text-xs rounded-sm transition-colors border font-medium ${penSettings.strokeWidth === width ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                            >
                                {width}
                            </button>
                        ))}
                    </div>

                    {/* Numeric Input for Width */}
                    <input
                        type="number"
                        min="0.05" max="20" step="0.05"
                        value={penSettings.strokeWidth}
                        onChange={(e) => dispatch({ type: 'SET_PEN_SETTINGS', payload: { strokeWidth: parseFloat(e.target.value) || 0.1 } })}
                        className="w-12 h-7 px-1 text-right border border-slate-300 rounded-sm text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                        title="線幅 (mm)"
                    />
                    
                    <div className="flex-1 flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-sm border border-slate-200" title="線透明度">
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">透</span>
                        <input 
                            type="range" 
                            min="0" max="1" step="0.1" 
                            value={penSettings.opacity ?? 1.0} 
                            onChange={e => dispatch({ type: 'SET_PEN_SETTINGS', payload: { opacity: parseFloat(e.target.value) } })} 
                            className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            title={`${((penSettings.opacity ?? 1.0) * 100).toFixed(0)}%`} 
                        />
                    </div>
                </div>

                {/* Row 2: Visual Line Types */}
                <div className="flex space-x-1 overflow-x-auto no-scrollbar py-1">
                    {lineTypes.map(lt => (
                        <button
                            key={lt.value}
                            onClick={() => handleLineTypeSelect(lt.value)}
                            className={`flex-shrink-0 p-1.5 rounded-sm border transition-all ${penSettings.lineType === lt.value ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                            title={lt.label}
                        >
                            <svg width="24" height="12" viewBox="0 0 24 12" className="block">
                                {lt.value === 'wavy' ? (
                                    <path d="M0,6 Q3,0 6,6 T12,6 T18,6 T24,6" fill="none" stroke="currentColor" strokeWidth="1.5" className={penSettings.lineType === lt.value ? 'text-blue-600' : 'text-slate-600'} />
                                ) : lt.value === 'double' ? (
                                    <g stroke="currentColor" strokeWidth="1" className={penSettings.lineType === lt.value ? 'text-blue-600' : 'text-slate-600'}>
                                        <line x1="0" y1="4" x2="24" y2="4" />
                                        <line x1="0" y1="8" x2="24" y2="8" />
                                    </g>
                                ) : lt.value === 'child-bearing' ? (
                                     <g stroke="currentColor" className={penSettings.lineType === lt.value ? 'text-blue-600' : 'text-slate-600'}>
                                        <line x1="0" y1="4" x2="24" y2="4" strokeWidth="2" />
                                        <line x1="0" y1="8" x2="24" y2="8" strokeWidth="0.5" />
                                    </g>
                                ) : (
                                    <line 
                                        x1="0" y1="6" x2="24" y2="6" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeDasharray={getLineTypeDashArray(lt.value)}
                                        className={penSettings.lineType === lt.value ? 'text-blue-600' : 'text-slate-600'}
                                    />
                                )}
                            </svg>
                        </button>
                    ))}
                </div>
            </div>
        </ToolbarSection>

        {/* 5. Fill Section: カラーパレット -> 不透明度 */}
        <ToolbarSection 
            title="フィル" 
            collapsible={false}
            inlineContent={
                <>
                    <button onClick={() => dispatch({ type: 'SET_PEN_SETTINGS', payload: { fill: undefined } })} 
                        className={`flex items-center justify-center rounded-sm border transition-all h-6 w-6 shrink-0 ${!penSettings.fill ? 'bg-slate-200 border-slate-400' : 'bg-white border-slate-200 hover:bg-slate-100'}`}
                        title="塗りつぶしなし"
                    >
                        <XCircleIcon className="w-4 h-4 text-slate-500 m-0 mr-0" />
                    </button>
                    <div className="flex space-x-0.5">
                        {colors.map(color => (
                        <button key={color} onClick={() => dispatch({ type: 'SET_PEN_SETTINGS', payload: { fill: color } })}
                            className={`w-5 h-6 rounded-sm border transition-all ${penSettings.fill === color ? 'border-blue-500 ring-1 ring-blue-500' : 'border-transparent hover:border-slate-300'}`}
                            style={{ backgroundColor: color }} 
                            title={color}
                        />
                        ))}
                    </div>
                </>
            }
        >
            <div className="space-y-2 pb-1 pt-1">
                <div className="flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-sm border border-slate-200" title="フィル透明度">
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">透</span>
                    <input 
                        type="range" 
                        min="0" max="1" step="0.1" 
                        value={penSettings.fillOpacity ?? 1.0} 
                        onChange={e => dispatch({ type: 'SET_PEN_SETTINGS', payload: { fillOpacity: parseFloat(e.target.value) } })} 
                        className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        title={`${((penSettings.fillOpacity ?? 1.0) * 100).toFixed(0)}%`} 
                        disabled={!penSettings.fill}
                    />
                </div>
            </div>
        </ToolbarSection>
      
        {/* Text Settings Section */}
        {activeTool === 'text' && (
            <ToolbarSection title="文字設定" collapsible={false}>
                <div className="space-y-2 p-1">
                    <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">入力テキスト (キャンバスクリックで配置)</label>
                        <input
                            type="text"
                            value={textSettings.text}
                            onChange={(e) => dispatch({ type: 'SET_TEXT_SETTINGS', payload: { text: e.target.value } })}
                            placeholder="文字を入力..."
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">サイズ (mm)</label>
                            <div className="flex items-center space-x-1">
                                <select
                                    value={[1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0].includes(textSettings.fontSize) ? textSettings.fontSize : 'custom'}
                                    onChange={(e) => {
                                        if (e.target.value !== 'custom') {
                                            dispatch({ type: 'SET_TEXT_SETTINGS', payload: { fontSize: parseFloat(e.target.value) } });
                                        }
                                    }}
                                    className="w-full text-xs border border-slate-300 rounded-sm p-1 bg-white focus:outline-none focus:border-blue-500"
                                >
                                    {[1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0].map(s => (
                                        <option key={s} value={s}>{s} mm</option>
                                    ))}
                                    <option value="custom">カスタム</option>
                                </select>
                                <input
                                    type="number"
                                    min="0.5"
                                    max="50"
                                    step="0.5"
                                    value={textSettings.fontSize}
                                    onChange={(e) => dispatch({ type: 'SET_TEXT_SETTINGS', payload: { fontSize: parseFloat(e.target.value) || 2.5 } })}
                                    className="w-14 text-xs border border-slate-300 rounded-sm p-1 bg-white text-right focus:outline-none focus:border-blue-500"
                                    title="フォントサイズ (mm)"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">フォント選択</label>
                            <select
                                value={textSettings.fontFamily}
                                onChange={(e) => dispatch({ type: 'SET_TEXT_SETTINGS', payload: { fontFamily: e.target.value } })}
                                className="w-full text-xs border border-slate-300 rounded-sm p-1 bg-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="sans-serif">ゴシック体 (Sans-Serif)</option>
                                <option value="serif">明朝体 (Serif)</option>
                                <option value="monospace">等幅 (Monospace)</option>
                                <option value="Meiryo, sans-serif">メイリオ (Meiryo)</option>
                                <option value="'Yu Gothic', sans-serif">游ゴシック (Yu Gothic)</option>
                                <option value="'MS Gothic', monospace">MS ゴシック (MS Gothic)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">文字カラー</label>
                        <div className="flex space-x-1">
                            {colors.map(color => (
                                <button
                                    key={color}
                                    onClick={() => dispatch({ type: 'SET_TEXT_SETTINGS', payload: { color } })}
                                    className={`w-5 h-6 rounded-sm border transition-all ${textSettings.color === color ? 'border-blue-500 ring-1 ring-blue-500 scale-110 z-10' : 'border-transparent hover:border-slate-300'}`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </ToolbarSection>
        )}
        {/* Eraser Section */}
        {activeTool === 'eraser' && (
            <ToolbarSection title="消しゴム設定" collapsible={false}>
                <div className="px-1 py-1">
                    <label className="text-xs text-slate-500 block mb-1">半径 (部分消し): {(eraserSettings.segmentRadius || 0).toFixed(2)}mm</label>
                    <input type="range" min="0.1" max="10.0" step="0.1" value={eraserSettings.segmentRadius} onChange={e => dispatch({ type: 'SET_ERASER_SETTINGS', payload: { segmentRadius: parseFloat(e.target.value) } })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                </div>
            </ToolbarSection>
        )}

        {/* Parts Section */}
        <PartSelector />

        {/* Layers Section */}
        <ToolbarSection 
            title="レイヤー" 
            collapsible={true}
            defaultOpen={false}
            headerActions={
                <div className="flex items-center space-x-0.5">
                    <HeaderIconButton isActive={showBaseGrid} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_BASE_GRID' }); }} title="225グリッド">
                        <GridDotsIcon className="w-4 h-4" />
                    </HeaderIconButton>
                    <HeaderIconButton isActive={showModuleGrid} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_MODULE_GRID' }); }} title="900モジュール">
                        <GridLinesIcon className="w-4 h-4" />
                    </HeaderIconButton>
                    <HeaderIconButton onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADD_LAYER' }); }} title="新規レイヤー">
                        <PlusIcon className="w-4 h-4" />
                    </HeaderIconButton>
                </div>
            }
        >
            <div className="bg-slate-100 p-2 rounded-lg space-y-1 mt-1">
                {reversedLayers.map((layer, index) => (
                    <LayerItem
                        key={layer.id}
                        layer={layer}
                        isActive={activeDrawingLayer === layer.id}
                        dragIndicatorPosition={dragIndicator?.index === index ? dragIndicator.position : null}
                        onSelect={() => dispatch({ type: 'SET_ACTIVE_DRAWING_LAYER', payload: layer.id })}
                        onToggleVisibility={() => dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', payload: layer.id })}
                        onToggleLock={() => dispatch({ type: 'TOGGLE_LAYER_LOCK', payload: layer.id })}
                        onCopy={() => dispatch({ type: 'COPY_LAYER', payload: { layerId: layer.id }})}
                        onDelete={() => setDeleteLayerModal({ id: layer.id, name: layer.name })}
                        onRenameRequest={() => setRenameLayerModal({ id: layer.id, currentName: layer.name })}
                        onDragStart={(e) => handleDragStart(e, layer.id)}
                        onDragOver={(e) => handleDragOver(e, layer.id, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    />
                ))}
            </div>
        </ToolbarSection>

        {/* Modals */}
        <InputModal
            isOpen={!!renameLayerModal}
            title="レイヤー名の変更"
            defaultValue={renameLayerModal?.currentName}
            onClose={() => setRenameLayerModal(null)}
            onConfirm={(newName) => { if (renameLayerModal) dispatch({ type: 'RENAME_LAYER', payload: { layerId: renameLayerModal.id, newName } }); setRenameLayerModal(null); }}
            confirmText="変更"
        />
        <ConfirmModal
            isOpen={!!deleteLayerModal}
            title="レイヤーの削除"
            onClose={() => setDeleteLayerModal(null)}
            onConfirm={() => { if (deleteLayerModal) dispatch({ type: 'DELETE_LAYER', payload: { layerId: deleteLayerModal.id } }); setDeleteLayerModal(null); }}
        >
            <p className="text-sm text-slate-600">レイヤー「{deleteLayerModal?.name}」を削除しますか？</p>
        </ConfirmModal>
    </div>
  );
};
