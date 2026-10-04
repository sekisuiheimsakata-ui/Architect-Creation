

import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import type { PanZoom } from '../types';
import { Grid, GRID_PIXEL_SIZE } from './Grid';
import { GRID_ROWS, GRID_COLS, MIN_SCALE, MAX_SCALE } from '../constants';
import { useAppContext } from '../state/AppContext';
import { UnitInfoPanel } from './UnitInfoPanel';
import { DraftingCanvas } from './DraftingCanvas';
import { calculateViewBoundingBox } from '../utils/layoutCalculator';
import { PAGE_DIMENSIONS } from '../constants';

interface WorkspaceProps {
    onOpenControlPanel: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ onOpenControlPanel }) => {
  const { state, dispatch } = useAppContext();
  const { present, selectedUnit, panZoom, mode, drawingLayers, firstFloorDeduction, stairDeductions, draftingView, draftingSettings, controlPanelRect, isControlPanelOpen } = state;

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Ref to hold state for layout calculation without triggering effects
  const layoutStateRef = useRef({ present, drawingLayers, firstFloorDeduction, stairDeductions });
  useEffect(() => {
    layoutStateRef.current = { present, drawingLayers, firstFloorDeduction, stairDeductions };
  }, [present, drawingLayers, firstFloorDeduction, stairDeductions]);

  // ResizeObserver to detect container size changes (initial load, window resize)
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const PAN_SPEED = 1.0;
    const ZOOM_SENSITIVITY = 3.0;

    if (e.ctrlKey || e.metaKey) {
        // Ctrl (Cmd) + Wheel -> Zoom
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        dispatch({ type: 'ZOOM', payload: { delta: e.deltaY * ZOOM_SENSITIVITY, mouseX, mouseY } });
    } else {
        // Wheel -> Scroll (Pan)
        let dx = e.deltaX;
        let dy = e.deltaY;

        // Shift + Wheel -> Horizontal Scroll
        // If vertical scroll signal comes with Shift, map it to horizontal
        if (e.shiftKey && dx === 0) {
            dx = dy;
            dy = 0;
        }

        // Invert delta to move the "camera"
        dispatch({ type: 'PAN', payload: { dx: -dx * PAN_SPEED, dy: -dy * PAN_SPEED } });
    }
  }, [dispatch]);
  
  useEffect(() => {
      const currentContainer = containerRef.current;
      // Add wheel event listener non-passively to allow preventDefault
      currentContainer?.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
          currentContainer?.removeEventListener('wheel', handleWheel);
      };
  }, [handleWheel]);

  const handleCellClick = useCallback((row: number, col: number, options: { hAlign: 'left' | 'right'; vAlign: 'top' | 'bottom' }) => {
    dispatch({ type: 'PLACE_UNIT', payload: { row, col, ...options } });
  }, [dispatch]);

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    dispatch({ type: 'DELETE_UNIT', payload: { row, col } });
  }, [dispatch]);

  // Use refs to track changes to decide when to reset view
  const prevViewFitTriggerRef = useRef(state.viewFitTrigger);
  const prevModeRef = useRef(state.mode);

  // This effect calculates fitScale and automatically fits the view when appropriate.
  useEffect(() => {
    if (!containerRef.current || containerSize.width === 0 || containerSize.height === 0) return;

    const { width: containerWidth, height: containerHeight } = containerSize;

    // Calculate Insets based on Control Panel Position
    let insetLeft = 0;
    let insetRight = 0;
    
    if (isControlPanelOpen && controlPanelRect) {
        // Simple heuristic: if the panel center is on the left half of the screen, it's a left panel.
        const panelMid = controlPanelRect.x + controlPanelRect.width / 2;
        const screenMid = containerWidth / 2;

        if (panelMid < screenMid) {
            // Panel is on the left side
            insetLeft = Math.max(0, controlPanelRect.x + controlPanelRect.width);
        } else {
            // Panel is on the right side
            insetRight = Math.max(0, containerWidth - controlPanelRect.x);
        }
    }

    // Define available viewport rectangle relative to container
    const availableX = insetLeft;
    const availableY = 0;
    const availableW = Math.max(100, containerWidth - insetLeft - insetRight); // Ensure min width
    const availableH = containerHeight;

    // Center of the available viewport relative to the container
    const viewportCenterX = availableX + availableW / 2;
    const viewportCenterY = availableY + availableH / 2;

    let calculatedFitScale = 1;
    let calculatedTranslateX = 0;
    let calculatedTranslateY = 0;

    if (mode === 'drafting') {
        const pageDimensions = PAGE_DIMENSIONS[draftingSettings.size][draftingSettings.orientation];
        const bbox = calculateViewBoundingBox(layoutStateRef.current, draftingView, pageDimensions.width, pageDimensions.height);

        if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
          return;
        }

        const PADDING = 0.95; // 5% breathing room
        
        const scaleX = availableW / bbox.width;
        const scaleY = availableH / bbox.height;
        calculatedFitScale = Math.min(scaleX, scaleY) * PADDING;
        calculatedFitScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, calculatedFitScale));

        const bboxCenterX = bbox.x + bbox.width / 2;
        const bboxCenterY = bbox.y + bbox.height / 2;

        calculatedTranslateX = viewportCenterX - (bboxCenterX * calculatedFitScale);
        calculatedTranslateY = viewportCenterY - (bboxCenterY * calculatedFitScale);
        
    } else if (mode === 'placement') {
        const GRID_SIZE = GRID_PIXEL_SIZE;
        const PADDING = 0.9;
        
        const scaleX = availableW / GRID_SIZE;
        const scaleY = availableH / GRID_SIZE;
        calculatedFitScale = Math.min(scaleX, scaleY) * PADDING;
        calculatedFitScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, calculatedFitScale));

        const gridCenterX = GRID_SIZE / 2;
        const gridCenterY = GRID_SIZE / 2;

        calculatedTranslateX = viewportCenterX - (gridCenterX * calculatedFitScale);
        calculatedTranslateY = viewportCenterY - (gridCenterY * calculatedFitScale);
    }

    // 1. Update Fit Scale in State (if significantly changed)
    if (Math.abs(calculatedFitScale - state.fitScale) > 0.0001) {
        dispatch({ type: 'SET_FIT_SCALE', payload: calculatedFitScale });
    }

    // 2. Decide whether to Reset View (apply fit scale to actual panZoom)
    // Reset if:
    // - Explicit trigger changed (Reset View button, Load)
    // - Mode changed
    // - Container Size changed (Resize) - Default behavior is to re-fit on resize to keep it responsive
    const shouldResetView = 
        prevViewFitTriggerRef.current !== state.viewFitTrigger || 
        prevModeRef.current !== state.mode || 
        true; // Keep resizing behavior responsive (snap to fit on resize)

    if (shouldResetView) {
        dispatch({
            type: 'SET_PAN_ZOOM',
            payload: { scale: calculatedFitScale, translate: { x: calculatedTranslateX, y: calculatedTranslateY } },
        });
    }

    prevViewFitTriggerRef.current = state.viewFitTrigger;
    prevModeRef.current = state.mode;

  }, [
    mode, 
    draftingView, 
    state.viewFitTrigger, 
    draftingSettings.size, 
    draftingSettings.orientation, 
    dispatch, 
    containerSize.width,
    containerSize.height,
    controlPanelRect?.x, 
    controlPanelRect?.y, 
    controlPanelRect?.width, 
    controlPanelRect?.height, 
    isControlPanelOpen,
    // We don't depend on state.fitScale here to avoid loop, we just use it to check if update needed
    // We use refs for prev values
  ]);


  const workspaceContent = useMemo(() => {
    if (mode === 'drafting') {
      return <DraftingCanvas />;
    }
    return (
      <Grid
        rows={GRID_ROWS}
        cols={GRID_COLS}
        grid={present}
        selectedUnit={selectedUnit}
        onCellClick={handleCellClick}
        onCellDoubleClick={handleCellDoubleClick}
      />
    );
  }, [mode, present, selectedUnit, handleCellClick, handleCellDoubleClick]);

  return (
    <main className="h-full w-full relative bg-slate-200 overflow-hidden">
        <div className="absolute top-4 left-4 z-10">
            {mode === 'placement' && (
                <UnitInfoPanel />
            )}
        </div>

        {/* This container handles scrolling, independent of the UI elements */}
        <div className="absolute inset-0 overflow-auto">
            <div
                id="pan-zoom-container"
                ref={containerRef}
                className="h-full w-full p-4 cursor-default overflow-hidden relative"
            >
                <div
                    ref={contentRef}
                    className="absolute top-0 left-0"
                    style={{
                        transform: `translate(${panZoom.translate.x}px, ${panZoom.translate.y}px) scale(${panZoom.scale})`,
                        transformOrigin: '0 0',
                        transition: 'transform 0.1s ease-out',
                    }}
                >
                    {workspaceContent}
                </div>
            </div>
        </div>
    </main>
  );
};