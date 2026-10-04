
import React, { useMemo } from 'react';
import type { Unit } from '../types';
import { UNIT_DEFINITIONS } from '../constants';

interface UnitSelectorProps {
  selectedUnit: Unit | null;
  onSelect: (unit: Unit | null) => void;
}

const UnitButton: React.FC<{
  unit: Unit;
  isSelected: boolean;
  onClick: () => void;
}> = ({ unit, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full p-2 rounded-md text-left transition-all duration-150 border-2 ${
      isSelected
        ? `ring-2 ring-offset-2 ring-blue-500 ${unit.color} text-white shadow-lg`
        : `bg-slate-100 hover:bg-slate-200 border-transparent`
    }`}
  >
    <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{unit.name}</span>
        <div className={`w-4 h-4 rounded-full ${unit.color} ${!isSelected ? 'ring-1 ring-slate-300' : ''}`}></div>
    </div>
    <div className={`text-xs ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
        {unit.area?.toFixed(2) || '0.00'} m²
    </div>
  </button>
);

const UnitGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-sm font-semibold text-slate-500 mb-2 px-1">{title}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {children}
        </div>
    </div>
);


export const UnitSelector: React.FC<UnitSelectorProps> = ({ selectedUnit, onSelect }) => {
  const unitsByType = useMemo(() => {
    return UNIT_DEFINITIONS.reduce((acc, unit) => {
      const key = unit.type === 'main' ? 'main' : 'alpha';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(unit);
      return acc;
    }, {} as { [key: string]: Unit[] });
  }, []);

  return (
    <div className="space-y-4">
      <UnitGroup title="メインユニット">
        {unitsByType.main?.map(unit => (
          <UnitButton
            key={unit.name}
            unit={unit}
            isSelected={selectedUnit?.name === unit.name}
            onClick={() => onSelect(unit)}
          />
        ))}
      </UnitGroup>
      <UnitGroup title="αユニット">
        {unitsByType.alpha?.map(unit => (
          <UnitButton
            key={unit.name}
            unit={unit}
            isSelected={selectedUnit?.name === unit.name}
            onClick={() => onSelect(unit)}
          />
        ))}
      </UnitGroup>
      {selectedUnit && (
        <div className="pt-2 border-t border-slate-200">
            <button 
                onClick={() => onSelect(null)}
                className="w-full text-center text-sm font-medium text-slate-600 hover:text-slate-900 py-2 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors"
            >
                選択を解除
            </button>
        </div>
      )}
    </div>
  );
};
