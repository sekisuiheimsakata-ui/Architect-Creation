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

export interface CopilotPromptOptions {
  greenery: 'none' | 'subtle' | 'rich'; // 樹木・外構植栽
  annotations: 'keep' | 'none' | 'english'; // 文字・コメント・部屋名
  scale: 'none' | 'with_scale'; // 縮尺・方位記号
  colorTone: 'natural' | 'modern' | 'warm'; // 着彩テーマ
  shadows: 'standard' | 'flat' | 'depth'; // 陰影・立体感
}

export const DEFAULT_PROMPT_OPTIONS: CopilotPromptOptions = {
  greenery: 'none',
  annotations: 'keep',
  scale: 'none',
  colorTone: 'natural',
  shadows: 'standard',
};

export const generateArchitecturalPrompt = (options: CopilotPromptOptions = DEFAULT_PROMPT_OPTIONS): string => {
  const sections: string[] = [];

  // 1. Introduction & Absolute Priority
  sections.push(`添付した住宅平面図を参照し、図面情報を完全維持したまま、建築設計事務所がクライアント提案時に使用する高級感のある手描き建築プレゼンテーションボードへ変換してください。

【最優先事項】
この作業は「デザイン変更」ではなく「表現変換」です。

添付図面の下記情報を完全保持すること。
・外形形状
・壁位置
・柱位置
・開口位置
・窓寸法
・建具位置
・階段形状
・階段段数
・家具配置
・設備配置
・外構形状
・駐車場形状
・アプローチ形状
・寸法関係
・部屋構成
・収納位置

平面計画の変更は禁止。
壁の追加削除禁止。
家具変更禁止。
窓変更禁止。
設備変更禁止。
レイアウト変更禁止。
${options.greenery === 'none' ? '植栽追加禁止。\n' : ''}
図面を忠実にトレースしたうえで表現のみ変更する。`);

  // 2. Drawing Style
  sections.push(`【描画スタイル】
高級建築設計事務所のプレゼンボード。
建築雑誌掲載品質。
設計コンペ提出パネル品質。
トップビュー平面図。
パース化禁止。
3D化禁止。
フォトリアル化禁止。
プレゼン用建築スケッチとして描く。`);

  // 3. Line Work
  sections.push(`【線画表現】
外壁：やや太い鉛筆線
間仕切壁：明瞭な中太線
家具：繊細な鉛筆線
建具：正確で読みやすい線
設備：淡い線画
階段：段数を維持して丁寧に描写
手描きの揺らぎを少し残す
線の強弱を使い建築図面らしい表現とする`);

  // 4. Color Tone
  if (options.colorTone === 'natural') {
    sections.push(`【着彩（淡彩ナチュラル）】
ごく淡い透明水彩
色数は最小限
使用色：
・ウォームグレー
・ライトベージュ
・淡いオーク色
・淡い木質ブラウン
・セージグリーン
・薄いグレー
床：淡い木質色
家具：ライトグレー
水廻り：薄いグレー
建物外部：ごく薄いウォームグレー
彩度は低く上品に`);
  } else if (options.colorTone === 'modern') {
    sections.push(`【着彩（シック・モダン）】
洗練されたモノトーン・モダンテイスト
色数は最小限、無彩色ベースの上品な水彩
使用色：
・クールグレー
・ウォームグレー
・ライトチャコール
・淡いアッシュウッド
・ホワイト
床：淡いアッシュグレー〜ナチュラルグレー
家具：ライトグレー〜オフホワイト
水廻り：清潔感のある極淡いブルーグレー
建物外部：洗練されたライトグレー
彩度を抑えスタイリッシュに仕上げる`);
  } else {
    sections.push(`【着彩（和モダン・アースカラー）】
上質な和モダン・アースカラーテイスト
しっとりとした品格と温かみのある彩色
使用色：
・生成り色
・淡いオークウッド
・淡い煤竹色
・利休白茶
・薄墨グレー
床：深みのある淡い無垢材色
家具：生成り〜グレージュ
水廻り：薄い和紙風グレー
建物外部：落ち着いたトープグレー
彩度は低く自然素材の質感を表現`);
  }

  // 5. Landscaping & Greenery
  if (options.greenery === 'none') {
    sections.push(`【外構・植栽】
植栽追加禁止。
不要な樹木スケッチ禁止。
図面の線画・外形のみを純粋に保持すること。`);
  } else if (options.greenery === 'subtle') {
    sections.push(`【外構・植栽（駐車スペースの絶対確保）】
最優先遵守事項：
駐車場（カースペース・車路・道路からの乗り入れ部）への樹木・植栽の配置は一切禁止。車が安全に出入庫できるクリアな駐車スペース（土間コンクリート等の舗装面）を完全に維持すること。

植栽を配置してよい場所（限定）：
・敷地境界（フェンス・ブロック沿い）
・玄関アプローチ脇の専用植栽帯
・主庭または中庭
上記以外の場所（特に駐車エリア・車路・人の動線上）への植栽のはみ出し・植え込みは厳禁。

樹木表現：
図面を邪魔しない品の良い淡い手描き樹木（シンボルツリー1〜2本、低木添景）を控えめに追加。淡いセージグリーンでやさしく着彩し、建物の佇まいを引き立てる。`);
  } else {
    sections.push(`【外構・植栽（駐車スペースの絶対確保）】
最優先遵守事項：
駐車場（カースペース・車路・道路からの乗り入れ部）への樹木・植栽の配置は一切禁止。車が安全に出入庫できるクリアな駐車スペース（土間コンクリート等の舗装面）を完全に維持すること。

植栽を配置してよい場所（限定）：
・敷地境界（フェンス・ブロック沿い）
・玄関アプローチ脇の植栽スペース
・主庭またはテラス周辺
上記以外の場所（特に駐車エリア・車路・人の動線上）への植栽のはみ出し・植え込みは厳禁。

樹木表現：
敷地境界や庭スペースに、手描きの豊かな植栽・シンボルツリー・季節感のある緑地グラウンドカバーを描く。淡い水彩グリーンと柔らかな陰影で、自然と美しく調和した住まいを演出。（※建物の外形、窓や玄関、駐車スペースは決して遮らないこと）`);
  }

  // 6. Text & Annotations
  if (options.annotations === 'keep') {
    sections.push(`【文字・部屋名】
元の図面にある部屋名や主要な室名表示（LDK, 洋室, 玄関等）を、建築家の手描きレタリング風に読みやすく美しく保持すること。
不要なキャッチコピーや英字ポエムの勝手な追加は禁止。`);
  } else if (options.annotations === 'none') {
    sections.push(`【文字・部屋名】
図面上の文字・コメント・室名・タイトルはすべて非表示・削除。
文字は一切描かず、純粋な線画と着彩のみで表現し、クリーンな余白を美しく保つこと。`);
  } else {
    sections.push(`【文字・部屋名】
部屋名は洗練された建築英語表記（LIVING & DINING, KITCHEN, BEDROOM, ENTRANCE, CLOSET, BATH 等）で、ミニマルかつ上品な手描きレタリングとして配置。
不要な長文キャッチコピーは禁止。`);
  }

  // 7. Scale & North Arrow
  if (options.scale === 'none') {
    sections.push(`【縮尺・方位】
縮尺バーや方位記号は配置せず、余白をすっきりと大きく取ったミニマルなボードとする。`);
  } else {
    sections.push(`【縮尺・方位】
余白の隅に、建築図面らしい洗練されたミニマルなスケールバー（Scale: 1/100）と、シンプルな北向き方位記号（North Arrow）を品よく配置。`);
  }

  // 8. Shadows & Hatching
  if (options.shadows === 'standard') {
    sections.push(`【陰影】
家具下に軽い影
壁際に淡いハッチング
自然な奥行き表現
強い陰影禁止
図面可読性を最優先`);
  } else if (options.shadows === 'flat') {
    sections.push(`【陰影】
影やハッチングは最小限に抑え、軽快でクリーンなフラットグラフィック調とする。
線画と淡い着彩自体の美しさを際立たせる。`);
  } else {
    sections.push(`【陰影】
自然光を意識した淡い日影表現。
家具下や壁際に柔らかな影と繊細な鉛筆ハッチングを入れ、空間の奥行きと光の気配を豊かに描写。
図面の線画・可読性を損なわない範囲にとどめること。`);
  }

  // 9. Board Design & Output Quality
  sections.push(`【ボードデザイン】
白背景
余白を大きく取る
図面を主役にする
不要なキャッチコピー禁止
不要なタイトル禁止
不要な人物禁止
不要な装飾禁止
シンプルで美しいレイアウト
建築家のプレゼンボードらしい上質な紙質感

【出力品質】
建築雑誌掲載レベル
高級住宅提案資料レベル
建築家による鉛筆＋淡彩水彩スケッチ
平面図の可読性最優先
元図との一致率を最大化`);

  return sections.join('\n\n━━━━━━━━━━━━━━━\n\n');
};

export const DEFAULT_COPILOT_PROMPT = generateArchitecturalPrompt(DEFAULT_PROMPT_OPTIONS);

interface CopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
}

export const CopilotModal: React.FC<CopilotModalProps> = ({ isOpen, onClose, state }) => {
  const [promptOptions, setPromptOptions] = useState<CopilotPromptOptions>(DEFAULT_PROMPT_OPTIONS);
  const [promptText, setPromptText] = useState<string>(DEFAULT_COPILOT_PROMPT);
  const [isOptionsExpanded, setIsOptionsExpanded] = useState<boolean>(true);
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

  // Handle option changes
  const handleOptionChange = <K extends keyof CopilotPromptOptions>(key: K, value: CopilotPromptOptions[K]) => {
    const nextOptions = { ...promptOptions, [key]: value };
    setPromptOptions(nextOptions);
    setPromptText(generateArchitecturalPrompt(nextOptions));
  };

  const handleResetPrompt = () => {
    setPromptOptions(DEFAULT_PROMPT_OPTIONS);
    setPromptText(generateArchitecturalPrompt(DEFAULT_PROMPT_OPTIONS));
  };

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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
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
          
          {/* Left Column: Drawing Image & Controls (6 cols) */}
          <div className="lg:col-span-6 flex flex-col space-y-4">
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

          {/* Right Column: Prompt Customizer & Execution (6 cols) */}
          <div className="lg:col-span-6 flex flex-col space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col h-full">
              
              {/* Prompt Options Box */}
              <div className="mb-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
                <div 
                  className="px-3.5 py-2 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsOptionsExpanded(!isOptionsExpanded)}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">🎛️</span>
                    <span className="text-xs font-bold text-slate-800">プロンプト生成オプション</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                      自動反映
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    {isOptionsExpanded ? '閉じる ▲' : '設定を変更 ▼'}
                  </button>
                </div>

                {isOptionsExpanded && (
                  <div className="p-3.5 space-y-2.5 text-xs bg-white">
                    {/* 1. 樹木・外構植栽 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-slate-700">🌲 樹木・外構添景:</span>
                        <span className="text-[10px] text-slate-400">
                          {promptOptions.greenery === 'none' ? '図面のみ保持' : promptOptions.greenery === 'subtle' ? 'シンボルツリー等' : '庭・アプローチ緑化'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'none', label: 'なし (図面厳守)' },
                          { id: 'subtle', label: '控えめ (添景)' },
                          { id: 'rich', label: '豊か (庭園緑化)' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleOptionChange('greenery', opt.id as any)}
                            className={`text-[11px] py-1 px-1 rounded-md border font-medium transition-all text-center ${
                              promptOptions.greenery === opt.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. 文字・コメント・部屋名 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-slate-700">📝 文字・部屋名表示:</span>
                        <span className="text-[10px] text-slate-400">
                          {promptOptions.annotations === 'keep' ? '図面通り保持' : promptOptions.annotations === 'none' ? '文字なし' : '英語レタリング'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'keep', label: '図面通り保持' },
                          { id: 'none', label: '文字なし (線画のみ)' },
                          { id: 'english', label: '英語表記 (LDK等)' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleOptionChange('annotations', opt.id as any)}
                            className={`text-[11px] py-1 px-1 rounded-md border font-medium transition-all text-center ${
                              promptOptions.annotations === opt.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. 縮尺・方位記号 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-slate-700">📐 縮尺・方位記号:</span>
                        <span className="text-[10px] text-slate-400">
                          {promptOptions.scale === 'none' ? '余白重視' : 'Scale 1/100・方位あり'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'none', label: 'なし (シンプル余白)' },
                          { id: 'with_scale', label: 'あり (1/100・方位)' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleOptionChange('scale', opt.id as any)}
                            className={`text-[11px] py-1 px-1 rounded-md border font-medium transition-all text-center ${
                              promptOptions.scale === opt.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4. 着彩テイスト */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-slate-700">🎨 着彩テイスト:</span>
                        <span className="text-[10px] text-slate-400">
                          {promptOptions.colorTone === 'natural' ? '淡彩ナチュラル' : promptOptions.colorTone === 'modern' ? 'シック・モダン' : '和モダン・アース'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'natural', label: '淡彩ナチュラル' },
                          { id: 'modern', label: 'シック・モダン' },
                          { id: 'warm', label: '和モダン・アース' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleOptionChange('colorTone', opt.id as any)}
                            className={`text-[11px] py-1 px-1 rounded-md border font-medium transition-all text-center ${
                              promptOptions.colorTone === opt.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 5. 陰影・立体感 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-slate-700">🌤️ 陰影表現:</span>
                        <span className="text-[10px] text-slate-400">
                          {promptOptions.shadows === 'standard' ? '標準陰影' : promptOptions.shadows === 'flat' ? 'フラット' : '日影・奥行き強調'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'standard', label: '標準 (影+ハッチング)' },
                          { id: 'flat', label: 'フラット (陰影なし)' },
                          { id: 'depth', label: '奥行き強調 (光と影)' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleOptionChange('shadows', opt.id as any)}
                            className={`text-[11px] py-1 px-1 rounded-md border font-medium transition-all text-center ${
                              promptOptions.shadows === opt.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Prompt Text Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">生成プロンプト（編集可）</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                    {promptText.length} 文字
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setPromptText(generateArchitecturalPrompt(promptOptions))}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                    title="選択中のオプションから再生成"
                  >
                    オプションから再生成
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleResetPrompt}
                    className="text-[11px] text-slate-500 hover:text-slate-800 font-medium hover:underline"
                    title="すべてのオプションを初期値にリセット"
                  >
                    初期設定
                  </button>
                </div>
              </div>

              {/* Prompt Textarea */}
              <div className="flex-1 min-h-[180px] flex flex-col">
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
