
import type { Unit, DeductionOption, DeductionMap } from './types';

export const PAGE_DIMENSIONS = {
  a4: {
    landscape: { width: 297, height: 210 },
    portrait: { width: 210, height: 297 },
  },
  a3: {
    landscape: { width: 420, height: 297 },
    portrait: { width: 297, height: 420 },
  },
};

// Grid and App Constants
export const GRID_ROWS = 20;
export const GRID_COLS = 20;
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 12;
export const MAX_FLOORS = 3;

export const UNIT_DEFINITIONS: Unit[] = [
  // Main Units
  { name: '18フル', area: 4.524, type: 'main', color: 'bg-blue-300', hexColor: '#93c5fd', dimensions: { keta: 18, tsuma: 22.5 } },
  { name: '27フル', area: 6.652, type: 'main', color: 'bg-blue-400', hexColor: '#60a5fa', dimensions: { keta: 27, tsuma: 22.5 } },
  { name: '27サブ', area: 3.486, type: 'main', color: 'bg-sky-300', hexColor: '#7dd3fc', dimensions: { keta: 27, tsuma: 11.25 } },
  { name: '36フル', area: 8.779, type: 'main', color: 'bg-green-400', hexColor: '#4ade80', dimensions: { keta: 36, tsuma: 22.5 } },
  { name: '36サブ', area: 4.601, type: 'main', color: 'bg-emerald-300', hexColor: '#6ee7b7', dimensions: { keta: 36, tsuma: 11.25 } },
  { name: '45フル', area: 10.907, type: 'main', color: 'bg-indigo-400', hexColor: '#818cf8', dimensions: { keta: 45, tsuma: 22.5 } },
  { name: '45サブ', area: 5.716, type: 'main', color: 'bg-violet-300', hexColor: '#c4b5fd', dimensions: { keta: 45, tsuma: 11.25 } },
  { name: '54フル', area: 13.035, type: 'main', color: 'bg-purple-400', hexColor: '#a78bfa', dimensions: { keta: 54, tsuma: 22.5 } },
  { name: '54サブ', area: 6.831, type: 'main', color: 'bg-fuchsia-300', hexColor: '#f0abfc', dimensions: { keta: 54, tsuma: 11.25 } },
  // Tsuma Alpha Units (〇〇妻α -> 〇〇 is keta/East-West)
  { name: '450妻α', area: 1.596, type: 'alpha', color: 'bg-yellow-300', hexColor: '#fde047', dimensions: { keta: 4.5, tsuma: 22.5 } },
  { name: '900妻α', area: 2.660, type: 'alpha', color: 'bg-amber-300', hexColor: '#fcd34d', dimensions: { keta: 9, tsuma: 22.5 } },
  { name: '1800妻α', area: 4.787, type: 'alpha', color: 'bg-orange-300', hexColor: '#fdba74', dimensions: { keta: 18, tsuma: 22.5 } },
  // Keta Alpha Units (〇〇桁α△△ -> 〇〇 is tsuma/North-South, △△ is keta/East-West)
  { name: '900桁α18', area: 2.153, type: 'alpha', color: 'bg-red-300', hexColor: '#fca5a5', dimensions: { keta: 18, tsuma: 9 } },
  { name: '900桁α27', area: 3.166, type: 'alpha', color: 'bg-red-300', hexColor: '#fca5a5', dimensions: { keta: 27, tsuma: 9 } },
  { name: '900桁α36', area: 4.178, type: 'alpha', color: 'bg-red-300', hexColor: '#fca5a5', dimensions: { keta: 36, tsuma: 9 } },
  { name: '900桁α45', area: 5.191, type: 'alpha', color: 'bg-red-300', hexColor: '#fca5a5', dimensions: { keta: 45, tsuma: 9 } },
  { name: '900桁α54', area: 6.203, type: 'alpha', color: 'bg-red-300', hexColor: '#fca5a5', dimensions: { keta: 54, tsuma: 9 } },
  { name: '1800桁α18', area: 3.876, type: 'alpha', color: 'bg-rose-300', hexColor: '#fda4af', dimensions: { keta: 18, tsuma: 18 } },
  { name: '1800桁α23', area: 4.787, type: 'alpha', color: 'bg-rose-300', hexColor: '#fda4af', dimensions: { keta: 23, tsuma: 18 } },
];

export const KETAMEN_CONNECTIONS = {
  18: { width: 0.212, area: 0.212 }, // Assuming area equals width for simplicity
  27: { width: 0.312, area: 0.312 },
  36: { width: 0.412, area: 0.412 },
  45: { width: 0.512, area: 0.512 },
  54: { width: 0.612, area: 0.612 },
};

export const TSUMAMEN_CONNECTIONS = {
  'フル': 0.262,
  'サブ': 0.137,
};

export const TANOJI_AREA = 0.012;

export const TSUMA_ALPHA_CONTINUOUS_CONNECTIONS = {
  '450': 0.075,
  '900': 0.125,
  '1800': 0.225,
};

export const KETA_ALPHA_CONTINUOUS_CONNECTIONS = {
  '900': 0.125,
  '1800': 0.225,
};

export const HIKIKOMI_GENKAN_DEDUCTIONS: DeductionMap = {
  '900': {
    '桁入': {
      '1350': { 'フル': -1.218, 'サブ': -1.827 },
      '1800': { 'フル': -1.623, 'サブ': -2.435 },
      '2250': { 'フル': -2.028, 'サブ': -3.042 },
      '2700': { 'フル': -2.433, 'サブ': -3.650 },
    },
    '妻入': {
      '1800': -1.623,
      '2250': -2.028,
    }
  },
  '300': {
    '桁入': {
      '1800': -0.667,
      '2250': -0.833,
      '2700': -1.000,
    },
    '妻入': {
      '1800': -0.667
    }
  }
};

const options: DeductionOption[] = [];
for (const size of Object.keys(HIKIKOMI_GENKAN_DEDUCTIONS)) {
  const types = HIKIKOMI_GENKAN_DEDUCTIONS[size];
  for (const entryType of Object.keys(types)) {
    const dims = types[entryType];
    for (const dimension of Object.keys(dims)) {
      const entry = dims[dimension];
      if (typeof entry === 'object' && entry !== null) {
        for (const unitType of Object.keys(entry)) {
          options.push({
            type: 'genkan',
            label: `${size} / ${entryType} / ${dimension} / ${unitType}`,
            value: entry[unitType],
            conditions: { size, entryType, dimension, unitType },
          });
        }
      } else {
        options.push({
          type: 'genkan',
          label: `${size} / ${entryType} / ${dimension}`,
          value: entry as number,
          conditions: { size, entryType, dimension },
        });
      }
    }
  }
}
export const DEDUCTION_OPTIONS: DeductionOption[] = options;

const createStairOption = (label: string, value: number): DeductionOption => ({
    type: 'stairs',
    label,
    value,
    conditions: { description: label },
});

export const STAIR_DEDUCTION_OPTIONS: DeductionOption[] = [
    // 桁平行27
    createStairOption('桁平行27 吹抜 小C (27U 端上り)', -1.001),
    createStairOption('桁平行27 吹抜 小C (27U 中上り)', -0.972),
    createStairOption('桁平行27 吹抜 小C (36~54U 端上り)', -0.997),
    createStairOption('桁平行27 吹抜 小C (36~54U 中上り)', -0.997),
    createStairOption('桁平行27 吹抜 小S (27U 端上り)', -0.841),
    createStairOption('桁平行27 吹抜 小S (27U 中上り)', -0.815),
    createStairOption('桁平行27 吹抜 小S (36~54U 端上り)', -0.840),
    createStairOption('桁平行27 吹抜 小S (36~54U 中上り)', -0.840),
    createStairOption('桁平行27 吹抜 大 (27U 端上り)', -3.534),
    createStairOption('桁平行27 吹抜 大 (27U 中上り)', -3.454),
    createStairOption('桁平行27 吹抜 大 (36~54U 端上り)', -3.479),
    createStairOption('桁平行27 吹抜 大 (36~54U 中上り)', -3.479),
    createStairOption('桁平行27 吹抜大09ずらし (36U)', -5.740),
    createStairOption('桁平行27 吹抜大09ずらし (45･54U)', -5.660),

    // 桁平行36
    createStairOption('桁平行36 吹抜 小C (36U 端上り)', -0.698),
    createStairOption('桁平行36 吹抜 小C (36U 中上り)', -0.683),
    createStairOption('桁平行36 吹抜 小C (45･54U 端上り)', -0.694),
    createStairOption('桁平行36 吹抜 小C (45･54U 中上り)', -0.694),
    createStairOption('桁平行36 吹抜 小S (36U 端上り)', -0.485),
    createStairOption('桁平行36 吹抜 小S (36U 中上り)', -0.475),
    createStairOption('桁平行36 吹抜 小S (45･54U 端上り)', -0.486),
    createStairOption('桁平行36 吹抜 小S (45･54U 中上り)', -0.486),
    createStairOption('桁平行36 吹抜 大C (36U 端上り)', -4.875),
    createStairOption('桁平行36 吹抜 大C (36U 中上り)', -0.797),
    createStairOption('桁平行36 吹抜 大C (45･54U 端上り)', -4.808),
    createStairOption('桁平行36 吹抜 大C (45･54U 中上り)', -4.808),
    createStairOption('桁平行36 吹抜 大S (36U 端上り)', -5.087),
    createStairOption('桁平行36 吹抜 大S (36U 中上り)', -5.006),
    createStairOption('桁平行36 吹抜 大S (45･54U 端上り)', -5.017),
    createStairOption('桁平行36 吹抜 大S (45･54U 中上り)', -5.017),

    // L型
    createStairOption('L型 (18U)', -1.346),
    createStairOption('L型 (27~54U 端上り)', -1.266),
    createStairOption('L型 (27~54U 中上り)', -1.346),

    // U型 U16
    createStairOption('U型 U16 (36U 09ずらし)', -4.389),
    createStairOption('U型 U16 (27~54U)', -2.262),
    createStairOption('U型 U16 (45･54U)', -4.255),

    // 通り大
    createStairOption('通り大 吹抜付 (桁下口 端上り)', -0.915),
    createStairOption('通り大 吹抜付 (桁下口 中上り)', -0.861),
    createStairOption('通り大 吹抜付 (妻下口 端上り)', -0.861),
    createStairOption('通り大 吹抜付 (妻下口 中上り)', -0.810),

    // 吹抜隣接
    createStairOption('吹抜隣接 (36U)', -5.251),
    createStairOption('吹抜隣接 (27~54U 09ずらし)', -3.124),
    createStairOption('吹抜隣接 (45･54U)', -5.117),

    // C13
    createStairOption('C13', -0.275),

    // 桁直
    createStairOption('桁直 吹抜大 (36U)', -6.248),
    createStairOption('桁直 吹抜大 (45･54U)', -6.113),

    // 妻直 18吹
    createStairOption('妻直18吹 (27~54U)', -6.113),
    
    // C27
    createStairOption('C27 (27~54U 端上り)', -2.215),
    createStairOption('C27 (27~54U 中上り)', -2.159),
];
