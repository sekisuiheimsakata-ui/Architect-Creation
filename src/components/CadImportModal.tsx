import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useAppContext } from '../state/AppContext';
import { DrawingPath, RegisteredPart } from '../types';
import { PAGE_DIMENSIONS } from '../constants';
import { parseDxf, parsePartFromDxfString, isDxfContent, DxfParseResult } from '../utils/dxf';
import { parseSvgDrawing, parsePartFromSvgString, SvgDrawingResult } from '../utils/svg';
import { pointsToSvgPath } from '../utils/layoutCalculator';
import { CloseIcon, UploadIcon, CadImportIcon, LayerIcon, RegisterPartIcon } from './Icons';

interface CadImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type DestinationType = 'new_layer' | 'active_layer' | 'part_library';
type ScaleOption = '1/100' | '1/1' | '1/50' | '1/200' | 'fit';
type PositionOption = 'center' | 'origin';

interface ParsedFileData {
    fileName: string;
    format: 'dxf' | 'svg';
    rawText: string;
    dxfResult?: DxfParseResult;
    svgResult?: SvgDrawingResult;
    originalBounds: {
        width: number;
        height: number;
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
    pathCount: number;
}

export const CadImportModal: React.FC<CadImportModalProps> = ({ isOpen, onClose }) => {
    const { state, dispatch } = useAppContext();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);

    // Form states
    const [destination, setDestination] = useState<DestinationType>('new_layer');
    const [newLayerName, setNewLayerName] = useState('');
    const [scaleOption, setScaleOption] = useState<ScaleOption>('1/100');
    const [positionOption, setPositionOption] = useState<PositionOption>('center');
    const [importText, setImportText] = useState<boolean>(false);
    const [textSizeMode, setTextSizeMode] = useState<'auto' | 'fixed' | 'cad'>('auto');
    const [fixedTextSize, setFixedTextSize] = useState<number>(2.2);

    // Current page dimensions
    const pageSize = state.draftingSettings.size;
    const pageOrientation = state.draftingSettings.orientation;
    const { width: pageWidth, height: pageHeight } = PAGE_DIMENSIONS[pageSize][pageOrientation];

    // Current active layer name
    const activeLayer = useMemo(() => {
        return state.drawingLayers.find(l => l.id === state.activeDrawingLayer) || state.drawingLayers[0];
    }, [state.drawingLayers, state.activeDrawingLayer]);

    const handleReset = () => {
        setParsedData(null);
        setNewLayerName('');
        setScaleOption('1/100');
        setPositionOption('center');
        setDestination('new_layer');
        setImportText(true);
        setTextSizeMode('auto');
        setFixedTextSize(2.5);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    // Robust file text reader with Shift-JIS / UTF-8 fallback
    const readFileTextWithFallback = async (file: File): Promise<string> => {
        const buffer = await file.arrayBuffer();
        try {
            const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            return utf8;
        } catch {
            try {
                return new TextDecoder('shift_jis').decode(buffer);
            } catch {
                return new TextDecoder().decode(buffer);
            }
        }
    };

    const processFile = useCallback(async (file: File) => {
        setIsLoading(true);
        try {
            const rawText = await readFileTextWithFallback(file);
            const lowerName = file.name.toLowerCase();

            let format: 'dxf' | 'svg' = 'dxf';
            if (lowerName.endsWith('.svg') || rawText.includes('<svg')) {
                format = 'svg';
            } else if (lowerName.endsWith('.dxf') || isDxfContent(rawText)) {
                format = 'dxf';
            } else {
                throw new Error('対応していないファイル形式です。.dxf または .svg を選択してください。');
            }

            if (format === 'dxf') {
                const dxfRes = parseDxf(rawText, {
                    scale: 1.0,
                    invertY: true,
                    chainLines: true,
                    cleanVertices: true,
                });

                if (dxfRes.paths.length === 0) {
                    alert('DXFファイル内に有効な図形要素（LINE, LWPOLYLINE, CIRCLE, ARC等）が見つかりませんでした。');
                    setIsLoading(false);
                    return;
                }

                const cleanBaseName = file.name.replace(/\.dxf$/i, '');
                setNewLayerName(`${cleanBaseName} (DXF)`);

                // Auto-suggest scale: if coordinates are in mm (> 300mm), 1/100 scale is standard
                const maxDim = Math.max(dxfRes.bounds.width, dxfRes.bounds.height);
                setScaleOption(maxDim > 300 ? '1/100' : '1/1');

                setParsedData({
                    fileName: file.name,
                    format: 'dxf',
                    rawText,
                    dxfResult: dxfRes,
                    originalBounds: dxfRes.bounds,
                    pathCount: dxfRes.paths.length,
                });
            } else {
                const svgRes = parseSvgDrawing(rawText);
                if (!svgRes || svgRes.paths.length === 0) {
                    alert('SVGファイル内に有効なベクター図形が見つかりませんでした。');
                    setIsLoading(false);
                    return;
                }

                const cleanBaseName = file.name.replace(/\.svg$/i, '');
                setNewLayerName(`${cleanBaseName} (SVG)`);

                const maxDim = Math.max(svgRes.bounds.width, svgRes.bounds.height);
                setScaleOption(maxDim > 500 ? '1/100' : '1/1');

                setParsedData({
                    fileName: file.name,
                    format: 'svg',
                    rawText,
                    svgResult: svgRes,
                    originalBounds: svgRes.bounds,
                    pathCount: svgRes.paths.length,
                });
            }
        } catch (err: any) {
            console.error('File parsing error:', err);
            alert(`ファイルの解析に失敗しました: ${err.message || err}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    // Calculate effective scale multiplier
    const numericScale = useMemo(() => {
        if (!parsedData) return 1.0;
        const { width, height } = parsedData.originalBounds;
        const maxDim = Math.max(width, height);

        switch (scaleOption) {
            case '1/100':
                return 0.01;
            case '1/50':
                return 0.02;
            case '1/200':
                return 0.005;
            case '1/1':
                return 1.0;
            case 'fit': {
                if (maxDim <= 0) return 1.0;
                const targetDim = Math.min(pageWidth, pageHeight) * 0.75;
                return targetDim / maxDim;
            }
            default:
                return 1.0;
        }
    }, [scaleOption, parsedData, pageWidth, pageHeight]);

    // Generate paths for preview and final import
    const transformedPaths = useMemo(() => {
        if (!parsedData) return [];

        let basePaths: DrawingPath[] = [];

        if (parsedData.format === 'dxf') {
            // Re-parse with exact scale and text options
            const recomputed = parseDxf(parsedData.rawText, {
                scale: numericScale,
                invertY: true,
                chainLines: true,
                cleanVertices: true,
                importText,
                textSizeMode,
                fixedTextSize,
            });
            basePaths = recomputed.paths;
        } else if (parsedData.svgResult) {
            // Scale SVG paths (filter out text if importText is false)
            basePaths = parsedData.svgResult.paths
                .filter(p => importText || !p.text)
                .map(p => ({
                    ...p,
                    fontSize: p.text ? (textSizeMode === 'fixed' ? fixedTextSize : (p.fontSize || 2.2)) : p.fontSize,
                    points: p.points.map(pt => ({
                        ...pt,
                        x: pt.x * numericScale,
                        y: pt.y * numericScale,
                    })),
                }));
        }

        if (basePaths.length === 0) return [];

        // Bounding box of scaled paths
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of basePaths) {
            for (const pt of p.points) {
                if (pt.x < minX) minX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y > maxY) maxY = pt.y;
            }
        }

        const geomCenterX = (minX + maxX) / 2;
        const geomCenterY = (minY + maxY) / 2;

        let offsetX = 0;
        let offsetY = 0;

        if (positionOption === 'center') {
            offsetX = (pageWidth / 2) - geomCenterX;
            offsetY = (pageHeight / 2) - geomCenterY;
        }

        // Apply final offset
        return basePaths.map(p => ({
            ...p,
            id: `cad-imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            points: p.points.map(pt => ({
                ...pt,
                x: pt.x + offsetX,
                y: pt.y + offsetY,
            })),
        }));
    }, [parsedData, numericScale, positionOption, importText, textSizeMode, fixedTextSize, pageWidth, pageHeight]);

    // Handle Confirm Import
    const handleConfirmImport = () => {
        if (!parsedData || transformedPaths.length === 0) return;

        if (destination === 'new_layer') {
            const finalName = newLayerName.trim() || `${parsedData.fileName} (${parsedData.format.toUpperCase()})`;
            dispatch({
                type: 'IMPORT_CAD_LAYER',
                payload: {
                    name: finalName,
                    paths: transformedPaths,
                },
            });
            alert(`新規レイヤー「${finalName}」に${transformedPaths.length}個の図形を読み込みました。`);
        } else if (destination === 'active_layer') {
            dispatch({
                type: 'ADD_DRAWING_PATHS',
                payload: { paths: transformedPaths },
            });
            dispatch({ type: 'SET_MODE', payload: 'drafting' });
            alert(`レイヤー「${activeLayer?.name || '現在のレイヤー'}」に${transformedPaths.length}個の図形を追加しました。`);
        } else if (destination === 'part_library') {
            // Register as part
            let part: RegisteredPart | null = null;
            if (parsedData.format === 'dxf') {
                part = parsePartFromDxfString(parsedData.rawText, parsedData.fileName, { importText });
            } else {
                part = parsePartFromSvgString(parsedData.rawText);
                if (part && !importText) {
                    part.paths = part.paths.filter(p => !p.text);
                }
            }

            if (part) {
                if (newLayerName.trim()) {
                    part.name = newLayerName.trim();
                }
                dispatch({
                    type: 'IMPORT_REGISTERED_PARTS',
                    payload: { parts: [part] },
                });
                alert(`パーツ「${part.name}」として登録しました。パーツ一覧からキャンバスに配置できます。`);
            } else {
                alert('パーツの生成に失敗しました。');
                return;
            }
        }

        handleClose();
    };

    if (!isOpen) return null;

    // Dimension formatting helper
    const renderDimensionInfo = () => {
        if (!parsedData) return null;
        const { width, height } = parsedData.originalBounds;

        if (parsedData.format === 'dxf' && Math.max(width, height) > 300) {
            const widthM = (width / 1000).toFixed(2);
            const heightM = (height / 1000).toFixed(2);
            return (
                <span className="text-slate-700 font-semibold">
                    {widthM}m × {heightM}m <span className="text-slate-400 font-normal">({Math.round(width).toLocaleString()}mm × {Math.round(height).toLocaleString()}mm)</span>
                </span>
            );
        }

        return (
            <span className="text-slate-700 font-semibold">
                {width.toFixed(1)}mm × {height.toFixed(1)}mm
            </span>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
                    <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shadow-xs">
                            <CadImportIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 leading-tight">DXF・SVG 図面読込</h2>
                            <p className="text-xs text-slate-500">CAD図面（Jw_cad・AutoCAD DXF）やベクターSVGを読み込みます</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                        title="閉じる"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-grow relative">
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center z-20 space-y-2">
                            <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-bold text-sky-800">CADファイルを解析中...</p>
                        </div>
                    )}
                    {!parsedData ? (
                        /* Step 1: File Drop Zone */
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center space-y-3 ${
                                isDragging
                                    ? 'border-sky-500 bg-sky-50/70 scale-[0.99]'
                                    : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50/50'
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".dxf,.DXF,.svg,.SVG"
                                onChange={handleFileInputChange}
                                className="hidden"
                            />
                            <div className="w-14 h-14 rounded-full bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
                                <UploadIcon className="w-7 h-7" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">
                                    DXFまたはSVGファイルをここにドラッグ＆ドロップ
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    または <span className="text-sky-600 underline font-medium">ファイルを選択</span>
                                </p>
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                                    DXF (Jw_cad / AutoCAD)
                                </span>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-800">
                                    SVG ベクター図面
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                                ※ 日本語レイヤー名・Shift-JIS文字コードにも自動対応しています
                            </p>
                        </div>
                    ) : (
                        /* Step 2: Import Options & Preview */
                        <div className="space-y-6">
                            {/* File Info Card */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-start space-x-3">
                                    <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 font-bold text-xs ${
                                        parsedData.format === 'dxf'
                                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                    }`}>
                                        {parsedData.format.toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-900 truncate max-w-xs sm:max-w-md">
                                            {parsedData.fileName}
                                        </div>
                                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                                            <span>寸法: {renderDimensionInfo()}</span>
                                            <span>要素数: <strong>{parsedData.pathCount}</strong> パス</span>
                                            {parsedData.dxfResult?.layers && (
                                                <span>CADレイヤー: <strong>{parsedData.dxfResult.layers.length}</strong></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="text-xs text-slate-500 hover:text-slate-700 hover:underline shrink-0 self-start sm:self-center"
                                >
                                    別のファイルを選択
                                </button>
                            </div>

                            {/* Mini Vector Preview */}
                            <div className="bg-slate-900/5 rounded-lg border border-slate-200 p-3">
                                <div className="text-xs font-bold text-slate-600 mb-2 flex items-center justify-between">
                                    <span>用紙配置プレビュー ({pageSize.toUpperCase()} {pageOrientation === 'landscape' ? '横' : '縦'} : {pageWidth}mm × {pageHeight}mm)</span>
                                    <span className="text-[11px] text-slate-400 font-normal">
                                        縮尺: {scaleOption === 'fit' ? '用紙フィット' : scaleOption}
                                    </span>
                                </div>
                                <div className="relative w-full h-44 bg-white rounded border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
                                    <svg
                                        viewBox={`0 0 ${pageWidth} ${pageHeight}`}
                                        className="w-full h-full max-h-44 object-contain"
                                        style={{ backgroundColor: '#ffffff' }}
                                    >
                                        {/* Paper Boundary */}
                                        <rect
                                            x={0}
                                            y={0}
                                            width={pageWidth}
                                            height={pageHeight}
                                            fill="#fcfcfd"
                                            stroke="#e2e8f0"
                                            strokeWidth={0.5}
                                        />
                                        {/* Paper Margin Guide */}
                                        <rect
                                            x={10}
                                            y={10}
                                            width={pageWidth - 20}
                                            height={pageHeight - 20}
                                            fill="none"
                                            stroke="#f1f5f9"
                                            strokeWidth={0.5}
                                            strokeDasharray="2,2"
                                        />
                                        {/* Transformed Paths */}
                                        {transformedPaths.map(p => {
                                            if (p.text) {
                                                const pt = p.points[0] || { x: 0, y: 0 };
                                                const fs = p.fontSize || 2.2;
                                                return (
                                                    <text
                                                        key={p.id}
                                                        x={pt.x}
                                                        y={pt.y + fs * 0.85}
                                                        fontSize={fs}
                                                        fontWeight="bold"
                                                        fill={p.color || '#1e293b'}
                                                        textAnchor="start"
                                                    >
                                                        {p.text}
                                                    </text>
                                                );
                                            }
                                            return (
                                                <path
                                                    key={p.id}
                                                    d={pointsToSvgPath(p.points, false)}
                                                    stroke={p.color || '#1e293b'}
                                                    strokeWidth={Math.max(0.3, p.strokeWidth || 0.4)}
                                                    fill={p.fill || 'none'}
                                                    fillOpacity={p.fillOpacity || 0.2}
                                                    strokeLinejoin="round"
                                                    strokeLinecap="round"
                                                />
                                            );
                                        })}
                                    </svg>
                                </div>
                            </div>

                            {/* Options Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Option 1: Destination */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                                        1. 配置先
                                    </label>
                                    <div className="space-y-2">
                                        <label className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                            destination === 'new_layer'
                                                ? 'border-sky-500 bg-sky-50/60 ring-1 ring-sky-300'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}>
                                            <input
                                                type="radio"
                                                name="destination"
                                                value="new_layer"
                                                checked={destination === 'new_layer'}
                                                onChange={() => setDestination('new_layer')}
                                                className="mt-0.5 text-sky-600 focus:ring-sky-500"
                                            />
                                            <div className="ml-2.5 text-xs flex-grow">
                                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                                    <LayerIcon className="w-3.5 h-3.5 text-sky-600" />
                                                    新規レイヤーを作成 (推奨)
                                                </div>
                                                <div className="text-slate-500 mt-0.5 text-[11px]">
                                                    独立した図面レイヤーとして追加します
                                                </div>
                                                {destination === 'new_layer' && (
                                                    <input
                                                        type="text"
                                                        value={newLayerName}
                                                        onChange={e => setNewLayerName(e.target.value)}
                                                        placeholder="レイヤー名"
                                                        className="mt-2 w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
                                                    />
                                                )}
                                            </div>
                                        </label>

                                        <label className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                            destination === 'active_layer'
                                                ? 'border-sky-500 bg-sky-50/60 ring-1 ring-sky-300'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}>
                                            <input
                                                type="radio"
                                                name="destination"
                                                value="active_layer"
                                                checked={destination === 'active_layer'}
                                                onChange={() => setDestination('active_layer')}
                                                className="mt-0.5 text-sky-600 focus:ring-sky-500"
                                            />
                                            <div className="ml-2.5 text-xs">
                                                <div className="font-bold text-slate-800">
                                                    現在のレイヤーに追加
                                                </div>
                                                <div className="text-slate-500 mt-0.5 text-[11px]">
                                                    「{activeLayer?.name || '現在のレイヤー'}」に図形を追加します
                                                </div>
                                            </div>
                                        </label>

                                        <label className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                            destination === 'part_library'
                                                ? 'border-sky-500 bg-sky-50/60 ring-1 ring-sky-300'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}>
                                            <input
                                                type="radio"
                                                name="destination"
                                                value="part_library"
                                                checked={destination === 'part_library'}
                                                onChange={() => setDestination('part_library')}
                                                className="mt-0.5 text-sky-600 focus:ring-sky-500"
                                            />
                                            <div className="ml-2.5 text-xs">
                                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                                    <RegisterPartIcon className="w-3.5 h-3.5 text-indigo-600" />
                                                    パーツとして登録
                                                </div>
                                                <div className="text-slate-500 mt-0.5 text-[11px]">
                                                    パーツライブラリに保存し、いつでも配置可能にします
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Option 2 & 3: Scale & Position */}
                                <div className="space-y-4">
                                    {/* Scale Selection */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                                            2. 縮尺・スケール
                                        </label>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            {[
                                                { id: '1/100', label: '1/100 (実寸mm → 縮尺1/100)', desc: 'CAD建築図面・敷地図' },
                                                { id: '1/1', label: '1/1 (原寸 そのまま)', desc: '作図mmそのまま' },
                                                { id: 'fit', label: '用紙に自動調整', desc: '用紙全体にフィット' },
                                                { id: '1/50', label: '1/50 (詳細図)', desc: '1/100の2倍サイズ' },
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setScaleOption(opt.id as ScaleOption)}
                                                    className={`p-2 rounded-lg border text-left transition-all ${
                                                        scaleOption === opt.id
                                                            ? 'border-sky-500 bg-sky-50/70 text-sky-900 ring-1 ring-sky-300 font-medium'
                                                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                >
                                                    <div className="font-bold text-xs">{opt.label}</div>
                                                    <div className="text-[10px] text-slate-500">{opt.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Position Selection */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                                            3. 配置位置
                                        </label>
                                        <div className="flex gap-2 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => setPositionOption('center')}
                                                className={`flex-1 p-2 rounded-lg border text-left transition-all ${
                                                    positionOption === 'center'
                                                        ? 'border-sky-500 bg-sky-50/70 text-sky-900 ring-1 ring-sky-300 font-medium'
                                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                <div className="font-bold text-xs">用紙中央に配置 (推奨)</div>
                                                <div className="text-[10px] text-slate-500">図面を用紙の中央にセンタリング</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPositionOption('origin')}
                                                className={`flex-1 p-2 rounded-lg border text-left transition-all ${
                                                    positionOption === 'origin'
                                                        ? 'border-sky-500 bg-sky-50/70 text-sky-900 ring-1 ring-sky-300 font-medium'
                                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                <div className="font-bold text-xs">原点 (0, 0) に配置</div>
                                                <div className="text-[10px] text-slate-500">CADの元座標を保持</div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Option 4: Text & Annotation Import Settings */}
                            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                                        4. 図面内の文字・注記（TEXT / MTEXT）の読込
                                    </label>
                                    {parsedData?.dxfResult?.textCount !== undefined && (
                                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                            parsedData.dxfResult.textCount > 0
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            CAD内テキスト: {parsedData.dxfResult.textCount}件
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    {/* Choice A: Skip Text (Recommended) */}
                                    <div
                                        onClick={() => setImportText(false)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                            !importText
                                                ? 'border-sky-500 bg-sky-50/70 ring-1 ring-sky-300 text-sky-950 shadow-xs'
                                                : 'border-slate-200 hover:bg-slate-100/70 text-slate-700 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold flex items-center gap-1.5 text-xs">
                                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                                    !importText ? 'border-sky-600 bg-sky-600' : 'border-slate-400'
                                                }`}>
                                                    {!importText && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </span>
                                                文字を読み込まない（図形線のみ）
                                            </span>
                                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                                                推奨
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                                            文字・寸法値を除外。敷地境界線・壁芯線・間取りなどのベクター線のみをすっきり取り込みます。
                                        </p>
                                    </div>

                                    {/* Choice B: Include Text */}
                                    <div
                                        onClick={() => setImportText(true)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                            importText
                                                ? 'border-sky-500 bg-sky-50/70 ring-1 ring-sky-300 text-sky-950 shadow-xs'
                                                : 'border-slate-200 hover:bg-slate-100/70 text-slate-700 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold flex items-center gap-1.5 text-xs">
                                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                                    importText ? 'border-sky-600 bg-sky-600' : 'border-slate-400'
                                                }`}>
                                                    {importText && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </span>
                                                文字・注記も読み込む
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                                            部屋名や寸法注記を読み込みます。建築標準比率（1.8〜3.0mm）で適正サイズに自動調整されます。
                                        </p>
                                    </div>
                                </div>

                                {/* Detail controls when importText is true */}
                                {importText && (
                                    <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2.5 mt-2 animate-in fade-in duration-100">
                                        <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                            <span>文字サイズ比率の調整:</span>
                                            <span className="text-slate-500 font-normal">
                                                現在の設定: {textSizeMode === 'fixed' ? `${fixedTextSize}mm` : textSizeMode === 'auto' ? '自動最適化 (2.2mm基準)' : 'CAD原寸比率'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => { setTextSizeMode('auto'); setFixedTextSize(2.2); }}
                                                className={`px-2.5 py-1.5 rounded-md border text-left transition-all ${
                                                    textSizeMode === 'auto'
                                                        ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold ring-1 ring-sky-300'
                                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                建築標準 (2.2mm) [推奨]
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setTextSizeMode('fixed'); setFixedTextSize(1.8); }}
                                                className={`px-2.5 py-1.5 rounded-md border text-left transition-all ${
                                                    textSizeMode === 'fixed' && fixedTextSize === 1.8
                                                        ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold ring-1 ring-sky-300'
                                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                小さめ (1.8mm 寸法線向)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setTextSizeMode('fixed'); setFixedTextSize(3.0); }}
                                                className={`px-2.5 py-1.5 rounded-md border text-left transition-all ${
                                                    textSizeMode === 'fixed' && fixedTextSize === 3.0
                                                        ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold ring-1 ring-sky-300'
                                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                大きめ (3.0mm 見出し向)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTextSizeMode('cad')}
                                                className={`px-2.5 py-1.5 rounded-md border text-left transition-all ${
                                                    textSizeMode === 'cad'
                                                        ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold ring-1 ring-sky-300'
                                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                CAD原寸比率
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTextSizeMode('fixed')}
                                                className={`px-2.5 py-1.5 rounded-md border text-left transition-all ${
                                                    textSizeMode === 'fixed' && fixedTextSize !== 1.8 && fixedTextSize !== 3.0
                                                        ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold ring-1 ring-sky-300'
                                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                カスタム指定
                                            </button>
                                        </div>
                                        {textSizeMode === 'fixed' && (
                                            <div className="flex items-center gap-3 pt-1 text-xs bg-slate-50 p-2 rounded border border-slate-200">
                                                <span className="text-slate-600 font-medium">文字高さ:</span>
                                                <input
                                                    type="range"
                                                    min="1.0"
                                                    max="6.0"
                                                    step="0.2"
                                                    value={fixedTextSize}
                                                    onChange={e => setFixedTextSize(parseFloat(e.target.value) || 2.2)}
                                                    className="w-36 accent-sky-600"
                                                />
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        min="0.8"
                                                        max="10"
                                                        step="0.2"
                                                        value={fixedTextSize}
                                                        onChange={e => setFixedTextSize(Math.max(0.8, parseFloat(e.target.value) || 2.2))}
                                                        className="w-16 px-2 py-0.5 border border-slate-300 rounded text-xs text-center bg-white font-bold text-sky-900"
                                                    />
                                                    <span className="text-slate-500">mm</span>
                                                </div>
                                                <span className="text-[11px] text-slate-400">
                                                    (A4/A3用紙上の実寸ミリ)
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
                    >
                        キャンセル
                    </button>
                    {parsedData && (
                        <button
                            onClick={handleConfirmImport}
                            className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
                        >
                            <span>図面を読み込む</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
