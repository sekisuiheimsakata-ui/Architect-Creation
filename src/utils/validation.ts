
import type { PlacedUnit, Unit } from '../types';
import { GRID_ROWS, GRID_COLS } from '../constants';

export const isPlacementValid = (
  unitToPlace: Unit,
  grid: (PlacedUnit | null)[][][],
  floor: number,
  row: number,
  col: number
): boolean => {
  const currentFloorGrid = grid[floor];

  // Rule: Cannot place on an already occupied cell on the same floor
  if (currentFloorGrid[row][col]) {
    return false;
  }

  // NEW Rule: Alpha units (桁α, 妻α) can only be placed on the 1st floor.
  if (unitToPlace.type === 'alpha' && floor > 0) {
    return false;
  }

  // Rule: Stacking rules for 2F and 3F
  if (floor > 0) {
    const unitBelow = grid[floor - 1][row][col];
    // Must be a unit on the floor below
    if (!unitBelow) return false;
    // Cannot stack on alpha units
    if (unitBelow.type === 'alpha') return false;
  }

  // --- Rules for placement on the current floor ---
  const topNeighbor = row > 0 ? currentFloorGrid[row - 1][col] : null;
  const bottomNeighbor = row < GRID_ROWS - 1 ? currentFloorGrid[row + 1][col] : null;
  const leftNeighbor = col > 0 ? currentFloorGrid[row][col - 1] : null;
  const rightNeighbor = col < GRID_COLS - 1 ? currentFloorGrid[row][col + 1] : null;

  // CORRECTED Rule: Vertical continuity for sub units (cannot be placed vertically adjacent)
  if (unitToPlace.name.includes('サブ')) {
    if (topNeighbor?.name.includes('サブ') || bottomNeighbor?.name.includes('サブ')) {
      return false;
    }
  }

  // Rule: '1800妻α' has special placement restrictions.
  if (unitToPlace.name === '1800妻α') {
    // 1. Cannot be placed horizontally adjacent to another '1800妻α'.
    if (leftNeighbor?.name === '1800妻α' || rightNeighbor?.name === '1800妻α') {
      return false;
    }
    // 2. Cannot be placed vertically adjacent to ANY unit.
    if (topNeighbor || bottomNeighbor) {
      return false;
    }
  }

  // 3. No other unit can be placed vertically adjacent to an existing '1800妻α'.
  if (topNeighbor?.name === '1800妻α' || bottomNeighbor?.name === '1800妻α') {
    return false;
  }


  // Rule: Alpha unit placement logic
  if (unitToPlace.name.includes('妻α')) {
    if (leftNeighbor?.name.includes('サブ') || rightNeighbor?.name.includes('サブ')) {
      return false;
    }
    const hasHorizontalTsumaAlpha = leftNeighbor?.name.includes('妻α') || rightNeighbor?.name.includes('妻α');
    if (hasHorizontalTsumaAlpha) return false;

    const hasHorizontalMain = leftNeighbor?.type === 'main' || rightNeighbor?.type === 'main';
    if (!hasHorizontalMain) return false;

    const hasVerticalTsumaAlpha = topNeighbor?.name.includes('妻α') || bottomNeighbor?.name.includes('妻α');
    if (hasVerticalTsumaAlpha) {
      const hasHorizontalFull = leftNeighbor?.name.includes('フル') || rightNeighbor?.name.includes('フル');
      if (!hasHorizontalFull) return false;
    }
  } else if (unitToPlace.name.includes('桁α')) {
    if (leftNeighbor || rightNeighbor) return false;
    
    const mainNeighbor = (topNeighbor?.type === 'main' && topNeighbor) || (bottomNeighbor?.type === 'main' && bottomNeighbor);
    if (!mainNeighbor) return false;

    if (unitToPlace.dimensions.keta > mainNeighbor.dimensions.keta) return false;
  }
  
  return true;
};
