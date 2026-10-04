
import type { PlacedUnit, MultiFloorCalculationResult, FloorCalculation, DeductionOption } from '../types';
import { KETAMEN_CONNECTIONS, TSUMAMEN_CONNECTIONS, TANOJI_AREA, TSUMA_ALPHA_CONTINUOUS_CONNECTIONS, KETA_ALPHA_CONTINUOUS_CONNECTIONS, GRID_ROWS, GRID_COLS } from '../constants';

const parseUnitName = (name: string): { dim: string; type: string | null } => {
    let match = name.match(/^(\d+)(フル|サブ)$/);
    if (match) {
      return { dim: match[1], type: match[2] };
    }
    match = name.match(/^(\d+)(妻α)$/);
    if (match) {
      return { dim: match[1], type: '妻α' };
    }
    match = name.match(/^(\d+)(桁α)\d+$/);
    if (match) {
      return { dim: match[1], type: '桁α' };
    }
    return { dim: '', type: null };
};

const truncate = (num: number): number => Math.floor(num * 100) / 100;

export const calculateArea = (
    presentGrid: (PlacedUnit | null)[][][], 
    firstFloorDeduction: DeductionOption | null,
    stairDeductions: { [floorNumber: number]: DeductionOption | null }
): MultiFloorCalculationResult => {
    
    const finalFloors: FloorCalculation[] = [];

    presentGrid.forEach((floorGrid, floorIndex) => {
        const floorUnits: { unit: PlacedUnit; r: number; c: number }[] = [];
        floorGrid.forEach((row, r) => {
            row.forEach((unit, c) => {
                if (unit) {
                    floorUnits.push({ unit, r, c });
                }
            });
        });

        if (floorUnits.length === 0) {
            return; // Skip empty floors
        }

        let baseUnitArea = 0;
        let ketamenArea = 0;
        let tsumamenArea = 0;
        let tanojiArea = 0;
        
        const floorCoords = new Set(floorUnits.map(fu => `${fu.r},${fu.c}`));

        for (const { unit: currentUnit, r: curR, c: curC } of floorUnits) {
          baseUnitArea += (currentUnit.area || 0);
          const currentUnitInfo = parseUnitName(currentUnit.name);

          // Check Tsumamen (right neighbor) - 東西方向
          if (curC + 1 < GRID_COLS && floorCoords.has(`${curR},${curC + 1}`)) {
            const rightUnit = floorGrid[curR][curC + 1]!;
            const rightUnitInfo = parseUnitName(rightUnit.name);
            const leftType = currentUnitInfo.type;
            const rightType = rightUnitInfo.type;

            const isCurrentKetaAlpha = leftType === '桁α';
            const isRightKetaAlpha = rightType === '桁α';

            if (isCurrentKetaAlpha && isRightKetaAlpha && currentUnitInfo.dim === rightUnitInfo.dim) {
              const dimKey = currentUnitInfo.dim as keyof typeof KETA_ALPHA_CONTINUOUS_CONNECTIONS;
              if (Object.prototype.hasOwnProperty.call(KETA_ALPHA_CONTINUOUS_CONNECTIONS, dimKey)) {
                tsumamenArea += KETA_ALPHA_CONTINUOUS_CONNECTIONS[dimKey];
              }
            } else if (leftType && rightType &&
                Object.prototype.hasOwnProperty.call(TSUMAMEN_CONNECTIONS, leftType) &&
                Object.prototype.hasOwnProperty.call(TSUMAMEN_CONNECTIONS, rightType)) {
              
              const leftArea = TSUMAMEN_CONNECTIONS[leftType as keyof typeof TSUMAMEN_CONNECTIONS];
              const rightArea = TSUMAMEN_CONNECTIONS[rightType as keyof typeof TSUMAMEN_CONNECTIONS];
              
              tsumamenArea += (leftArea + rightArea) / 2.0;
            }
          }

          // Check Ketamen (bottom neighbor) - 南北方向
          if (curR + 1 < GRID_ROWS && floorCoords.has(`${curR + 1},${curC}`)) {
            const bottomUnit = floorGrid[curR + 1][curC]!;
            const bottomUnitInfo = parseUnitName(bottomUnit.name);
            
            const isCurrentMain = currentUnitInfo.type === 'フル' || currentUnitInfo.type === 'サブ';
            const isBottomMain = bottomUnitInfo.type === 'フル' || bottomUnitInfo.type === 'サブ';

            if (isCurrentMain && isBottomMain && currentUnitInfo.dim && bottomUnitInfo.dim) {
                const currentDim = parseInt(currentUnitInfo.dim, 10);
                const bottomDim = parseInt(bottomUnitInfo.dim, 10);
                
                const connectionDim = Math.min(currentDim, bottomDim);
                
                if (Object.prototype.hasOwnProperty.call(KETAMEN_CONNECTIONS, connectionDim)) {
                    ketamenArea += KETAMEN_CONNECTIONS[connectionDim as keyof typeof KETAMEN_CONNECTIONS].area;
                }
            }

            // Logic for continuous Tsuma Alpha units
            const isCurrentAlpha = currentUnitInfo.type === '妻α';
            const isBottomAlpha = bottomUnitInfo.type === '妻α';

            if (isCurrentAlpha && isBottomAlpha && currentUnitInfo.dim === bottomUnitInfo.dim) {
              const dimKey = currentUnitInfo.dim as keyof typeof TSUMA_ALPHA_CONTINUOUS_CONNECTIONS;
              if (Object.prototype.hasOwnProperty.call(TSUMA_ALPHA_CONTINUOUS_CONNECTIONS, dimKey)) {
                ketamenArea += TSUMA_ALPHA_CONTINUOUS_CONNECTIONS[dimKey];
              }
            }
          }

          // Check Tanoji (2x2 block)
          if (floorCoords.has(`${curR},${curC + 1}`) && floorCoords.has(`${curR + 1},${curC}`) && floorCoords.has(`${curR + 1},${curC + 1}`)) {
            const unitTopRight = floorGrid[curR][curC + 1]!;
            const unitBottomLeft = floorGrid[curR + 1][curC]!;
            const unitBottomRight = floorGrid[curR + 1][curC + 1]!;

            const isAlphaInvolved =
              currentUnit.type === 'alpha' ||
              unitTopRight.type === 'alpha' ||
              unitBottomLeft.type === 'alpha' ||
              unitBottomRight.type === 'alpha';

            if (!isAlphaInvolved) {
              tanojiArea += TANOJI_AREA;
            }
          }
        }
        
        const floorTotalArea = baseUnitArea + ketamenArea + tsumamenArea + tanojiArea;
        const mainUnitCount = floorUnits.filter(({ unit }) => unit.type === 'main').length;
        const currentFloorNumber = floorIndex + 1;

        let finalTotal = floorTotalArea;
        let deduction: number | undefined = undefined;
        let deductionLabel: string | undefined = undefined;

        if (currentFloorNumber === 1 && firstFloorDeduction) {
            finalTotal += firstFloorDeduction.value;
            deduction = firstFloorDeduction.value;
            deductionLabel = '引き込み玄関';
        } else if (currentFloorNumber > 1 && stairDeductions[currentFloorNumber]) {
            const stairDeduction = stairDeductions[currentFloorNumber];
            if(stairDeduction) {
                finalTotal += stairDeduction.value;
                deduction = stairDeduction.value;
                deductionLabel = '階段吹抜';
            }
        }

        finalFloors.push({
          floorNumber: currentFloorNumber,
          totalArea: truncate(finalTotal),
          baseUnitArea,
          ketamenArea,
          tsumamenArea,
          tanojiArea,
          unitCount: floorUnits.length,
          mainUnitCount: mainUnitCount,
          deductionArea: deduction,
          deductionLabel,
        });
    });
    
    const totalArea = finalFloors.reduce((sum, floor) => sum + floor.totalArea, 0);
    const totalUnitCount = finalFloors.reduce((sum, floor) => sum + floor.unitCount, 0);
    const totalMainUnitCount = finalFloors.reduce((sum, floor) => sum + floor.mainUnitCount, 0);
    
    return {
      totalArea: truncate(totalArea),
      floors: finalFloors,
      totalUnitCount,
      totalMainUnitCount,
    };
};
