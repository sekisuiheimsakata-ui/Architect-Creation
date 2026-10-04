import React, { useMemo } from 'react';
import { useAppContext } from '../state/AppContext';

export const UnitInfoPanel: React.FC = () => {
  const { state } = useAppContext();

  const floorData = useMemo(() => {
    const data: { floorNumber: number; counts: { [key: string]: number } }[] = [];
    state.present.forEach((floorGrid, floorIndex) => {
      const unitCounts: { [key: string]: number } = {};
      let hasUnitsOnFloor = false;

      floorGrid.forEach(row => {
        row.forEach(unit => {
          if (unit) {
            hasUnitsOnFloor = true;
            unitCounts[unit.name] = (unitCounts[unit.name] || 0) + 1;
          }
        });
      });

      if (hasUnitsOnFloor) {
        data.push({
          floorNumber: floorIndex + 1,
          counts: unitCounts,
        });
      }
    });
    return data;
  }, [state.present]);

  if (floorData.length === 0) {
    return null;
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-3 text-slate-800 text-xs border border-slate-200/90 space-y-2 max-w-xs">
      {floorData.map(({ floorNumber, counts }) => (
        <div key={floorNumber} className="flex items-start space-x-2">
          <span className="font-bold text-slate-600 w-8 shrink-0 pt-0.5">{`${floorNumber}階:`}</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(counts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, count]) => (
                <span key={name} className="whitespace-nowrap bg-slate-100/70 px-1.5 py-0.5 rounded">
                  {name} &times; {count}
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};
