
import React, { useMemo, useRef, useEffect, memo } from 'react';
import type { PlacedUnit, Unit } from '../types';
import { isPlacementValid } from '../utils/validation';
import { ProhibitedIcon } from './Icons';

interface GridProps {
  rows: number;
  cols: number;
  grid: (PlacedUnit | null)[][][];
  onCellClick: (row: number, col: number, options: { hAlign: 'left' | 'right'; vAlign: 'top' | 'bottom' }) => void;
  onCellDoubleClick: (row: number, col: number) => void;
  selectedUnit: Unit | null;
}

export const GRID_PIXEL_SIZE = 1600;

export const Grid: React.FC<GridProps> = memo(({ 
    rows, cols, grid, onCellClick, onCellDoubleClick, 
    selectedUnit
}) => {
  const clickTimerRef = useRef<{ [key: string]: number }>({});
  const DOUBLE_CLICK_DELAY = 350; // ms

  useEffect(() => {
    const timers = clickTimerRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const colWidths = useMemo(() => {
    return Array.from({ length: cols }, (_, c) => {
      const maxKeta = Math.max(
        0,
        ...grid.flatMap(floor => 
            Array.from({ length: rows }, (_, r) => floor[r][c]?.dimensions.keta || 0)
        )
      );
      // Changed from 9.1 to 9 to match 900mm module alignment
      return maxKeta === 0 ? 9 : maxKeta;
    });
  }, [grid, rows, cols]);

  const rowHeights = useMemo(() => {
    return Array.from({ length: rows }, (_, r) => {
      const maxTsuma = Math.max(
        0,
        ...grid.flatMap(floor => floor[r].map(cell => cell?.dimensions.tsuma || 0))
      );
      // Changed from 9.1 to 9 to match 900mm module alignment
      return maxTsuma === 0 ? 9 : maxTsuma;
    });
  }, [grid, rows]);

  const gridTemplateColumns = colWidths.map(w => `${w}fr`).join(' ');
  const gridTemplateRows = rowHeights.map(h => `${h}fr`).join(' ');

  return (
    <div
      className="bg-white p-1 rounded-lg shadow-inner border border-slate-200 relative"
      style={{
        display: 'grid',
        gridTemplateColumns,
        gridTemplateRows,
        width: `${GRID_PIXEL_SIZE}px`,
        height: `${GRID_PIXEL_SIZE}px`,
      }}
    >
      {Array.from({ length: rows }).map((_, rowIndex) =>
        Array.from({ length: cols }).map((__, colIndex) => {
          
          let previewElement = null;

          const isCellOccupiedOnAnyFloor = grid.some(floor => floor[rowIndex][colIndex]);
          
          if (selectedUnit) {
              const targetPlacementFloor = grid.findIndex(floor => !floor[rowIndex][colIndex]);
              const isPlacementPossible = targetPlacementFloor !== -1;
              const isValid = isPlacementPossible && isPlacementValid(selectedUnit, grid, targetPlacementFloor, rowIndex, colIndex);

              if (isValid) {
                  const isStackingPreview = targetPlacementFloor > 0;
                  const opacityClass = isStackingPreview ? 'group-hover:opacity-50' : 'group-hover:opacity-30';
                  
                  const ghostStyle: React.CSSProperties = {
                      width: `${(selectedUnit.dimensions.keta / colWidths[colIndex]) * 100}%`,
                      height: `${(selectedUnit.dimensions.tsuma / rowHeights[rowIndex]) * 100}%`,
                      top: 0,
                      left: 0,
                  };

                  const nextFloorIcon = (floor: number) => {
                      if (floor === 1) return <line x1="0" y1="10" x2="10" y2="0" stroke="white" strokeWidth="0.8" strokeOpacity="0.9" />;
                      if (floor === 2) return (<><line x1="0" y1="10" x2="10" y2="0" stroke="white" strokeWidth="0.8" strokeOpacity="0.9" /><line x1="0" y1="0" x2="10" y2="10" stroke="white" strokeWidth="0.8" strokeOpacity="0.9" /></>);
                      return null;
                  };
    
                  previewElement = (
                      <div 
                        style={ghostStyle}
                        className={`absolute ${selectedUnit.color} opacity-0 ${opacityClass} rounded-sm flex items-center justify-center transition-opacity duration-150 pointer-events-none`}
                      >
                          {isStackingPreview && (
                              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 10 10" preserveAspectRatio="none">
                                  {nextFloorIcon(targetPlacementFloor)}
                              </svg>
                          )}
                      </div>
                  );

              } else if (!isCellOccupiedOnAnyFloor) {
                  previewElement = (
                      <div className="absolute inset-0 bg-red-500/40 rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                          <ProhibitedIcon className="h-8 w-8 text-white/80" />
                      </div>
                  );
              }
          }
    
          const getCursorClass = () => {
              if (selectedUnit) {
                  const isPlacementPossible = grid.findIndex(floor => !floor[rowIndex][colIndex]) !== -1;
                  const isValid = isPlacementPossible && isPlacementValid(selectedUnit, grid, grid.findIndex(floor => !floor[rowIndex][colIndex]), rowIndex, colIndex);
                  return isValid ? 'cursor-copy' : 'cursor-not-allowed';
              }
              if (isCellOccupiedOnAnyFloor) return 'cursor-pointer';
              return 'cursor-default';
          };
          const effectiveCursorClass = getCursorClass();

          const handleCellInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
            e.stopPropagation();
            const cellKey = `${rowIndex}-${colIndex}`;

            if (clickTimerRef.current[cellKey]) {
                clearTimeout(clickTimerRef.current[cellKey]);
                delete clickTimerRef.current[cellKey];
                if (isCellOccupiedOnAnyFloor) {
                    onCellDoubleClick(rowIndex, colIndex);
                }
            } else {
                const target = e.currentTarget;
                const hAlign = e.nativeEvent.offsetX < target.offsetWidth / 2 ? 'left' : 'right';
                const vAlign = e.nativeEvent.offsetY < target.offsetHeight / 2 ? 'top' : 'bottom';

                clickTimerRef.current[cellKey] = window.setTimeout(() => {
                    if (selectedUnit) {
                        const targetPlacementFloor = grid.findIndex(floor => !floor[rowIndex][colIndex]);
                        if (targetPlacementFloor !== -1 && isPlacementValid(selectedUnit, grid, targetPlacementFloor, rowIndex, colIndex)) {
                            onCellClick(rowIndex, colIndex, { hAlign, vAlign });
                        }
                    }
                    delete clickTimerRef.current[cellKey];
                }, DOUBLE_CLICK_DELAY);
            }
          };

          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`group relative border border-slate-200/70 text-center transition-all duration-150 ${effectiveCursorClass}`}
              onClick={handleCellInteraction}
            >
              {previewElement}
              {grid.map((floorGrid, floorIndex) => {
                const cell = floorGrid[rowIndex][colIndex];
                if (!cell) return null;
                
                return (
                    <div
                        key={`${floorIndex}-${rowIndex}-${colIndex}`}
                        className={`absolute flex flex-col items-center justify-center rounded-sm text-white p-1 shadow-md transition-all duration-150 ${cell.color} ${cell.vAlign === 'bottom' ? 'bottom-0' : 'top-0'} ${cell.hAlign === 'right' ? 'right-0' : 'left-0'} opacity-100`}
                        style={{
                            width: `${(cell.dimensions.keta / colWidths[colIndex]) * 100}%`,
                            height: `${(cell.dimensions.tsuma / rowHeights[rowIndex]) * 100}%`,
                            pointerEvents: 'none',
                        }}
                        >
                        {floorIndex === 1 && ( // 2F
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 10 10" preserveAspectRatio="none">
                                <line x1="0" y1="10" x2="10" y2="0" stroke="white" strokeWidth="0.5" strokeOpacity="0.7" />
                            </svg>
                        )}
                        {floorIndex === 2 && ( // 3F
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 10 10" preserveAspectRatio="none">
                                <line x1="0" y1="10" x2="10" y2="0" stroke="white" strokeWidth="0.5" strokeOpacity="0.7" />
                                <line x1="0" y1="0" x2="10" y2="10" stroke="white" strokeWidth="0.5" strokeOpacity="0.7" />
                            </svg>
                        )}
                        <span className="text-xs font-bold leading-tight select-none relative">{cell.name}</span>
                        <span className="text-[10px] opacity-80 leading-tight select-none relative">{cell.area?.toFixed(2) || '0.00'}</span>
                    </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
});
