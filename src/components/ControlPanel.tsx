

import React, { useState, useRef, useEffect, memo } from 'react';
import type { ControlPanelRect } from '../types';
import { UnitSelector } from './UnitSelector';
import { AreaCalculator } from './AreaCalculator';
import { useAppContext } from '../state/AppContext';
import { DraftingToolbar } from './DraftingToolbar';
import { PropertyWindow } from './PropertyWindow';
import { useDraggableWindow } from '../hooks/useDraggableWindow';
import { 
    GridIcon, DraftingIcon, FileIcon, SaveIcon, LoadIcon, 
    PrintIcon, PdfIcon, SvgIcon, TuneIcon, HelpIcon,
    AllIcon, Floor1Icon, Floor2Icon, Floor3Icon, UndoIcon, RedoIcon, PlusIcon, MinusIcon,
    PanZoomIcon, SelectIcon, RegisterPartIcon, KbdIcon, LayerIcon, HelpPencilIcon,
    ChevronDownIcon, FilePlusIcon, TrashIcon, SparklesIcon, CadImportIcon
} from './Icons';

// --- Sub Components ---

const TabButton: React.FC<{ 
    isActive: boolean; 
    onClick: () => void; 
    icon: React.ReactNode; 
    label: string 
}> = ({ isActive, onClick, icon, label }) => (
    <button 
        onClick={onClick} 
        onMouseDown={(e) => e.stopPropagation()} 
        className={`flex-1 py-1.5 px-2 rounded text-xs font-bold flex items-center justify-center space-x-1 transition-colors ${isActive ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
    >
        {icon}<span>{label}</span>
    </button>
);

const ToolbarButton: React.FC<{ onClick: () => void; icon: React.ReactNode; title: string }> = ({ onClick, icon, title }) => (
    <button onClick={onClick} className="p-1 hover:bg-blue-50 rounded text-slate-600" title={title}>
        {icon}
    </button>
);

const FileActionButton: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string; colorClass?: string }> = ({ onClick, icon, label, colorClass = "text-slate-700 hover:bg-slate-50 hover:border-slate-200" }) => (
    <button onClick={onClick} className={`w-full flex items-center p-2 rounded border border-transparent transition-colors ${colorClass}`}>
        <span className="mr-3 opacity-70">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
    </button>
);

const HelpSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="mb-6 border-b border-slate-100 pb-4 last:border-0">
        <div className="flex items-center space-x-2 mb-3 text-blue-600">
            {icon}
            <h3 className="font-bold text-sm text-slate-700">{title}</h3>
        </div>
        <div className="space-y-3 pl-1 text-xs leading-relaxed text-slate-600">
            {children}
        </div>
    </div>
);

const HelpSubItem: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-slate-50 p-2 rounded border border-slate-100">
        <h4 className="font-semibold text-slate-700 mb-1">{title}</h4>
        <div className="space-y-1">{children}</div>
    </div>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="px-1.5 py-0.5 mx-0.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded shadow-sm font-mono">
        {children}
    </kbd>
);

// --- Tab Content Components ---

const FileTabContent: React.FC<{ onAction: (type: string) => void }> = ({ onAction }) => (
    <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-1">ファイル操作</h3>
        <div className="space-y-2">
            <FileActionButton onClick={() => onAction('NEW')} icon={<FilePlusIcon className="w-4 h-4"/>} label="新規作成" />
            <FileActionButton onClick={() => onAction('LOAD')} icon={<LoadIcon className="w-4 h-4"/>} label="読込" />
            <FileActionButton onClick={() => onAction('CAD_IMPORT')} icon={<CadImportIcon className="w-4 h-4 text-sky-600"/>} label="DXF・SVG読込" />
            <FileActionButton onClick={() => onAction('SAVE')} icon={<SaveIcon className="w-4 h-4"/>} label="保存" />
        </div>

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-1 mt-4">出力・印刷</h3>
        <div className="space-y-2">
            <FileActionButton onClick={() => onAction('PRINT')} icon={<PrintIcon className="w-4 h-4"/>} label="印刷" />
            <FileActionButton onClick={() => onAction('PDF')} icon={<PdfIcon className="w-4 h-4"/>} label="PDF出力" />
            <FileActionButton onClick={() => onAction('SVG')} icon={<SvgIcon className="w-4 h-4"/>} label="SVG出力" />
            <FileActionButton 
                onClick={() => onAction('DXF')} 
                icon={<CadImportIcon className="w-4 h-4 text-emerald-600"/>} 
                label="DXF保存 (.dxf)" 
                colorClass="text-emerald-900 bg-emerald-50/70 hover:bg-emerald-100 hover:border-emerald-300 border-emerald-200 shadow-xs font-medium" 
            />
        </div>

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-1 mt-4">AI・画像加工</h3>
        <div className="space-y-2">
            <FileActionButton 
                onClick={() => onAction('COPILOT')} 
                icon={<SparklesIcon className="w-4 h-4 text-indigo-600"/>} 
                label="Copilot画像加工 (プレゼン)" 
                colorClass="text-indigo-900 bg-indigo-50/70 hover:bg-indigo-100 hover:border-indigo-300 border-indigo-200 shadow-xs font-medium" 
            />
        </div>

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-1 mt-4">設定・クリア</h3>
        <div className="space-y-2">
            <FileActionButton onClick={() => onAction('SETTINGS')} icon={<TuneIcon className="w-4 h-4"/>} label="用紙設定" />
            <FileActionButton onClick={() => onAction('CLEAR_UNITS')} icon={<GridIcon className="w-4 h-4"/>} label="ユニットクリア" colorClass="text-red-700 hover:bg-red-50 hover:border-red-200" />
            <FileActionButton onClick={() => onAction('CLEAR_DRAWING')} icon={<TrashIcon className="w-4 h-4"/>} label="製図クリア" colorClass="text-red-700 hover:bg-red-50 hover:border-red-200" />
        </div>
    </div>
);

const HelpTabContent: React.FC = () => (
    <div className="pb-4">
        <HelpSection title="はじめに" icon={<PanZoomIcon className="w-5 h-5"/>}>
            <p>メニューバーから「製図」または「配置」タブを切り替えて作業します。</p>
            <p><strong>移動:</strong> マウスホイール（上下）、<Kbd>Shift</Kbd>+ホイール（左右）<br/><strong>拡大縮小:</strong> <Kbd>Ctrl</Kbd>+ホイール / メニューパネルのボタン</p>
        </HelpSection>

        <HelpSection title="製図: 基本操作" icon={<HelpPencilIcon className="w-5 h-5"/>}>
            <HelpSubItem title="ツール">
                <p><strong>選択:</strong> 図形の選択・移動</p>
                <p><strong>ペン類:</strong> 自由描画（Shiftで直線）</p>
                <p><strong>消しゴム:</strong> 線をクリックで削除。<Kbd>Space</Kbd>長押しで部分消しゴム</p>
            </HelpSubItem>
            <HelpSubItem title="図形">
                <p><strong>線・連続線:</strong> クリックで点追加、右クリック/Enterで終了</p>
                <p><strong>円弧:</strong> 中心→始点→終点の順にクリック。<Kbd>Space</Kbd>で反転、<Kbd>Shift</Kbd>で15°刻み</p>
            </HelpSubItem>
        </HelpSection>

        <HelpSection title="製図: 編集と変形" icon={<SelectIcon className="w-5 h-5"/>}>
            <p>選択ツールで図形をクリックして選択します。<Kbd>Shift</Kbd>+クリックで複数選択。</p>
            <HelpSubItem title="移動・コピー">
                <p>ドラッグで移動。<Kbd>Alt</Kbd>+ドラッグでコピー。</p>
                <p>矢印キーで移動。<Kbd>Shift</Kbd>で大きく、<Kbd>Alt</Kbd>で微細移動。</p>
                <p>移動中に<Kbd>Tab</Kbd>で基準点（スナップ点）を切り替え可能。</p>
            </HelpSubItem>
            <HelpSubItem title="変形ショートカット (移動/配置中)">
                <p><Kbd>R</Kbd> : 90度回転 (Shift+Rで逆)</p>
                <p><Kbd>H</Kbd> : 左右反転、<Kbd>V</Kbd> : 上下反転</p>
                <p><Kbd>B</Kbd> : 拡大、<Kbd>G</Kbd> : 縮小</p>
            </HelpSubItem>
        </HelpSection>

        <HelpSection title="パーツ機能" icon={<RegisterPartIcon className="w-5 h-5"/>}>
            <p>よく使う図形を登録して使い回せます。</p>
            <ol className="list-decimal list-inside space-y-1 mt-1">
                <li>図形を選択し「パーツ登録」ボタンを押下</li>
                <li>基準点（配置時の中心）をクリック</li>
                <li>名前とフォルダを入力して保存</li>
            </ol>
            <p className="mt-2"><strong>配置:</strong> パーツリストから選択し、画面をクリック。<Kbd>Esc</Kbd>で終了。</p>
        </HelpSection>

        <HelpSection title="レイヤー機能" icon={<LayerIcon className="w-5 h-5"/>}>
            <p>リストの上が手前、下が奥に表示されます。</p>
            <p>目のアイコンをクリックで <strong>表示 ➡ 半透明 ➡ 非表示</strong> を切り替え。</p>
            <p className="text-red-500">※ 選択中のレイヤー以外は編集できません。</p>
        </HelpSection>

        <HelpSection title="ユニット配置" icon={<GridIcon className="w-5 h-5"/>}>
            <p>メニューパネルからユニットを選び、グリッドをクリックして配置。</p>
            <p>ダブルクリックで削除。</p>
            <p>1階にメインユニットがない場所には2階・3階を置けません。</p>
        </HelpSection>

        <HelpSection title="ショートカット一覧" icon={<KbdIcon className="w-5 h-5"/>}>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div><Kbd>Q</Kbd> ツール切替</div>
                <div><Kbd>A</Kbd> 図形切替</div>
                <div><Kbd>Z</Kbd> ペン太さ切替</div>
                <div><Kbd>Del</Kbd> 削除</div>
                <div><Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> 戻る</div>
                <div><Kbd>Ctrl</Kbd>+<Kbd>Y</Kbd> 進む</div>
                <div className="col-span-2 mt-1 font-bold">変形・移動</div>
                <div><Kbd>R</Kbd> 回転</div>
                <div><Kbd>H</Kbd>/<Kbd>V</Kbd> 反転</div>
                <div><Kbd>B</Kbd>/<Kbd>G</Kbd> 拡大/縮小</div>
                <div><Kbd>Tab</Kbd> 基準点切替</div>
            </div>
        </HelpSection>
    </div>
);

// --- Main Component ---

interface ControlPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    onLoad: () => void;
}

type Tab = 'drafting' | 'placement' | 'file' | 'help';

export const ControlPanel: React.FC<ControlPanelProps> = memo(({ isOpen, onClose, onSave, onLoad }) => {
    const { state, dispatch } = useAppContext();
    const { mode } = state;
    
    const [activeTab, setActiveTab] = useState<Tab>('drafting');
    const panelRef = useRef<HTMLDivElement>(null);
    
    // Initial position Top-Left (x: 10, y: 10)
    const { position, size, handleMouseDown, handleResizeMouseDown, setPosition, setSize } = useDraggableWindow(
        state.controlPanelRect, // Use rect from state as initial
        { width: state.controlPanelRect.width, height: state.controlPanelRect.height }
    );

    // Sync local state when Redux state changes (e.g. on Load)
    useEffect(() => {
        const { x, y, width, height } = state.controlPanelRect;
        if (Math.abs(x - position.x) > 1 || Math.abs(y - position.y) > 1) {
            setPosition({ x, y });
        }
        if (Math.abs(width - size.width) > 1 || Math.abs(height - size.height) > 1) {
            setSize({ width, height });
        }
    }, [state.controlPanelRect, setPosition, setSize]);

    // Track last dispatched rect to prevent redundant updates and loops
    const lastRectRef = useRef<ControlPanelRect | null>(null);

    useEffect(() => {
        if (mode === 'placement' && activeTab !== 'placement') setActiveTab('placement');
        if (mode === 'drafting' && activeTab !== 'drafting') setActiveTab('drafting');
    }, [mode]);

    // Sync control panel rect with global state for workspace layout adjustments
    useEffect(() => {
        const newRect = { 
            x: position.x, 
            y: position.y, 
            width: size.width, 
            height: isOpen ? size.height : 40 
        };

        // Deep comparison for simple numbers to avoid redundant dispatch loop
        if (lastRectRef.current && 
            lastRectRef.current.x === newRect.x && 
            lastRectRef.current.y === newRect.y && 
            lastRectRef.current.width === newRect.width && 
            lastRectRef.current.height === newRect.height) {
            return;
        }

        lastRectRef.current = newRect;
        dispatch({ 
            type: 'UPDATE_CONTROL_PANEL_RECT', 
            payload: newRect
        });
    }, [position, size, isOpen, dispatch]);

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        if (tab === 'placement') dispatch({ type: 'SET_MODE', payload: 'placement' });
        if (tab === 'drafting') dispatch({ type: 'SET_MODE', payload: 'drafting' });
    };

    const handleAutoSwitchToDrafting = () => {
        handleTabChange('drafting');
    };

    const handleFileAction = (action: string) => {
        switch (action) {
            case 'NEW': dispatch({ type: 'SHOW_NEW_PROJECT_CONFIRM' }); break;
            case 'LOAD': 
                onLoad(); 
                return; // Don't auto switch yet, wait for file load
            case 'CAD_IMPORT': dispatch({ type: 'SHOW_CAD_IMPORT_MODAL' }); break;
            case 'SAVE': onSave(); break;
            case 'PRINT': dispatch({ type: 'SHOW_PRINT_OPTIONS' }); break;
            case 'PDF': dispatch({ type: 'SHOW_PDF_OPTIONS' }); break;
            case 'SVG': dispatch({ type: 'SHOW_SVG_OPTIONS' }); break;
            case 'DXF': dispatch({ type: 'SHOW_DXF_OPTIONS' }); break;
            case 'COPILOT': dispatch({ type: 'SHOW_COPILOT_MODAL' }); break;
            case 'SETTINGS': dispatch({ type: 'SHOW_DRAFTING_SETTINGS' }); break;
            case 'CLEAR_UNITS': dispatch({ type: 'SHOW_CLEAR_UNITS_CONFIRM' }); break;
            case 'CLEAR_DRAWING': dispatch({ type: 'SHOW_CLEAR_DRAWING_CONFIRM' }); break;
        }
        handleAutoSwitchToDrafting();
    };

    const handleZoomIn = () => dispatch({ type: 'ZOOM_IN_OUT', payload: { direction: 'in', centerX: window.innerWidth/2, centerY: window.innerHeight/2 } });
    const handleZoomOut = () => dispatch({ type: 'ZOOM_IN_OUT', payload: { direction: 'out', centerX: window.innerWidth/2, centerY: window.innerHeight/2 } });

    // Zoom Input Logic
    const [zoomInput, setZoomInput] = useState<string>('100');
    const [isEditingZoom, setIsEditingZoom] = useState(false);

    // Sync input with state when not editing
    useEffect(() => {
        if (!isEditingZoom) {
            const fitScale = state.fitScale && state.fitScale > 0 ? state.fitScale : 1;
            const percent = Math.round((state.panZoom.scale / fitScale) * 100);
            setZoomInput(percent.toString());
        }
    }, [state.panZoom.scale, state.fitScale, isEditingZoom]);

    const handleZoomCommit = () => {
        let val = parseFloat(zoomInput);
        if (isNaN(val) || val <= 0) val = 100;
        
        const fitScale = state.fitScale && state.fitScale > 0 ? state.fitScale : 1;
        const newScale = (val / 100) * fitScale;
        
        // Center zoom on screen
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const { scale, translate } = state.panZoom;
        
        // World coordinate under center
        // screen = world * scale + translate
        // world = (screen - translate) / scale
        const wx = (cx - translate.x) / scale;
        const wy = (cy - translate.y) / scale;
        
        // New translate
        // newScreen = world * newScale + newTranslate
        // newTranslate = newScreen - world * newScale
        const newTranslateX = cx - wx * newScale;
        const newTranslateY = cy - wy * newScale;
        
        dispatch({ type: 'SET_PAN_ZOOM', payload: { scale: newScale, translate: { x: newTranslateX, y: newTranslateY } } });
        setIsEditingZoom(false);
    };

    const handleZoomKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleZoomCommit();
            // Defocus
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <>
            {/* Property Window: Separate floating window for selection properties */}
            <PropertyWindow />

            <div
                ref={panelRef}
                className="fixed z-50 bg-white rounded-lg shadow-2xl border border-slate-300 flex flex-col"
                style={{ left: position.x, top: position.y, width: size.width, height: isOpen ? size.height : 'auto' }}
            >
                {/* Header Area */}
                <div 
                    className="bg-slate-100 rounded-t-lg border-b border-slate-300 cursor-move select-none"
                    onMouseDown={handleMouseDown}
                >
                    {/* Tabs */}
                    <div className="flex items-center p-1 space-x-1 overflow-x-auto no-scrollbar">
                        <TabButton isActive={activeTab === 'file'} onClick={() => handleTabChange('file')} icon={<FileIcon className="w-4 h-4" />} label="ファイル" />
                        <TabButton isActive={activeTab === 'placement'} onClick={() => handleTabChange('placement')} icon={<GridIcon className="w-4 h-4" />} label="配置" />
                        <TabButton isActive={activeTab === 'drafting'} onClick={() => handleTabChange('drafting')} icon={<DraftingIcon className="w-4 h-4" />} label="製図" />
                        <TabButton isActive={activeTab === 'help'} onClick={() => handleTabChange('help')} icon={<HelpIcon className="w-4 h-4" />} label="ヘルプ" />
                        
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded ml-1" onMouseDown={(e) => e.stopPropagation()} title={isOpen ? "折りたたむ" : "展開する"}>
                            <ChevronDownIcon className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Compact Toolbar */}
                    <div className="flex items-center justify-between px-2 py-1.5 border-t border-slate-200 bg-slate-50" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="flex items-center space-x-0.5 bg-white rounded border border-slate-300 p-0.5">
                            <ToolbarButton onClick={() => dispatch({type: 'SET_DRAFTING_VIEW', payload: 'all'})} icon={<AllIcon className="w-4 h-4"/>} title="全体" />
                            <ToolbarButton onClick={() => dispatch({type: 'SET_DRAFTING_VIEW', payload: 1})} icon={<Floor1Icon className="w-4 h-4"/>} title="1F" />
                            <ToolbarButton onClick={() => dispatch({type: 'SET_DRAFTING_VIEW', payload: 2})} icon={<Floor2Icon className="w-4 h-4"/>} title="2F" />
                            <ToolbarButton onClick={() => dispatch({type: 'SET_DRAFTING_VIEW', payload: 3})} icon={<Floor3Icon className="w-4 h-4"/>} title="3F" />
                        </div>
                        <div className="flex items-center space-x-0.5 bg-white rounded border border-slate-300 p-0.5">
                            <ToolbarButton onClick={() => dispatch({type: state.mode === 'placement' ? 'UNDO' : 'UNDO_DRAWING'})} icon={<UndoIcon className="w-4 h-4"/>} title="戻る" />
                            <ToolbarButton onClick={() => dispatch({type: state.mode === 'placement' ? 'REDO' : 'REDO_DRAWING'})} icon={<RedoIcon className="w-4 h-4"/>} title="進む" />
                        </div>
                        <div className="flex items-center space-x-0.5 bg-white rounded border border-slate-300 p-0.5">
                            <ToolbarButton onClick={handleZoomOut} icon={<MinusIcon className="w-4 h-4"/>} title="縮小" />
                            <div className="relative w-[3rem] h-full flex items-center justify-center">
                                <input 
                                    type="text"
                                    value={zoomInput}
                                    onChange={(e) => setZoomInput(e.target.value)}
                                    onFocus={() => setIsEditingZoom(true)}
                                    onBlur={handleZoomCommit}
                                    onKeyDown={handleZoomKeyDown}
                                    className="w-full h-full text-[10px] font-medium text-slate-600 text-center bg-transparent border-none focus:ring-0 p-0 outline-none"
                                />
                                <span className="absolute right-0 pointer-events-none text-[10px] text-slate-400 mr-0.5">%</span>
                            </div>
                            <ToolbarButton onClick={handleZoomIn} icon={<PlusIcon className="w-4 h-4"/>} title="拡大" />
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                {isOpen && (
                    <div className="flex-grow overflow-y-auto p-3 custom-scrollbar relative bg-white">
                        {activeTab === 'drafting' && <DraftingToolbar />}

                        {activeTab === 'placement' && (
                            <div className="space-y-6">
                                <UnitSelector selectedUnit={state.selectedUnit} onSelect={(u) => dispatch({ type: 'SELECT_UNIT', payload: u })} />
                                <div className="pt-4 border-t border-slate-100">
                                    <AreaCalculator />
                                </div>
                            </div>
                        )}

                        {activeTab === 'file' && <FileTabContent onAction={handleFileAction} />}
                        {activeTab === 'help' && <HelpTabContent />}
                    </div>
                )}

                {/* Resize Handles */}
                {isOpen && (
                    <>
                        <div 
                            className="absolute bottom-0 left-0 right-6 h-2 cursor-ns-resize z-50 hover:bg-blue-50/50"
                            onMouseDown={(e) => handleResizeMouseDown(e, 'y')}
                        />
                        <div 
                            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 flex items-end justify-end p-1 hover:bg-slate-100 rounded-tl"
                            onMouseDown={(e) => handleResizeMouseDown(e, 'xy')}
                        >
                            <svg viewBox="0 0 10 10" className="w-4 h-4 text-slate-400">
                                <path d="M10 10 L10 2 L2 10 Z" fill="currentColor" />
                            </svg>
                        </div>
                    </>
                )}
            </div>
        </>
    );
});