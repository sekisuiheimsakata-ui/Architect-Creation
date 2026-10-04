import React, { useState, useMemo } from 'react';
import type { FloorCalculation } from '../types';
import { DEDUCTION_OPTIONS, STAIR_DEDUCTION_OPTIONS } from '../constants';
import { useAppContext } from '../state/AppContext';
import { calculateArea } from '../utils/areaCalculator';
import { ChevronDownIcon } from './Icons';

const ResultRow: React.FC<{ label: string; value: string; isSubtle?: boolean; isNegative?: boolean }> = ({ label, value, isSubtle = false, isNegative = false }) => (
  <div className="grid grid-cols-2 items-baseline py-1.5 text-sm gap-x-2">
    <span className={isSubtle ? "text-slate-500" : "text-slate-600 font-medium"}>{label}</span>
    <span className={`tabular-nums text-right ${isSubtle ? "text-slate-600" : "text-slate-800 font-medium"} ${isNegative ? 'text-red-600' : ''}`}>{value}</span>
  </div>
);

const GrandTotalRow: React.FC<{ label: string; m2: number; totalMainUnits: number }> = ({ label, m2, totalMainUnits }) => {
    const tsubo = m2 * 0.3025;
    return (
        <div className="flex justify-between items-center px-3 pt-3 mt-3 border-t-2 border-slate-300">
            <div className="flex items-baseline flex-wrap gap-x-3">
                <span className="text-base font-semibold text-slate-800">{label}</span>
                <div>
                  <span className="tabular-nums text-xl font-bold text-blue-600">{m2.toFixed(2)}</span>
                  <span className="text-xs ml-1 text-slate-600 font-medium">m²</span>
                  <span className="text-base text-slate-500 font-normal ml-2">{`(${tsubo.toFixed(2)}坪)`}</span>
                </div>
            </div>
            <div className="flex items-center shrink-0">
                <span className="text-xl font-bold text-slate-900">{totalMainUnits}</span>
                <span className="text-sm ml-0.5 mr-2 text-slate-600 font-medium">U</span>
                <div className="w-5 h-5" />
            </div>
        </div>
    );
};

const FloorAccordion: React.FC<{
  floor: FloorCalculation;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ floor, isExpanded, onToggle }) => {
    const { state, dispatch } = useAppContext();
    const { firstFloorDeduction: deduction, stairDeductions } = state;
    const stairDeduction = stairDeductions[floor.floorNumber] || null;
    const tsubo = floor.totalArea * 0.3025;

    return (
        <div className="bg-white/60 rounded-lg shadow-sm overflow-hidden transition-all duration-300">
            <button
                onClick={onToggle}
                className="w-full flex justify-between items-center p-3 text-left transition-colors hover:bg-slate-50"
                aria-expanded={isExpanded}
                aria-controls={`floor-details-${floor.floorNumber}`}
            >
                <div className="flex items-baseline flex-wrap gap-x-3">
                    <span className="text-base font-semibold text-slate-800">{`${floor.floorNumber}階`}</span>
                    <div>
                      <span className="tabular-nums text-xl font-bold text-slate-900">{floor.totalArea.toFixed(2)}</span>
                      <span className="text-xs ml-1 text-slate-600 font-medium">m²</span>
                      <span className="text-base text-slate-500 font-normal ml-2">{`(${tsubo.toFixed(2)}坪)`}</span>
                    </div>
                </div>
                <div className="flex items-center shrink-0">
                    <span className="text-xl font-bold text-slate-900">{floor.mainUnitCount}</span>
                    <span className="text-sm ml-0.5 mr-2 text-slate-600 font-medium">U</span>
                    <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div id={`floor-details-${floor.floorNumber}`} className="px-3 pb-3 pt-2">
                        <div className="space-y-0 divide-y divide-slate-200/70 border-t border-slate-200/70">
                            <ResultRow label="ユニット基本面積" value={`${floor.baseUnitArea.toFixed(3)} m²`} isSubtle />
                            <ResultRow label="桁面接続部" value={`+ ${floor.ketamenArea.toFixed(3)} m²`} isSubtle />
                            <ResultRow label="妻面接続部" value={`+ ${floor.tsumamenArea.toFixed(3)} m²`} isSubtle />
                            <ResultRow label="田の字部" value={`+ ${floor.tanojiArea.toFixed(3)} m²`} isSubtle />
                            {floor.deductionArea && (
                              <ResultRow label={floor.deductionLabel || '減算'} value={`${floor.deductionArea.toFixed(3)} m²`} isSubtle isNegative/>
                            )}
                        </div>
                         {floor.floorNumber === 1 && (
                          <div className="mt-3 pt-3 border-t border-slate-200/70">
                             <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id="deduction-toggle"
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  checked={!!deduction}
                                  onChange={(e) => {
                                    dispatch({ 
                                      type: 'SET_DEDUCTION', 
                                      payload: e.target.checked ? DEDUCTION_OPTIONS[0] : null 
                                    });
                                  }}
                                />
                                <label htmlFor="deduction-toggle" className="ml-2 block text-sm font-medium text-slate-700 select-none">
                                  引き込み玄関 (減算オプション)
                                </label>
                              </div>
                              {deduction && (
                                <select
                                  aria-label="Deduction option"
                                  value={deduction.label}
                                  onChange={(e) => {
                                    const selectedOption = DEDUCTION_OPTIONS.find(opt => opt.label === e.target.value);
                                    if (selectedOption) {
                                      dispatch({ type: 'SET_DEDUCTION', payload: selectedOption });
                                    }
                                  }}
                                  className="mt-2 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                                >
                                  {DEDUCTION_OPTIONS.map(opt => (
                                    <option key={opt.label} value={opt.label}>
                                      {opt.label} ({opt.value.toFixed(3)} m²)
                                    </option>
                                  ))}
                                </select>
                              )}
                          </div>
                        )}
                        {floor.floorNumber > 1 && (
                           <div className="mt-3 pt-3 border-t border-slate-200/70">
                           <div className="flex items-center">
                              <input
                                type="checkbox"
                                id={`stair-deduction-toggle-${floor.floorNumber}`}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={!!stairDeduction}
                                onChange={(e) => {
                                  dispatch({ 
                                    type: 'SET_STAIR_DEDUCTION', 
                                    payload: { 
                                        floorNumber: floor.floorNumber,
                                        option: e.target.checked ? STAIR_DEDUCTION_OPTIONS[0] : null 
                                    }
                                  });
                                }}
                              />
                              <label htmlFor={`stair-deduction-toggle-${floor.floorNumber}`} className="ml-2 block text-sm font-medium text-slate-700 select-none">
                                階段吹抜 (減算オプション)
                              </label>
                            </div>
                            {stairDeduction && (
                              <select
                                aria-label={`Stair deduction option for floor ${floor.floorNumber}`}
                                value={stairDeduction?.label}
                                onChange={(e) => {
                                  const selectedOption = STAIR_DEDUCTION_OPTIONS.find(opt => opt.label === e.target.value);
                                  if (selectedOption) {
                                    dispatch({ type: 'SET_STAIR_DEDUCTION', payload: { floorNumber: floor.floorNumber, option: selectedOption } });
                                  }
                                }}
                                className="mt-2 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                              >
                                {STAIR_DEDUCTION_OPTIONS.map(opt => (
                                  <option key={opt.label} value={opt.label}>
                                    {opt.label} ({opt.value.toFixed(3)} m²)
                                  </option>
                                ))}
                              </select>
                            )}
                        </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AreaCalculator: React.FC = () => {
  const { state } = useAppContext();
  const { present, firstFloorDeduction, stairDeductions } = state;
  const result = useMemo(() => calculateArea(present, firstFloorDeduction, stairDeductions), [present, firstFloorDeduction, stairDeductions]);

  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(new Set());

  const toggleFloor = (floorNumber: number) => {
    const newSet = new Set(expandedFloors);
    if (newSet.has(floorNumber)) {
      newSet.delete(floorNumber);
    } else {
      newSet.add(floorNumber);
    }
    setExpandedFloors(newSet);
  };
  
  return (
    <div className="bg-slate-100 p-4 rounded-lg">
      {result.floors.length === 0 ? (
        <p className="text-slate-500 text-sm py-4 text-center">ユニットを配置すると、面積が計算されます。</p>
      ) : (
        <div className="space-y-2">
          {result.floors.map((floor) => (
            <FloorAccordion
              key={floor.floorNumber}
              floor={floor}
              isExpanded={expandedFloors.has(floor.floorNumber)}
              onToggle={() => toggleFloor(floor.floorNumber)}
            />
          ))}
        </div>
      )}
      
      {result.floors.length > 0 && (
        <GrandTotalRow label="合計" m2={result.totalArea} totalMainUnits={result.totalMainUnitCount}/>
      )}
    </div>
  );
};