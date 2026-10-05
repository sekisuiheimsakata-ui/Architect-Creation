import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AppState } from '../types';
import type { PaperSize, PaperOrientation } from './PrintLayout';
import { 
  renderDrawingToPngBlob, 
  copyImageBlobToClipboard, 
  copyTextToClipboard, 
  downloadBlobFile 
} from '../utils/imageExport';
import { generateFilename } from '../utils/filenameGenerator';
import { 
  SparklesIcon, 
  ClipboardCopyIcon, 
  CheckIcon, 
  CloseIcon, 
  ExternalLinkIcon 
} from './Icons';

export const DEFAULT_COPILOT_PROMPT = `添付した住宅平面図を基に、建築設計事務所がクライアント提案時に使用する高級感のある手描き建築プレゼンテーションボードへ変換してください。

【最重要事項】
元図の間取り・壁位置・柱位置・開口部・建具・階段・家具配置・設備配置・寸法関係を完全保持すること。
平面計画の変更、壁の追加削除、家具配置変更は禁止。
図面情報を忠実に維持したまま表現のみを建築家のスケッチへ置き換える。

【表現スタイル】
建築家による高級住宅提案書レベルの手描きスケッチ。
建築雑誌掲載品質。
設計コンペパネル品質。
上質な鉛筆線画＋淡い透明水彩着彩。

【線の描写】
外壁：
やや太めの鉛筆線。

間仕切壁：
明瞭な中太線。

家具・設備：
繊細で軽やかな鉛筆線。

建具：
正確で読みやすく描写。

階段：
段数や向きを保持して表現。

【着彩】
色数は最小限に抑える。

使用色：
・ウォームグレー
・ライトベージュ
・淡いオーク色
・淡い木質ブラウン
・セージグリーン
・ごく薄いグレー

彩度は低く自然な建築表現。

床：
淡い木質色。

家具：
ベージュ〜ライトグレー。

植栽：
淡いグリーン。

水廻り：
ごく薄いグレー。

【陰影表現】
強すぎない自然な陰影。

壁際や家具下に軽い影。

手描きハッチングを使用。

空間の奥行きを表現するが図面可読性を損なわないこと。

【プレゼンボード表現】
白背景。

余白を美しく確保。

高級建築設計事務所の提案資料風。

紙に鉛筆と水彩で描いたような自然な質感。

図面を中心に見せる構成。

不要なテクスチャや装飾は禁止。

【禁止事項】
パース化しない。
3D化しない。
CG風表現禁止。
アニメ風禁止。
過度な水彩表現禁止。
過度な着彩禁止。
不要な人物追加禁止。
不要な樹木追加禁止。
レイアウト変更禁止。
寸法関係変更禁止。

【出力】
トップビュー平面図。
建築家による高品質な手描き平面スケッチ。
図面の可読性を最優先。
高級住宅提案書および建築雑誌掲載レベルの建築プレゼンテーションボード。`;

interface CopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
}

export const CopilotModal: React.FC<CopilotModalProps> = ({ isOpen, onClose, state }) => {
  const [promptText, setPromptText] = useState<string>(DEFAULT_COPILOT_PROMPT);
  const [size, setSize] = useState<PaperSize>(state.draftingSettings.size || 'a3');
  const [orientation, setOrientation] = useState<PaperOrientation>(state.draftingSettings.orientation || 'landscape');
  const [includedLayers, setIncludedLayers] = useState<number[]>(
    state.drawingLayers.filter(l => l.visibility !== 'hidden').map(l => l.id)
  );

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [imageCopyFeedback, setImageCopyFeedback] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update included layers when modal opens
  useEffect(() => {
    if (isOpen) {
      setIncludedLayers(state.drawingLayers.filter(l => l.visibility !== 'hidden').map(l => l.id));
      setSize(state.draftingSettings.size || 'a3');
      setOrientation(state.draftingSettings.orientation || 'landscape');
      setCopiedPrompt(false);
      setCopiedImage(false);
      setImageCopyFeedback(null);
    }
  }, [isOpen, state.drawingLayers, state.draftingSettings]);

  // Generate Image preview when options change
  const generatePreview = useCallback(async () => {
    if (!isOpen) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const result = await renderDrawingToPngBlob(state, {
        size,
        orientation,
        includedLayers,
        scale: 5, // High resolution
      });
      if (isMountedRef.current) {
        setPreviewUrl(result.dataUrl);
        setCurrentBlob(result.blob);
      }
    } catch (err: any) {
      console.error('Failed to generate drawing image for Copilot:', err);
      if (isMountedRef.current) {
        setGenerateError('画像のレンダリングに失敗しました。');
      }
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  }, [isOpen, state, size, orientation, includedLayers]);

  useEffect(() => {
    if (isOpen) {
      generatePreview();
    }
  }, [isOpen, generatePreview]);

  // Copy Prompt handler
  const handleCopyPrompt = async () => {
    const success = await copyTextToClipboard(promptText);
    if (success) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    }
  };

  // Copy Image handler
  const handleCopyImage = async () => {
    if (!currentBlob) return;
    const success = await copyImageBlobToClipboard(currentBlob);
    if (success) {
      setCopiedImage(true);
      setImageCopyFeedback('クリップボードにコピーしました！Copilotで Ctrl+V できます。');
      setTimeout(() => {
        setCopiedImage(false);
        setImageCopyFeedback(null);
      }, 4000);
    } else {
      // Fallback: download image
      const filename = generateFilename(state, 'png', { size, orientation });
      downloadBlobFile(currentBlob, filename);
      setImageCopyFeedback('クリップボードへの直接書き込みが非対応のため、PNG画像を保存しました。Copilotにアップロードしてください。');
      setTimeout(() => setImageCopyFeedback(null), 5000);
    }
  };

  // Download Image handler
  const handleDownloadImage = () => {
    if (!currentBlob) return;
    const filename = generateFilename(state, 'png', { size, orientation });
    downloadBlobFile(currentBlob, filename);
  };

  // Toggle Layer
  const handleLayerToggle = (layerId: number) => {
    setIncludedLayers(prev => 
      prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]
    );
  };

  // Open Copilot web
  const handleOpenCopilot = () => {
    window.open('https://copilot.microsoft.com', '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-amber-300 shadow-inner">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Windows Copilot 画像加工連携
                <span className="text-[11px] font-semibold bg-amber-400 text-indigo-950 px-2 py-0.5 rounded-full shadow-sm">
                  手描き建築プレゼンボード作成
                </span>
              </h2>
              <p className="text-xs text-indigo-100 opacity-90 mt-0.5">
                図面の画像データと最適化建築プロンプトをCopilotに渡して、高級感のある手描き建築パース・プレゼン資料に変換します
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title="閉じる"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Quick Step Bar */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 px-6 py-2.5 flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px]">1</span>
              <span className="font-semibold">図面画像をコピー</span>
            </div>
            <span className="text-indigo-300">→</span>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px]">2</span>
              <span className="font-semibold">プロンプトをコピー</span>
            </div>
            <span className="text-indigo-300">→</span>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px]">3</span>
              <span className="font-semibold">Copilot（Win + C）に貼り付けて送信</span>
            </div>
          </div>
          <button
            onClick={handleOpenCopilot}
            className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg border border-indigo-200 transition-colors shadow-xs"
          >
            <span>Copilot Webを開く</span>
            <ExternalLinkIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body: Two-Column Layout */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50">
          
          {/* Left Column: Drawing Image & Controls (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">図面プレビュー</span>
                  <span className="text-[11px] text-slate-400">（高精細PNG出力）</span>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value as PaperSize)}
                    className="text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="a3">A3 用紙</option>
                    <option value="a4">A4 用紙</option>
                  </select>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as PaperOrientation)}
                    className="text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="landscape">横向き</option>
                    <option value="portrait">縦向き</option>
                  </select>
                </div>
              </div>

              {/* Image Preview Box */}
              <div className="relative aspect-[1.414/1] w-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center shadow-inner group">
                {isGenerating ? (
                  <div className="flex flex-col items-center space-y-2 text-slate-500">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium">図面を高画質レンダリング中...</span>
                  </div>
                ) : generateError ? (
                  <div className="text-red-500 text-xs text-center p-4">
                    <p className="font-semibold">{generateError}</p>
                    <button 
                      onClick={generatePreview}
                      className="mt-2 text-xs text-indigo-600 underline hover:text-indigo-800"
                    >
                      再試行
                    </button>
                  </div>
                ) : previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Floor plan preview for Copilot" 
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <span className="text-xs text-slate-400">図面データがありません</span>
                )}
              </div>

              {/* Layer Selection Pills */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">出力に含めるレイヤー:</span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {state.drawingLayers.map(layer => {
                    const isChecked = includedLayers.includes(layer.id);
                    return (
                      <button
                        key={layer.id}
                        type="button"
                        onClick={() => handleLayerToggle(layer.id)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-colors flex items-center space-x-1 ${
                          isChecked 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                            : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                        }`}
                      >
                        <span>{isChecked ? '✓' : '×'}</span>
                        <span>{layer.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Image Action Buttons */}
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={isGenerating || !currentBlob}
                  className={`flex-1 min-w-[200px] flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-bold text-sm transition-all shadow-sm ${
                    copiedImage
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md active:scale-[0.99]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {copiedImage ? <CheckIcon className="w-5 h-5" /> : <ClipboardCopyIcon className="w-5 h-5" />}
                  <span>{copiedImage ? '画像コピー完了！' : '① 図面画像をコピー (Ctrl+V用)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isGenerating || !currentBlob}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  title="PNG画像ファイルとして保存"
                >
                  <span>💾 PNG保存</span>
                </button>
              </div>

              {/* Feedback Alert for Image */}
              {imageCopyFeedback && (
                <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center space-x-2 animate-in fade-in">
                  <CheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{imageCopyFeedback}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Prompt & Execution (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">指定プロンプト</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                    {promptText.length} 文字
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPromptText(DEFAULT_COPILOT_PROMPT)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                >
                  初期プロンプトに戻す
                </button>
              </div>

              {/* Prompt Textarea */}
              <div className="flex-1 min-h-[260px] flex flex-col">
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="w-full flex-1 p-3 text-xs leading-relaxed font-mono bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none transition-colors"
                  placeholder="プロンプトを入力してください..."
                />
              </div>

              {/* Prompt Copy Button */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-bold text-sm transition-all shadow-sm ${
                    copiedPrompt 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-amber-500 hover:bg-amber-600 text-white hover:shadow-md active:scale-[0.99]'
                  }`}
                >
                  {copiedPrompt ? <CheckIcon className="w-5 h-5" /> : <ClipboardCopyIcon className="w-5 h-5" />}
                  <span>{copiedPrompt ? 'プロンプトをコピーしました！' : '② プロンプトをコピー'}</span>
                </button>
              </div>

              {/* Instructions Card */}
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="text-indigo-600">💡</span>
                  Windows Copilotでの使用方法:
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed text-slate-600">
                  <li>キーボードの <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-800 shadow-xs">Win + C</kbd> または Copilot アプリを開きます。</li>
                  <li>チャット欄にコピーした <strong>図面画像を貼り付け (Ctrl+V)</strong> します。</li>
                  <li>続けてコピーした <strong>プロンプトを貼り付け (Ctrl+V)</strong> して送信します。</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>間取り・壁位置・柱・建具・設備・寸法関係を保持する専用プロンプトを設定済み</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
