import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppState } from '../types';
import { PdfLayout } from '../components/PdfLayout';
import type { PaperSize, PaperOrientation } from '../components/PrintLayout';
import { PAGE_DIMENSIONS } from '../constants';

export interface ImageExportOptions {
  size: PaperSize;
  orientation: PaperOrientation;
  includedLayers?: number[];
  scale?: number; // scale multiplier, default 6 for high resolution
}

/**
 * Renders the current drawing into an SVGSVGElement using the PdfLayout engine.
 */
export const renderDrawingToSvgElement = async (
  state: AppState,
  options: ImageExportOptions
): Promise<SVGSVGElement> => {
  const { width: pageWidth, height: pageHeight } = PAGE_DIMENSIONS[options.size][options.orientation];
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  const cleanup = () => {
    if (container.parentNode) container.parentNode.removeChild(container);
  };

  return new Promise<SVGSVGElement>((resolve, reject) => {
    const root = createRoot(container);
    const onReady = (svg: SVGSVGElement | null) => {
      setTimeout(() => {
        root.unmount();
        cleanup();
      }, 0);
      if (svg) resolve(svg);
      else reject(new Error('Failed to generate SVG element'));
    };

    const exportState: AppState = {
      ...state,
      drawingLayers: options.includedLayers
        ? state.drawingLayers.map(l => ({
            ...l,
            visibility: options.includedLayers!.includes(l.id)
              ? (l.visibility === 'hidden' ? 'visible' : l.visibility)
              : 'hidden',
          }))
        : state.drawingLayers,
    };

    root.render(
      createElement(PdfLayout, {
        state: exportState,
        onReady,
        pageWidth,
        pageHeight,
        renderAsRootSvg: true,
      })
    );
  });
};

/**
 * Renders the drawing directly into a crisp PNG Blob & Data URL for presentation boards and Copilot input.
 */
export const renderDrawingToPngBlob = async (
  state: AppState,
  options: ImageExportOptions
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> => {
  const { width: pageWidthMm, height: pageHeightMm } = PAGE_DIMENSIONS[options.size][options.orientation];
  
  // 6 pixels per mm delivers sharp, high-res 300dpi-equivalent images (e.g. 1782x1260 for A4)
  const pixelScale = options.scale || 6;
  const canvasWidth = Math.round(pageWidthMm * pixelScale);
  const canvasHeight = Math.round(pageHeightMm * pixelScale);

  const svgElement = await renderDrawingToSvgElement(state, options);

  svgElement.setAttribute('width', `${canvasWidth}px`);
  svgElement.setAttribute('height', `${canvasHeight}px`);

  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgElement);

  // Strip external font @import to avoid security taint when drawing SVG onto canvas
  svgString = svgString.replace(/@import\s+url\([^)]+\);?/g, '');

  if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(svgUrl);
    throw new Error('Canvas 2D rendering context not available');
  }

  // Pure white background for architectural presentation
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      URL.revokeObjectURL(svgUrl);
      resolve();
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(svgUrl);
      reject(err);
    };
    img.src = svgUrl;
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create PNG blob from canvas'));
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');
      resolve({ blob, dataUrl, width: canvasWidth, height: canvasHeight });
    }, 'image/png');
  });
};

/**
 * Copies a PNG Blob directly to the system clipboard so the user can paste (Ctrl+V) directly into Windows Copilot.
 */
export const copyImageBlobToClipboard = async (blob: Blob): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
    return false;
  }
  try {
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn('Failed to copy image to clipboard:', err);
    return false;
  }
};

/**
 * Safely copies text to the system clipboard with fallbacks.
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch {
    return false;
  }
};

/**
 * Downloads any blob with a specified filename.
 */
export const downloadBlobFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
