

import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../state/AppContext';
import { useDraggableWindow } from '../hooks/useDraggableWindow';
import { getPointsBounds } from '../utils/geometry';
import { getPathAsPoints } from '../utils/layoutCalculator';
import { calculateArea } from '../utils/areaCalculator';
import { DrawingPoint, DrawingPath, LineType } from '../types';
import { 
    LockClosedIcon, LockOpenIcon, RegisterPartIcon, ChevronDownIcon, 
    CopyIcon, CutIcon, PasteIcon, XCircleIcon, HelpPencilIcon
} from './Icons';

const SCALE_FACTOR = 100;

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

export const PropertyWindow: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { selectedPathIds, drawingLayers, clipboard, propertyWindowRect } = state;
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    // Initialize draggable with state from Redux
    const defaultRect = { x: 340, y: 120, width: 240, height: 400 };
    const initialRect = propertyWindowRect || defaultRect;

    const handleDragEnd = React.useCallback((rect: { x: number, y: number, width: number, height: number }) => {
        dispatch({ type: 'UPDATE_PROPERTY_WINDOW_RECT', payload: rect });
    }, [dispatch]);

    const { position, size, handleMouseDown, handleResizeMouseDown, setPosition, setSize } = useDraggableWindow(
        { x: initialRect.x, y: initialRect.y }, 
        { width: initialRect.width, height: initialRect.height },
        220, 200, // minWidth, minHeight
        handleDragEnd
    );

    // Sync local state ONLY when Redux propertyWindowRect significantly differs
    useEffect(() => {
        if (propertyWindowRect) {
            if (Math.abs(propertyWindowRect.x - position.x) > 2 || Math.abs(propertyWindowRect.y - position.y) > 2) {
                setPosition({ x: propertyWindowRect.x, y: propertyWindowRect.y });
            }
            if (Math.abs(propertyWindowRect.width - size.width) > 2 || Math.abs(propertyWindowRect.height - size.height) > 2) {
                setSize({ width: propertyWindowRect.width, height: propertyWindowRect.height });
            }
        }
    }, [propertyWindowRect?.x, propertyWindowRect?.y, propertyWindowRect?.width, propertyWindowRect?.height, setPosition, setSize]);
    // Selection Dimensions State
    const [isAspectRatioLocked, setIsAspectRatioLocked] = useState(true);
    const [localDimensions, setLocalDimensions] = useState<{ w: string, h: string } | null>(null);
    
    // Line Types
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
    const colors = ['#1e293b', '#404040', '#808080', '#c0c0c0', '#ef4444', '#3b82f6'];

    // --- Calculation Logic ---
    const selectionDimensions = useMemo(() => {
        if (selectedPathIds.length === 0) return null;

        const selectedPaths = drawingLayers
            .flatMap(layer => layer.paths)
            .filter(path => selectedPathIds.includes(path.id));

        if (selectedPaths.length === 0) return null;

        const allPoints: DrawingPoint[] = [];
        selectedPaths.forEach(path => {
            const pointGroups = getPathAsPoints(path, false, false); 
            pointGroups.flat().forEach(p => allPoints.push(p));
        });

        const bounds = getPointsBounds(allPoints);
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        return {
            width: bounds.width * SCALE_FACTOR,
            height: bounds.height * SCALE_FACTOR,
            center: { x: centerX, y: centerY }
        };
    }, [selectedPathIds, drawingLayers]);

    useEffect(() => {
        if (selectionDimensions) {
            setLocalDimensions({
                w: selectionDimensions.width.toFixed(1),
                h: selectionDimensions.height.toFixed(1)
            });
        } else {
            setLocalDimensions(null);
        }
    }, [selectionDimensions]);

    const firstSelectedPath = useMemo(() => {
        if (selectedPathIds.length === 0) return null;
        for (const layer of drawingLayers) {
            const found = layer.paths.find(p => p.id === selectedPathIds[0]);
            if (found) return found;
        }
        return null;
    }, [selectedPathIds, drawingLayers]);

    const currentLayerId = useMemo(() => {
        const layerIds = new Set<number>();
        drawingLayers.forEach(layer => {
            if (layer.paths.some(p => selectedPathIds.includes(p.id))) {
                layerIds.add(layer.id);
            }
        });
        return layerIds.size === 1 ? Array.from(layerIds)[0] : '';
    }, [drawingLayers, selectedPathIds]);

    // --- Handlers ---

    const updateSelected = (updates: Partial<DrawingPath>) => {
        dispatch({ type: 'UPDATE_SELECTED_PATHS', payload: updates });
    };

    const handleDimensionCommit = (axis: 'w' | 'h') => {
        if (!selectionDimensions || !localDimensions) return;
        
        const valStr = axis === 'w' ? localDimensions.w : localDimensions.h;
        let newVal = parseFloat(valStr);
        if (isNaN(newVal) || newVal === 0) return;
        
        const currentW = selectionDimensions.width || 1;
        const currentH = selectionDimensions.height || 1;
        
        let scaleX = 1;
        let scaleY = 1;
        
        if (axis === 'w') {
            scaleX = newVal / currentW;
            if (isAspectRatioLocked) scaleY = Math.abs(scaleX);
        } else {
            scaleY = newVal / currentH;
            if (isAspectRatioLocked) scaleX = Math.abs(scaleY);
        }
        
        dispatch({ 
            type: 'SCALE_SELECTION', 
            payload: { scaleX, scaleY, centerPoint: selectionDimensions.center } 
        });
    };

    if (selectedPathIds.length === 0) return null;

    const currentStrokeWidth = firstSelectedPath?.strokeWidth || 0.1;
    const currentOpacity = firstSelectedPath?.opacity !== undefined ? firstSelectedPath.opacity : 1.0;
    const currentFillOpacity = firstSelectedPath?.fillOpacity !== undefined ? firstSelectedPath.fillOpacity : 1.0;
    const isHandwriting = firstSelectedPath?.isHandwriting;

    return (
        <div
            className="fixed z-[60] bg-white rounded-lg shadow-xl border border-slate-300 flex flex-col overflow-hidden"
            style={{ 
                left: position.x, 
                top: position.y, 
                width: size.width, 
                height: isCollapsed ? 'auto' : size.height 
            }}
        >
            {/* Header */}
            <div 
                className="bg-slate-100 px-2 py-1.5 flex items-center justify-between cursor-move select-none border-b border-slate-200 shrink-0"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-slate-700 mr-1">プロパティ</span>
                    <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CUT_SELECTION' }); }} title="カット" className="p-1 hover:bg-slate-200 rounded-sm text-slate-600"><CutIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'COPY_SELECTION' }); }} title="コピー" className="p-1 hover:bg-slate-200 rounded-sm text-slate-600"><CopyIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'PASTE_SELECTION' }); }} title="ペースト" disabled={clipboard.length === 0} className="p-1 hover:bg-slate-200 rounded-sm text-slate-600 disabled:opacity-30"><PasteIcon className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center space-x-1">
                    <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'INITIATE_PART_REGISTRATION' }); }} title="パーツ登録" className="p-1 hover:bg-slate-200 rounded-sm text-slate-600"><RegisterPartIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }} className="p-1 hover:bg-slate-200 rounded-sm text-slate-500"><ChevronDownIcon className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} /></button>
                </div>
            </div>

            {/* Content */}
            {!isCollapsed && (
                <>
                    <div className="flex-grow overflow-y-auto p-2 pb-5 space-y-3 bg-white text-xs">
                        {/* Dimensions */}
                        {localDimensions && (
                            <div className="grid grid-cols-7 gap-1 items-center">
                                <div className="col-span-3 flex items-center border border-slate-200 rounded-sm px-1 py-0.5 bg-slate-50">
                                    <span className="font-semibold text-slate-500 mr-1">W:</span>
                                    <input type="text" value={localDimensions.w} onChange={(e) => setLocalDimensions({ ...localDimensions, w: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleDimensionCommit('w')} onBlur={() => handleDimensionCommit('w')} className="w-full bg-transparent text-right focus:outline-none" />
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <button onClick={() => setIsAspectRatioLocked(!isAspectRatioLocked)} className="text-slate-400 hover:text-slate-600">
                                        {isAspectRatioLocked ? <LockClosedIcon className="w-3 h-3" /> : <LockOpenIcon className="w-3 h-3" />}
                                    </button>
                                </div>
                                <div className="col-span-3 flex items-center border border-slate-200 rounded-sm px-1 py-0.5 bg-slate-50">
                                    <span className="font-semibold text-slate-500 mr-1">H:</span>
                                    <input type="text" value={localDimensions.h} onChange={(e) => setLocalDimensions({ ...localDimensions, h: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleDimensionCommit('h')} onBlur={() => handleDimensionCommit('h')} className="w-full bg-transparent text-right focus:outline-none" />
                                </div>
                            </div>
                        )}

                        {/* Angle & Alignment Guide */}
                        <div className="p-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] space-y-1 text-slate-600">
                            <div className="flex items-center justify-between font-semibold text-slate-700">
                                <span>📐 角度拾い・アライメント</span>
                                <span className="text-[10px] text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-200 font-mono">[A] + Click</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight">
                                <strong>Aキー</strong>を押しながら図面上の線をクリックすると、その線の角度を拾って選択図形が瞬時に平行回転します。
                            </p>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                                <span className="text-[10px] text-slate-500">回転ショートカット:</span>
                                <span className="text-[10px] text-slate-700 font-mono"><strong>R</strong> (90°) / <strong>Shift+R</strong> (15°)</span>
                            </div>
                        </div>

                                                {/* Text Properties (When a text entity is selected) */}
                        {firstSelectedPath?.text !== undefined && (
                            <div className="space-y-2 border border-blue-200 bg-blue-50/40 p-2 rounded-sm">
                                <div className="flex items-center justify-between border-b border-blue-100 pb-1">
                                    <h3 className="font-semibold text-blue-700 flex items-center space-x-1">
                                        <span>{firstSelectedPath.id.startsWith('unit-area-summary') ? '図面情報・面積データ' : '文字プロパティ'}</span>
                                    </h3>
                                    {firstSelectedPath.id.startsWith('unit-area-summary') && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const areaResult = calculateArea(state.present, state.firstFloorDeduction, state.stairDeductions);
                                                const floorAreaStrings = areaResult.floors.map(floor => `${floor.floorNumber}F:${floor.totalArea.toFixed(2)}㎡`).join(' ');
                                                const totalAreaString = `Total:${areaResult.totalArea.toFixed(2)}㎡`;
                                                const scaleString = 'Scale:1/100';
                                                const synced = `${floorAreaStrings} ${totalAreaString} ${scaleString}`;
                                                updateSelected({ text: synced, isCustomText: false });
                                            }}
                                            className="text-[10px] text-blue-600 hover:text-blue-800 bg-blue-100/70 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors font-medium cursor-pointer"
                                            title="現在のユニット配置から最新の面積計算値に再同期"
                                        >
                                            🔄 最新値に同期
                                        </button>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-[11px] text-slate-500">テキスト内容</label>
                                        {firstSelectedPath.isCustomText && (
                                            <span className="text-[10px] text-amber-600 font-medium">編集済み</span>
                                        )}
                                    </div>
                                    <textarea
                                        rows={2}
                                        value={firstSelectedPath.text || ""}
                                        onChange={(e) => updateSelected({ text: e.target.value, isCustomText: true })}
                                        className="w-full border border-slate-300 rounded-sm px-1.5 py-1 text-xs bg-white focus:outline-none focus:border-blue-500 font-mono resize-none leading-relaxed"
                                        placeholder="文字・データ内容を入力..."
                                    />
                                    {firstSelectedPath.id.startsWith('unit-area-summary') && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const cur = firstSelectedPath.text || "";
                                                    const updated = cur.includes('Scale:') ? cur.replace(/Scale:[^\s]+/, 'Scale:1/100') : `${cur} Scale:1/100`.trim();
                                                    updateSelected({ text: updated, isCustomText: true });
                                                }}
                                                className="text-[10px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 px-1 py-0.5 rounded"
                                            >
                                                1/100
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const cur = firstSelectedPath.text || "";
                                                    const updated = cur.includes('Scale:') ? cur.replace(/Scale:[^\s]+/, 'Scale:1/50') : `${cur} Scale:1/50`.trim();
                                                    updateSelected({ text: updated, isCustomText: true });
                                                }}
                                                className="text-[10px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 px-1 py-0.5 rounded"
                                            >
                                                1/50
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const cur = firstSelectedPath.text || "";
                                                    const today = new Date().toLocaleDateString('ja-JP');
                                                    updateSelected({ text: `${cur}\n設計日:${today}`.trim(), isCustomText: true });
                                                }}
                                                className="text-[10px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 px-1 py-0.5 rounded"
                                            >
                                                + 日付
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const cur = firstSelectedPath.text || "";
                                                    updateSelected({ text: `${cur}\n工事名称:`.trim(), isCustomText: true });
                                                }}
                                                className="text-[10px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 px-1 py-0.5 rounded"
                                            >
                                                + 工事名称
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] text-slate-500 mb-0.5">フォントサイズ (mm)</label>
                                        <input
                                            type="number"
                                            min="0.5"
                                            max="50"
                                            step="0.5"
                                            value={firstSelectedPath.fontSize || 1.8}
                                            onChange={(e) => updateSelected({ fontSize: parseFloat(e.target.value) || 1.8 })}
                                            className="w-full border border-slate-300 rounded-sm px-1.5 py-1 text-xs bg-white text-right focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-slate-500 mb-0.5">フォント種別</label>
                                        <select
                                            value={firstSelectedPath.fontFamily || "sans-serif"}
                                            onChange={(e) => updateSelected({ fontFamily: e.target.value })}
                                            className="w-full border border-slate-300 rounded-sm px-1 py-1 text-xs bg-white focus:outline-none focus:border-blue-500"
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
                            </div>
                        )}

                        {/* Layer */}
                        <div>
                            <label className="block text-slate-500 mb-1">所属レイヤー</label>
                            <select value={currentLayerId} onChange={(e) => { if (e.target.value) dispatch({ type: 'MOVE_SELECTED_PATHS_TO_LAYER', payload: { targetLayerId: Number(e.target.value) } }); }} className="w-full border border-slate-300 rounded-sm p-1 focus:outline-none focus:border-blue-500">
                                {currentLayerId === '' && <option value="">(複数または未選択)</option>}
                                {drawingLayers.map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
                            </select>
                        </div>

                        {/* Stroke Settings */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between border-b pb-1">
                                <h3 className="font-semibold text-slate-500">ストローク</h3>
                                <div className="flex space-x-1">
                                    <button 
                                        onClick={() => updateSelected({ isHandwriting: !isHandwriting })}
                                        className={`flex items-center justify-center rounded-sm border transition-colors h-5 w-5 ${isHandwriting ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                        title="手書き風"
                                    >
                                        <HelpPencilIcon className="w-3 h-3" />
                                    </button>
                                    {colors.map(color => (
                                        <button 
                                            key={color} 
                                            onClick={() => updateSelected({ color })}
                                            className={`w-4 h-5 rounded-sm border transition-all ${firstSelectedPath?.color === color ? 'border-blue-500 ring-1 ring-blue-500 scale-110 z-10' : 'border-transparent hover:border-slate-300'}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>
                            
                            {/* Row 1: Thickness Buttons + Numeric Input + Opacity Slider */}
                            <div className="flex items-center space-x-2">
                                <div className="flex space-x-1 flex-shrink-0">
                                    {[0.1, 0.7, 2.25].map(width => (
                                        <button 
                                            key={width}
                                            onClick={() => updateSelected({ strokeWidth: width })}
                                            className={`px-1.5 py-1 rounded-sm border transition-colors font-medium ${currentStrokeWidth === width ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {width}
                                        </button>
                                    ))}
                                </div>

                                {/* Numeric Input for Width */}
                                <input
                                    type="number"
                                    min="0.05" max="20" step="0.05"
                                    value={currentStrokeWidth}
                                    onChange={(e) => updateSelected({ strokeWidth: parseFloat(e.target.value) || 0.1 })}
                                    className="w-10 h-6 px-1 text-right border border-slate-300 rounded-sm text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                                    title="線幅 (mm)"
                                />
                                
                                <div className="flex-1 flex items-center space-x-1 bg-slate-50 px-1 py-0.5 rounded-sm border border-slate-200" title="透明度">
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">透</span>
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.1" 
                                        value={currentOpacity}
                                        onChange={(e) => updateSelected({ opacity: parseFloat(e.target.value) })}
                                        className="w-full h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                        title={`${(currentOpacity * 100).toFixed(0)}%`}
                                    />
                                </div>
                            </div>

                            {/* Row 2: Visual Line Types */}
                            <div className="flex space-x-1 overflow-x-auto no-scrollbar py-1">
                                {lineTypes.map(lt => (
                                    <button
                                        key={lt.value}
                                        onClick={() => updateSelected({ lineType: lt.value })}
                                        className={`flex-shrink-0 p-1 rounded-sm border transition-all ${firstSelectedPath?.lineType === lt.value ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                        title={lt.label}
                                    >
                                        <svg width="20" height="10" viewBox="0 0 20 10" className="block">
                                            {lt.value === 'wavy' ? (
                                                <path d="M0,5 Q2.5,0 5,5 T10,5 T15,5 T20,5" fill="none" stroke="currentColor" strokeWidth="1.5" className={firstSelectedPath?.lineType === lt.value ? 'text-blue-600' : 'text-slate-600'} />
                                            ) : lt.value === 'double' ? (
                                                <g stroke="currentColor" strokeWidth="1" className={firstSelectedPath?.lineType === lt.value ? 'text-blue-600' : 'text-slate-600'}>
                                                    <line x1="0" y1="3" x2="20" y2="3" />
                                                    <line x1="0" y1="7" x2="20" y2="7" />
                                                </g>
                                            ) : lt.value === 'child-bearing' ? (
                                                    <g stroke="currentColor" className={firstSelectedPath?.lineType === lt.value ? 'text-blue-600' : 'text-slate-600'}>
                                                    <line x1="0" y1="3" x2="20" y2="3" strokeWidth="2" />
                                                    <line x1="0" y1="7" x2="20" y2="7" strokeWidth="0.5" />
                                                </g>
                                            ) : (
                                                <line 
                                                    x1="0" y1="5" x2="20" y2="5" 
                                                    stroke="currentColor" 
                                                    strokeWidth="2" 
                                                    strokeDasharray={getLineTypeDashArray(lt.value)}
                                                    className={firstSelectedPath?.lineType === lt.value ? 'text-blue-600' : 'text-slate-600'}
                                                />
                                            )}
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Fill Settings */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between border-b pb-1">
                                <h3 className="font-semibold text-slate-500">フィル</h3>
                                <div className="flex space-x-1">
                                    <button onClick={() => updateSelected({ fill: undefined })} className={`flex items-center justify-center rounded-sm border transition-all h-5 w-5 ${!firstSelectedPath?.fill ? 'bg-slate-200 border-slate-400' : 'bg-white border-slate-200 hover:bg-slate-100'}`}>
                                        <XCircleIcon className="w-3.5 h-3.5 text-slate-500 m-0 mr-0" />
                                    </button>
                                    {colors.map(color => (
                                        <button 
                                            key={color} 
                                            onClick={() => updateSelected({ fill: color })}
                                            className={`w-4 h-5 rounded-sm border transition-all ${firstSelectedPath?.fill === color ? 'border-blue-500 ring-1 ring-blue-500' : 'border-transparent hover:border-slate-300'}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>
                            {/* Fill Opacity Slider */}
                            <div className="flex items-center space-x-1 bg-slate-50 px-1 py-0.5 rounded-sm border border-slate-200" title="フィル透明度">
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">透</span>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.1" 
                                    value={currentFillOpacity} 
                                    onChange={e => updateSelected({ fillOpacity: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                    title={`${(currentFillOpacity * 100).toFixed(0)}%`}
                                    disabled={!firstSelectedPath?.fill}
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Resize Handle */}
                    <div 
                        className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-50 flex items-end justify-end p-0.5 hover:bg-slate-100 rounded-tl"
                        onMouseDown={(e) => handleResizeMouseDown(e, 'xy')}
                    >
                        <svg viewBox="0 0 10 10" className="w-3.5 h-3.5 text-slate-400">
                            <path d="M10 10 L10 2 L2 10 Z" fill="currentColor" />
                        </svg>
                    </div>
                </>
            )}
        </div>
    );
};