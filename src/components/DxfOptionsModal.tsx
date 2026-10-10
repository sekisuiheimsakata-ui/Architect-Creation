import React, { useState } from 'react';
import { DrawingLayer } from '../types';
import { PaperSize, PaperOrientation } from './PrintLayout';
import { DxfExportOptions } from '../utils/dxfExport';
import { CloseIcon, LayerIcon, FilePlusIcon } from './Icons';

interface DxfOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (options: DxfExportOptions) => void;
    drawingLayers: DrawingLayer[];
    currentSize?: PaperSize;
    currentOrientation?: PaperOrientation;
}

export const DxfOptionsModal: React.FC<DxfOptionsModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    drawingLayers,
    currentSize = 'a3',
    currentOrientation = 'landscape',
}) => {
    const [scaleMode, setScaleMode] = useState<'real_world' | 'paper_mm'>('real_world');
    const [includeText, setIncludeText] = useState<boolean>(true);
    const [size, setSize] = useState<PaperSize>(currentSize);
    const [orientation, setOrientation] = useState<PaperOrientation>(currentOrientation);
    const [includedLayers, setIncludedLayers] = useState<number[]>(() =>
        drawingLayers.filter(l => l.visibility !== 'hidden').map(l => l.id)
    );

    if (!isOpen) return null;

    const handleLayerToggle = (layerId: number) => {
        setIncludedLayers(prev =>
            prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]
        );
    };

    const handleSelectAllLayers = () => {
        setIncludedLayers(drawingLayers.map(l => l.id));
    };

    const handleDeselectAllLayers = () => {
        setIncludedLayers([]);
    };

    const handleConfirm = () => {
        onConfirm({
            size,
            orientation,
            includedLayers,
            scaleMode,
            includeText,
            includeFrame: includedLayers.includes(1000),
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden text-slate-800"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shadow-xs">
                            DXF
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 leading-tight">DXF形式で保存 (.dxf)</h2>
                            <p className="text-xs text-slate-500">AutoCAD・Jw_cad等で開けるCADベクター形式で出力します</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                        title="閉じる"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    {/* 1. Scale Mode Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                            1. 縮尺・寸法単位
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => setScaleMode('real_world')}
                                className={`p-3 rounded-lg border text-left transition-all ${
                                    scaleMode === 'real_world'
                                        ? 'border-sky-500 bg-sky-50/70 text-sky-950 ring-1 ring-sky-300 font-medium shadow-xs'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <div className="font-bold text-xs flex items-center justify-between">
                                    <span>CAD実寸 1:1 (推奨)</span>
                                    <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-bold">1/100換算</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    1m = 1000mmの実寸で出力。AutoCAD/Jw_cadでそのまま寸法計測・設計連携が可能です。
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setScaleMode('paper_mm')}
                                className={`p-3 rounded-lg border text-left transition-all ${
                                    scaleMode === 'paper_mm'
                                        ? 'border-sky-500 bg-sky-50/70 text-sky-950 ring-1 ring-sky-300 font-medium shadow-xs'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <div className="font-bold text-xs">用紙作図mm</div>
                                <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    用紙上のミリ単位（297×210等）そのまま出力します。
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* 2. Text Export Option */}
                    <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            2. 文字・注記の出力
                        </label>
                        <div className="flex gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => setIncludeText(true)}
                                className={`flex-1 p-2 rounded-lg border text-left transition-all ${
                                    includeText
                                        ? 'border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-300 font-bold'
                                        : 'border-slate-200 hover:bg-slate-100 text-slate-700 bg-white'
                                }`}
                            >
                                <div className="text-xs">文字・注記を含める</div>
                                <div className="text-[10px] text-slate-500 font-normal">階数表示や注記TEXTを出力</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIncludeText(false)}
                                className={`flex-1 p-2 rounded-lg border text-left transition-all ${
                                    !includeText
                                        ? 'border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-300 font-bold'
                                        : 'border-slate-200 hover:bg-slate-100 text-slate-700 bg-white'
                                }`}
                            >
                                <div className="text-xs">図形線のみ (文字除外)</div>
                                <div className="text-[10px] text-slate-500 font-normal">線分・外形線のみをクリーンに出力</div>
                            </button>
                        </div>
                    </div>

                    {/* 3. Paper Size & Orientation */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                3. 用紙サイズ
                            </label>
                            <div className="flex gap-2">
                                {(['a3', 'a4'] as PaperSize[]).map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setSize(s)}
                                        className={`flex-1 py-1.5 text-xs font-medium rounded-md border ${
                                            size === s
                                                ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold'
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        {s.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                4. 用紙の向き
                            </label>
                            <div className="flex gap-2">
                                {[
                                    { id: 'landscape', label: '横向き' },
                                    { id: 'portrait', label: '縦向き' },
                                ].map(o => (
                                    <button
                                        key={o.id}
                                        type="button"
                                        onClick={() => setOrientation(o.id as PaperOrientation)}
                                        className={`flex-1 py-1.5 text-xs font-medium rounded-md border ${
                                            orientation === o.id
                                                ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold'
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        {o.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 4. Target Layers */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                                5. 出力レイヤー
                            </label>
                            <div className="flex gap-2 text-[11px] text-sky-600">
                                <button type="button" onClick={handleSelectAllLayers} className="hover:underline">
                                    全選択
                                </button>
                                <span>/</span>
                                <button type="button" onClick={handleDeselectAllLayers} className="hover:underline">
                                    全解除
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                            {drawingLayers.map(layer => (
                                <label
                                    key={layer.id}
                                    className="flex items-center space-x-2 text-xs hover:bg-slate-100/60 p-1 rounded cursor-pointer select-none"
                                >
                                    <input
                                        type="checkbox"
                                        checked={includedLayers.includes(layer.id)}
                                        onChange={() => handleLayerToggle(layer.id)}
                                        className="h-3.5 w-3.5 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                                    />
                                    <span className="font-medium text-slate-800">{layer.name}</span>
                                    <span className="text-[10px] text-slate-400">
                                        ({layer.paths.length}要素)
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        type="button"
                        className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={includedLayers.length === 0}
                        type="button"
                        className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 ${
                            includedLayers.length === 0
                                ? 'bg-slate-300 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
                        }`}
                    >
                        <span>DXFファイルを保存 (.dxf)</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
