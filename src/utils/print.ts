
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, PlacedUnit } from '../types';
import { PdfLayout } from '../components/PdfLayout';
import { PaperSize, PaperOrientation } from '../components/PrintLayout';
import { PAGE_DIMENSIONS } from '../constants';
import { calculateLayoutMetrics } from './layoutCalculator';

const BORDER_MARGIN = 10;

const renderPageForPrinting = (state: AppState, options: { size: PaperSize; orientation: PaperOrientation }): Promise<SVGSVGElement> => {
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

        const onReady = (svgElement: SVGSVGElement | null) => {
            cleanup();
            if (svgElement) {
                resolve(svgElement);
            } else {
                reject(new Error("Failed to get SVG element for printing."));
            }
        };

        const { width: pageWidth, height: pageHeight } = PAGE_DIMENSIONS[options.size][options.orientation];

        const root = createRoot(container);
        root.render(createElement(PdfLayout, { state, onReady, pageWidth, pageHeight }));
    });
};

export const directPrint = async (state: AppState, options: { size: PaperSize; orientation: PaperOrientation; includedLayers: number[] }) => {
    try {
        const { width: pageWidth, height: pageHeight } = PAGE_DIMENSIONS[options.size][options.orientation];

        const activeFloors = state.present
            .map((grid, floorIndex) => {
                const units = grid.flatMap((row, r) => row.map((unit, c) => unit ? { unit, r, c } : null).filter(Boolean));
                return { floorIndex, units: units as { unit: PlacedUnit; r: number; c: number; }[] };
            })
            .filter(f => f.units.length > 0);
        
        const allUnitPositions = activeFloors.flatMap(f => f.units.map(u => ({ ...u, floor: f.floorIndex })));

        let pageGroups: { floorIndex: number; units: { unit: PlacedUnit; r: number; c: number; }[] }[][] = [[]];

        if (activeFloors.length > 0) {
            if (calculateLayoutMetrics(activeFloors, allUnitPositions, pageWidth, pageHeight, BORDER_MARGIN).fits) {
                pageGroups = [activeFloors];
            } 
            else if (activeFloors.length === 3) {
                const group1_2 = activeFloors.filter(f => f.floorIndex < 2);
                const group3 = activeFloors.filter(f => f.floorIndex === 2);
                if (calculateLayoutMetrics(group1_2, allUnitPositions, pageWidth, pageHeight, BORDER_MARGIN).fits && calculateLayoutMetrics(group3, allUnitPositions, pageWidth, pageHeight, BORDER_MARGIN).fits) {
                    pageGroups = [group1_2, group3];
                }
                else {
                    const group1 = activeFloors.filter(f => f.floorIndex === 0);
                    const group2_3 = activeFloors.filter(f => f.floorIndex > 0);
                     if (calculateLayoutMetrics(group1, allUnitPositions, pageWidth, pageHeight, BORDER_MARGIN).fits && calculateLayoutMetrics(group2_3, allUnitPositions, pageWidth, pageHeight, BORDER_MARGIN).fits) {
                        pageGroups = [group1, group2_3];
                     } else {
                        pageGroups = activeFloors.map(f => [f]);
                     }
                }
            }
            else {
                pageGroups = activeFloors.map(f => [f]);
            }
        }
        
        if (pageGroups.flat().length === 0 && state.drawingLayers.every(l => l.paths.length === 0)) {
            alert("印刷するユニットや描画がありません。");
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('ポップアップがブロックされました。印刷するにはこのサイトのポップアップを許可してください。');
            return;
        }

        const printDocument = printWindow.document;
        printDocument.write('<!DOCTYPE html><html><head><title>印刷プレビュー</title></head><body></body></html>');

        const style = printDocument.createElement('style');
        style.textContent = `
            @page {
                size: ${options.size} ${options.orientation};
                margin: 0;
            }
            body {
                margin: 0;
            }
            .print-page {
                page-break-after: always;
                width: ${pageWidth}mm;
                height: ${pageHeight}mm;
                overflow: hidden;
            }
            .print-page:last-child {
                page-break-after: auto;
            }
        `;
        printDocument.head.appendChild(style);
        
        for (const group of pageGroups) {
            const floorIndexesInGroup = new Set(group.map(f => f.floorIndex));
            const pageState: AppState = {
                ...state,
                present: state.present.map((grid, index) =>
                    floorIndexesInGroup.has(index) ? grid : grid.map(row => row.map(() => null))
                ),
                drawingLayers: state.drawingLayers.map(layer => ({
                    ...layer,
                    visibility: options.includedLayers.includes(layer.id)
                        ? (layer.visibility === 'hidden' ? 'visible' : layer.visibility)
                        : 'hidden'
                })),
            };
            
            const svgElement = await renderPageForPrinting(pageState, { size: options.size, orientation: options.orientation });
            
            const pageDiv = printDocument.createElement('div');
            pageDiv.className = 'print-page';
            // It's safer to import the node rather than using innerHTML to preserve SVG integrity
            pageDiv.appendChild(printDocument.importNode(svgElement, true));
            printDocument.body.appendChild(pageDiv);
        }
        
        printDocument.close();

        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 250);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Failed to print:", errorMessage);
        alert(`印刷に失敗しました:\n${errorMessage}`);
    }
};