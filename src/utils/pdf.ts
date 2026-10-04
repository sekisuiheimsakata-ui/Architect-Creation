
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, PlacedUnit } from '../types';
import { PdfLayout } from '../components/PdfLayout';
import { PaperSize, PaperOrientation } from '../components/PrintLayout';
import { generateFilename } from './filenameGenerator';
import { PAGE_DIMENSIONS } from '../constants';
import { calculateLayoutMetrics } from './layoutCalculator';


const BORDER_MARGIN = 10;

// --- Calculation logic from PdfLayout.tsx, adapted for metrics calculation ---
// This avoids rendering to the DOM just to get dimensions.

const renderPage = (state: AppState, options: { size: PaperSize; orientation: PaperOrientation }): Promise<SVGSVGElement> => {
    return new Promise((resolve, reject) => {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        document.body.appendChild(container);

        const cleanup = () => {
            const root = (container as any)._reactRootContainer;
            if (root) root.unmount();
            if (container.parentNode) container.parentNode.removeChild(container);
        };

        const onRenderComplete = (svgElement: SVGSVGElement | null) => {
            cleanup();
            if (svgElement) {
                resolve(svgElement);
            } else {
                reject(new Error("Failed to get SVG element for PDF generation."));
            }
        };

        const { width: pageWidth, height: pageHeight } = PAGE_DIMENSIONS[options.size][options.orientation];

        const root = createRoot(container);
        root.render(createElement(PdfLayout, { state, onReady: onRenderComplete, pageWidth, pageHeight }));
    });
};

export const exportPdf = async (state: AppState, options: { size: PaperSize; orientation: PaperOrientation; includedLayers: number[] }) => {
    try {
        const { width: pageWidth, height: pageHeight } = PAGE_DIMENSIONS[options.size][options.orientation];

        const activeFloors = state.present
            .map((grid, floorIndex) => {
                const units = grid.flatMap((row, r) => row.map((unit, c) => unit ? { unit, r, c } : null).filter(Boolean));
                return { floorIndex, units: units as { unit: PlacedUnit; r: number; c: number; }[] };
            })
            .filter(f => f.units.length > 0);

        if (activeFloors.length === 0 && state.drawingLayers.every(l => l.paths.length === 0)) {
            alert("配置されたユニットや描画がありません。PDFは出力されません。");
            return;
        }

        const allUnitPositions = activeFloors.flatMap(f => f.units.map(u => ({ ...u, floor: f.floorIndex })));

        let pageGroups: { floorIndex: number; units: { unit: PlacedUnit; r: number; c: number; }[] }[][] = [[]];

        if (activeFloors.length > 0) {
            // Strategy 1: All floors on one page
            if (calculateLayoutMetrics(activeFloors, allUnitPositions, pageWidth, pageHeight, BORDER_MARGIN).fits) {
                pageGroups = [activeFloors];
            } 
            // Strategy 2 (for 3 floors): Try 1-2F / 3F split
            else if (activeFloors.length === 3) {
                const group1_2 = activeFloors.filter(f => f.floorIndex < 2);
                const group3 = activeFloors.filter(f => f.floorIndex === 2);
                if (calculateLayoutMetrics(group1_2, allUnitPositions, pageWidth, pageHeight, BORDER_MARGIN).fits && calculateLayoutMetrics(group3, allUnitPositions, pageWidth, pageHeight, BORDER_MARGIN).fits) {
                    pageGroups = [group1_2, group3];
                }
                // Strategy 3 (for 3 floors): Try 1F / 2-3F split
                else {
                    const group1 = activeFloors.filter(f => f.floorIndex === 0);
                    const group2_3 = activeFloors.filter(f => f.floorIndex > 0);
                     if (calculateLayoutMetrics(group1, allUnitPositions, pageWidth, pageHeight, BORDER_MARGIN).fits && calculateLayoutMetrics(group2_3, allUnitPositions, pageWidth, pageHeight, BORDER_MARGIN).fits) {
                        pageGroups = [group1, group2_3];
                     } else {
                        // Strategy 4: One floor per page
                        pageGroups = activeFloors.map(f => [f]);
                     }
                }
            }
            // Fallback: One floor per page
            else {
                pageGroups = activeFloors.map(f => [f]);
            }
        }
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: options.orientation,
            unit: 'mm',
            format: options.size,
        });
        
        for (let i = 0; i < pageGroups.length; i++) {
            const group = pageGroups[i];
            const floorIndexesInGroup = new Set(group.map(f => f.floorIndex));

            const pageState: AppState = {
                ...state,
                present: state.present.map((grid, index) =>
                    floorIndexesInGroup.has(index) ? grid : grid.map(row => row.map(() => null))
                ),
                drawingLayers: state.drawingLayers.map(layer => ({
                    ...layer,
                    // Map included status back to visibility. 
                    // If included: respect original state (unless hidden, force visible?), or just default to visible?
                    // Strategy: If included in options, ensure it's not hidden. If it was faint, keep faint. If visible, keep visible.
                    visibility: options.includedLayers.includes(layer.id) 
                        ? (layer.visibility === 'hidden' ? 'visible' : layer.visibility)
                        : 'hidden'
                })),
            };

            if (i > 0) {
                pdf.addPage();
            }

            const svgElement = await renderPage(pageState, options);
            
            const textElements = Array.from(svgElement.querySelectorAll('text'));

            if (textElements.length > 0) {
                // 1. Render background (no text) by removing text from a clone
                const backgroundSvg = svgElement.cloneNode(true) as SVGSVGElement;
                backgroundSvg.querySelectorAll('text').forEach(t => t.remove());
                await pdf.svg(backgroundSvg, { x: 0, y: 0, width: pageWidth, height: pageHeight });

                // 2. Render text as an image overlay
                const textOnlySvg = svgElement.cloneNode(true) as SVGSVGElement;
                // Hide all graphical elements so only text remains visible
                textOnlySvg.querySelectorAll('path, rect, circle').forEach((el) => {
                    const svgEl = el as unknown as SVGGraphicsElement;
                    if (!svgEl.closest('defs')) {
                        svgEl.style.visibility = 'hidden';
                    }
                });
                
                const textSvgString = new XMLSerializer().serializeToString(textOnlySvg);
                const svgBlob = new Blob([textSvgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);

                try {
                    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.onerror = () => reject(new Error('Failed to load SVG text as image.'));
                        img.src = url;
                    });
                    
                    const dpi = 300;
                    const canvas = document.createElement('canvas');
                    canvas.width = (pageWidth / 25.4) * dpi;
                    canvas.height = (pageHeight / 25.4) * dpi;
                    
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/png');
                        pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
                    }
                } finally {
                    URL.revokeObjectURL(url);
                }

            } else {
                await pdf.svg(svgElement, {
                    x: 0, y: 0, width: pageWidth, height: pageHeight,
                });
            }
        }
        
        const filename = generateFilename(state, 'pdf', options);
        pdf.save(filename);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Failed to generate PDF:", errorMessage);
        alert(`PDFの生成に失敗しました:\n${errorMessage}`);
    }
};