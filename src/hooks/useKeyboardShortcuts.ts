
import React, { useEffect } from 'react';
import { AppState, Action, DrawingTool, ShapeType } from '../types';

export const useKeyboardShortcuts = (
  state: AppState,
  dispatch: React.Dispatch<Action>
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If the event was already handled (e.g. by DraftingCanvas), ignore it here
      if (e.defaultPrevented) return;

      const target = e.target as HTMLElement;
      // 入力フォーム等でのキーイベントは無視
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModifier = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      // Undo / Redo
      if (isModifier && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (state.mode === 'placement') dispatch({ type: 'REDO' });
          else dispatch({ type: 'REDO_DRAWING' });
        } else {
          if (state.mode === 'placement') dispatch({ type: 'UNDO' });
          else dispatch({ type: 'UNDO_DRAWING' });
        }
        return;
      }
      
      // Redo (Ctrl+Y)
      if (isModifier && key === 'y') {
        e.preventDefault();
        if (state.mode === 'placement') dispatch({ type: 'REDO' });
        else dispatch({ type: 'REDO_DRAWING' });
        return;
      }

      // Clipboard Operations (Global in Drafting Mode, or mostly global)
      if (state.mode === 'drafting') {
          if (isModifier && key === 'c') {
              e.preventDefault();
              dispatch({ type: 'COPY_SELECTION' });
              return;
          }
          if (isModifier && key === 'x') {
              e.preventDefault();
              dispatch({ type: 'CUT_SELECTION' });
              return;
          }
          // Paste (v) is handled in DraftingCanvas to support paste-at-cursor
      }

      // Drafting Mode Specific Shortcuts
      if (state.mode === 'drafting' && !isModifier) {
        switch (key) {
          case 'q': // Tool Cycle
            e.preventDefault();
            const tools: DrawingTool[] = ['select', 'pen', 'text', 'eraser'];
            const currentToolIndex = tools.indexOf(state.activeTool);
            const nextTool = tools[(currentToolIndex + 1) % tools.length];
            dispatch({ type: 'SET_ACTIVE_TOOL', payload: nextTool });
            break;

          case 'a': // Shape Cycle (only if no selection or part placement active, so 'A' is free for angle sampling)
            if (state.selectedPathIds.length === 0 && !state.selectedPartForPlacement) {
              e.preventDefault();
              const shapes: ShapeType[] = ['line', 'polyline', 'rectangle', 'arc'];
              const currentShapeIndex = shapes.indexOf(state.activeShape);
              const nextShape = shapes[(currentShapeIndex + 1) % shapes.length];
              dispatch({ type: 'SET_ACTIVE_SHAPE', payload: nextShape });
            }
            break;

          case 'z': // Stroke Width Cycle
            e.preventDefault();
            const widths = [0.1, 0.7, 2.25];
            const currentWidth = state.penSettings.strokeWidth;
            // Find closest or next
            let nextWidth = widths[0];
            if (currentWidth < 0.15) nextWidth = 0.7;
            else if (currentWidth < 0.8) nextWidth = 2.25;
            dispatch({ type: 'SET_PEN_SETTINGS', payload: { strokeWidth: nextWidth } });
            break;

          case 't': // Direct Text Tool shortcut
            e.preventDefault();
            dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'text' });
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.mode, state.activeTool, state.activeShape, state.penSettings.strokeWidth, dispatch]);
};
