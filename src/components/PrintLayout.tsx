
import React, { useState } from 'react';
import type { DrawingLayer } from '../types';

export type PaperSize = 'a3' | 'a4';
export type PaperOrientation = 'landscape' | 'portrait';

interface OptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { size: PaperSize; orientation: PaperOrientation; includedLayers: number[] }) => void;
  drawingLayers: DrawingLayer[];
  title: string;
  confirmButtonText: string;
}

const OptionsModal: React.FC<OptionsModalProps> = ({ isOpen, onClose, onConfirm, drawingLayers, title, confirmButtonText }) => {
  const [size, setSize] = useState<PaperSize>('a3');
  const [orientation, setOrientation] = useState<PaperOrientation>('landscape');
  const [includedLayers, setIncludedLayers] = useState<number[]>(
      drawingLayers.filter(l => l.visibility !== 'hidden').map(l => l.id)
  );

  if (!isOpen) {
    return null;
  }
  
  const handleLayerToggle = (layerId: number) => {
    setIncludedLayers(prev => 
        prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]
    );
  };

  const handleConfirm = () => {
    onConfirm({ size, orientation, includedLayers });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      aria-labelledby="options-modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 m-4 w-full max-w-sm transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="options-modal-title" className="text-lg font-bold text-slate-800">
          {title}
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              用紙サイズ
            </label>
            <div className="mt-2 flex space-x-4">
              <div className="flex items-center">
                <input
                  id={`size-a3-${title}`}
                  name={`paper-size-${title}`}
                  type="radio"
                  value="a3"
                  checked={size === 'a3'}
                  onChange={(e) => setSize(e.target.value as PaperSize)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`size-a3-${title}`} className="ml-2 block text-sm text-slate-900">
                  A3
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id={`size-a4-${title}`}
                  name={`paper-size-${title}`}
                  type="radio"
                  value="a4"
                  checked={size === 'a4'}
                  onChange={(e) => setSize(e.target.value as PaperSize)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`size-a4-${title}`} className="ml-2 block text-sm text-slate-900">
                  A4
                </label>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              向き
            </label>
            <div className="mt-2 flex space-x-4">
               <div className="flex items-center">
                <input
                  id={`orientation-landscape-${title}`}
                  name={`paper-orientation-${title}`}
                  type="radio"
                  value="landscape"
                  checked={orientation === 'landscape'}
                  onChange={(e) => setOrientation(e.target.value as PaperOrientation)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`orientation-landscape-${title}`} className="ml-2 block text-sm text-slate-900">
                  横向き
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id={`orientation-portrait-${title}`}
                  name={`paper-orientation-${title}`}
                  type="radio"
                  value="portrait"
                  checked={orientation === 'portrait'}
                  onChange={(e) => setOrientation(e.target.value as PaperOrientation)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`orientation-portrait-${title}`} className="ml-2 block text-sm text-slate-900">
                  縦向き
                </label>
              </div>
            </div>
          </div>
           <div>
            <label className="block text-sm font-medium text-slate-700">
              描画レイヤー
            </label>
            <div className="mt-2 space-y-2">
              {drawingLayers.map(layer => (
                <div key={layer.id} className="flex items-center">
                  <input
                    id={`layer-checkbox-${layer.id}-${title}`}
                    type="checkbox"
                    checked={includedLayers.includes(layer.id)}
                    onChange={() => handleLayerToggle(layer.id)}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor={`layer-checkbox-${layer.id}-${title}`} className="ml-2 block text-sm text-slate-900">
                    {layer.name} を含める
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            type="button"
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export const PdfOptionsModal: React.FC<Omit<OptionsModalProps, 'title' | 'confirmButtonText'>> = (props) => (
  <OptionsModal {...props} title="PDF出力オプション" confirmButtonText="エクスポート" />
);

export const PrintOptionsModal: React.FC<Omit<OptionsModalProps, 'title' | 'confirmButtonText'>> = (props) => (
  <OptionsModal {...props} title="印刷オプション" confirmButtonText="印刷" />
);

export const SvgOptionsModal: React.FC<Omit<OptionsModalProps, 'title' | 'confirmButtonText'>> = (props) => (
  <OptionsModal {...props} title="SVG出力オプション" confirmButtonText="エクスポート" />
);

// New Modal for Drafting Settings
interface DraftingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { size: PaperSize; orientation: PaperOrientation }) => void;
  currentSettings: { size: PaperSize; orientation: PaperOrientation };
}

export const DraftingSettingsModal: React.FC<DraftingSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentSettings,
}) => {
  const [size, setSize] = useState<PaperSize>(currentSettings.size);
  const [orientation, setOrientation] = useState<PaperOrientation>(currentSettings.orientation);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm({ size, orientation });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      aria-labelledby="drafting-settings-modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 m-4 w-full max-w-sm transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="drafting-settings-modal-title" className="text-lg font-bold text-slate-800">
          製図 用紙設定
        </h2>
        <div className="mt-4 space-y-4">
           <div>
            <label className="block text-sm font-medium text-slate-700">
              用紙サイズ
            </label>
            <div className="mt-2 flex space-x-4">
              <div className="flex items-center">
                <input
                  id="draft-size-a3"
                  name="draft-paper-size"
                  type="radio"
                  value="a3"
                  checked={size === 'a3'}
                  onChange={(e) => setSize(e.target.value as PaperSize)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="draft-size-a3" className="ml-2 block text-sm text-slate-900">
                  A3
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="draft-size-a4"
                  name="draft-paper-size"
                  type="radio"
                  value="a4"
                  checked={size === 'a4'}
                  onChange={(e) => setSize(e.target.value as PaperSize)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="draft-size-a4" className="ml-2 block text-sm text-slate-900">
                  A4
                </label>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              向き
            </label>
            <div className="mt-2 flex space-x-4">
               <div className="flex items-center">
                <input
                  id="draft-orientation-landscape"
                  name="draft-paper-orientation"
                  type="radio"
                  value="landscape"
                  checked={orientation === 'landscape'}
                  onChange={(e) => setOrientation(e.target.value as PaperOrientation)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="draft-orientation-landscape" className="ml-2 block text-sm text-slate-900">
                  横向き
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="draft-orientation-portrait"
                  name="draft-paper-orientation"
                  type="radio"
                  value="portrait"
                  checked={orientation === 'portrait'}
                  onChange={(e) => setOrientation(e.target.value as PaperOrientation)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="draft-orientation-portrait" className="ml-2 block text-sm text-slate-900">
                  縦向き
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            type="button"
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            適用
          </button>
        </div>
      </div>
    </div>
  );
};