
import { AppState } from '../types';
import { PaperSize, PaperOrientation } from '../components/PrintLayout';
import { calculateArea } from './areaCalculator';

export const generateFilename = (state: AppState, extension: 'json' | 'pdf' | 'svg' | 'png', pdfOptions?: { size: PaperSize, orientation: PaperOrientation }): string => {
    const { present, firstFloorDeduction, stairDeductions } = state;
    const areaResult = calculateArea(present, firstFloorDeduction, stairDeductions);
    
    let filenameCore: string;

    if (areaResult.floors.length === 0) {
        filenameCore = 'empty_layout';
    } else {
        const floorStrings = present.map((floorGrid, index) => {
            const unitCountsBySize: { [size: string]: number } = {};
            let hasUnits = false;

            floorGrid.forEach(row => {
                row.forEach(unit => {
                    if (!unit) return;
                    hasUnits = true;
                    const match = unit.name.match(/^(\d+)(フル|サブ)$/);
                    if (match) {
                        const size = match[1];
                        const type = match[2];
                        if (!unitCountsBySize[size]) {
                            unitCountsBySize[size] = 0;
                        }
                        unitCountsBySize[size] += (type === 'フル' ? 1 : 0.5);
                    }
                });
            });

            if (!hasUnits) return '';

            const sortedSizes = Object.keys(unitCountsBySize).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
            const sizeStrings = sortedSizes.map(size => {
                const count = unitCountsBySize[size];
                return `${size}_${Number.isInteger(count) ? count : count.toFixed(1)}`;
            });
            
            return `${index + 1}F:${sizeStrings.join('_')}`;
        });

        const finalFloorString = floorStrings.filter(s => s).join('_');
        const corePart = finalFloorString ? `_${finalFloorString}` : '';
        const formattedArea = areaResult.totalArea.toFixed(2).padStart(6, '0') + (extension === 'json' ? '㎡' : 'm2'); // Use ASCII for filenames usually
        filenameCore = `${formattedArea}${corePart}`;
    }

    if ((extension === 'pdf' || extension === 'svg' || extension === 'png') && pdfOptions) {
      const size = pdfOptions.size.toUpperCase();
      const orientation = pdfOptions.orientation === 'landscape' ? '横' : '縦';
      return `${size}_${orientation}_${filenameCore}.${extension}`;
    }
    
    return `${filenameCore}.${extension}`;
};
