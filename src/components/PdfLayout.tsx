

import React, { useEffect, useRef, useMemo, memo } from 'react';
import type { AppState, LineType, DrawingPoint, PartPlacementTransform } from '../types';
import { calculatePdfLayoutData, pointsToSvgPath, getPathAsPoints, getFloorTransform } from '../utils/layoutCalculator';
import { transformPoints } from '../utils/geometry';

interface MoveOperationProp {
  currentSvgPos: DrawingPoint;
  basePoint: DrawingPoint;
  transform: PartPlacementTransform;
}

interface PdfLayoutProps {
  state: AppState;
  onReady?: (svgElement: SVGSVGElement | null) => void;
  pageWidth: number;
  pageHeight: number;
  renderAsRootSvg?: boolean;
  moveOperation?: MoveOperationProp | null;
}

// Helper to get SVG dash array based on line type
const getStrokeDashArray = (lineType: LineType): string | undefined => {
  switch (lineType) {
    case 'dotted': return '0.5 1.0';
    case 'dashed': return '2.0 1.5';
    case 'dash-dot': return '3.0 1.0 0.5 1.0';
    case 'dash-dot-dot': return '3.0 1.0 0.5 1.0 0.5 1.0';
    default: return undefined;
  }
};

// Separate internal component to allow memoization check on specific props
const PdfLayoutContent: React.FC<PdfLayoutProps> = ({ state, onReady, pageWidth, pageHeight, renderAsRootSvg = true, moveOperation }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Memoize layout calculation. 
  // We only need specific parts of state to recalculate layout.
  const layoutData = useMemo(() => {
    return calculatePdfLayoutData(
        state.present, 
        state.firstFloorDeduction, 
        state.stairDeductions, 
        pageWidth, 
        pageHeight
    );
  }, [state.present, state.firstFloorDeduction, state.stairDeductions, pageWidth, pageHeight]);

  const svgContent = useMemo(() => {
    const { showBaseGrid, showModuleGrid, drawingLayers, selectedPathIds } = state;

    // Determine Unit Layer Visibility for Text Rendering (ID 1001)
    const unitLayer = drawingLayers.find(l => l.id === 1001);
    const isUnitTextVisible = unitLayer ? unitLayer.visibility !== 'hidden' : true;
    const unitTextOpacity = unitLayer && unitLayer.visibility === 'faint' ? 0.3 : 1.0;

    const { BORDER_MARGIN, positionedFloors, areaResult, gridDotOrigin, NOMINAL_DOT_SPACING } = layoutData;
    
    const floorAreaStrings = areaResult.floors.map(floor => `${floor.floorNumber}F:${floor.totalArea.toFixed(2)}㎡`).join(' ');
    const totalAreaString = `Total:${areaResult.totalArea.toFixed(2)}㎡`;
    const scaleString = 'Scale:1/100';
    const areaSummaryString = `${floorAreaStrings} ${totalAreaString} ${scaleString}`;

    // 1. Base Grid (225mm pitch)
    const baseGridDots: React.ReactElement[] = [];
    if (showBaseGrid) {
        for (let x = gridDotOrigin.x; x < pageWidth - BORDER_MARGIN; x += NOMINAL_DOT_SPACING) {
            for (let y = gridDotOrigin.y; y < pageHeight - BORDER_MARGIN; y += NOMINAL_DOT_SPACING) {
                if (x >= BORDER_MARGIN && y >= BORDER_MARGIN) {
                    baseGridDots.push(
                        <circle
                            key={`bg-${x.toFixed(2)}-${y.toFixed(2)}`}
                            cx={x.toFixed(2)}
                            cy={y.toFixed(2)}
                            r="0.15"
                            fill="#d1d5db"
                        />
                    );
                }
            }
        }
    }

    // 2. Module Grid Dots (900mm pitch) - Inside Units Only
    const moduleDots: React.ReactElement[] = [];
    if (showModuleGrid) {
        const moduleSpacing = 4 * NOMINAL_DOT_SPACING; // 900mm
        const dotSpacing = NOMINAL_DOT_SPACING; // 225mm

        positionedFloors.forEach(floor => {
            let floorTransform = getFloorTransform(state.drawingLayers, floor, BORDER_MARGIN);

            // If paths of this floor are being moved/rotated in real time via moveOperation
            const isFloorMoving = moveOperation && selectedPathIds && selectedPathIds.some(id => 
                id.startsWith(`unit-wall-${floor.floorNumber}-`) ||
                id.startsWith(`unit-pillar-${floor.floorNumber}-`) ||
                id.startsWith(`unit-label-${floor.floorNumber}`)
            );

            if (isFloorMoving && moveOperation) {
                const baseTransform = floorTransform;
                const { rotation } = moveOperation.transform;
                const center = moveOperation.basePoint;
                const dx = moveOperation.currentSvgPos.x - moveOperation.basePoint.x;
                const dy = moveOperation.currentSvgPos.y - moveOperation.basePoint.y;

                floorTransform = {
                    transformPoint: (p: DrawingPoint) => {
                        const pt = baseTransform.transformPoint(p);
                        const rel = { x: pt.x - center.x, y: pt.y - center.y };
                        const trans = transformPoints([rel], moveOperation.transform)[0];
                        return { x: trans.x + center.x + dx, y: trans.y + center.y + dy };
                    },
                    rotation: baseTransform.rotation + rotation,
                    offset: { x: baseTransform.offset.x + dx, y: baseTransform.offset.y + dy }
                };
            }

            floor.unitRects.forEach(unitRect => {
                const baseUnitOriginX = BORDER_MARGIN + floor.tx + unitRect.x;
                const baseUnitOriginY = BORDER_MARGIN + floor.ty + unitRect.y;
                const unitWidth = unitRect.width;
                const unitHeight = unitRect.height;

                for (let xOffset = 0; xOffset <= unitWidth + 0.01; xOffset += moduleSpacing) {
                    for (let yOffset = 0; yOffset <= unitHeight + 0.01; yOffset += dotSpacing) {
                        const originalPoint = {
                            x: baseUnitOriginX + xOffset,
                            y: baseUnitOriginY + yOffset
                        };
                        const pt = floorTransform.transformPoint(originalPoint);
                        moduleDots.push(
                            <circle
                                key={`md-${floor.floorNumber}-${unitRect.r}-${unitRect.c}-${Math.round(xOffset * 100)}-${Math.round(yOffset * 100)}`}
                                cx={pt.x.toFixed(2)}
                                cy={pt.y.toFixed(2)}
                                r="0.20"
                                fill="#b0b8c4"
                            />
                        );
                    }
                }
            });
        });
    }

    return (
      <>
        <defs>
          <style>
            {`
              @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
              svg { font-family: 'Noto Sans JP', sans-serif; }
              .light-text { font-size: 1.5mm; fill: #64748b; }
              .normal-text { font-size: 2.5mm; fill: #334155; }
              .header-text { font-size: 1.5mm; fill: #1e293b; font-weight: bold; }
              .title-text { font-size: 4mm; fill: #000; font-weight: bold; }
              .dim-text { font-size: 1.4mm; fill: #475569; }
            `}
          </style>
          <filter id="pencilTexturePdf" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="2" stitchTiles="stitch" result="texture"/>
            <feColorMatrix in="texture" type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 8 -3"
                result="mask"/>
            <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="2" result="displacementNoise"/>
            <feDisplacementMap in="SourceGraphic" in2="displacementNoise" scale="0.4" result="displacedPath" />
            <feComposite in="displacedPath" in2="mask" operator="in" />
          </filter>
        </defs>
        
        {showBaseGrid && (
            <g id="base-grid">
                {baseGridDots}
            </g>
        )}

        {showModuleGrid && (
            <g id="module-grid">
                {moduleDots}
            </g>
        )}

        {positionedFloors.length > 0 && isUnitTextVisible && (
          <g opacity={unitTextOpacity}>
            <text
              x={pageWidth - BORDER_MARGIN - 2}
              y={pageHeight - BORDER_MARGIN - 2}
              textAnchor="end"
              className="light-text"
            >
              {areaSummaryString}
            </text>
          </g>
        )}
        
        <g id="drawing-layers">
          {state.drawingLayers.map(layer => {
            if (layer.visibility === 'hidden') return null;
            const layerOpacity = layer.visibility === 'faint' ? 0.3 : 1.0;

            return (
              <g key={layer.id} id={`drawing-layer-render-${layer.id}`} opacity={layerOpacity}>
                {layer.paths.map((path) => {
                      if (path.text) {
                          const minX = Math.min(...path.points.map(p => p.x));
                          const minY = Math.min(...path.points.map(p => p.y));
                          const fs = path.fontSize || 2.2;
                          return (
                              <text
                                  key={path.id}
                                  x={minX}
                                  y={minY + fs * 0.85}
                                  fill={path.color || '#1e293b'}
                                  fontSize={fs}
                                  fontWeight="bold"
                                  textAnchor="start"
                                  style={{ userSelect: 'none' }}
                              >
                                  {path.text}
                              </text>
                          );
                      }

                      // Fill
                      let fillElement = null;
                      if (path.fill) {
                          const cleanPointsGroups = getPathAsPoints(path, false, false);
                          fillElement = (
                              <g key={`fill-${path.id}`}>
                                {cleanPointsGroups.map((points, index) => (
                                    <path
                                        key={`fill-${path.id}-${index}`}
                                        d={pointsToSvgPath(points, false)}
                                        fill={path.fill}
                                        stroke="none"
                                        fillOpacity={path.fillOpacity !== undefined ? path.fillOpacity : 1.0} 
                                    />
                                ))}
                              </g>
                          );
                      }

                      const styleProps: React.SVGProps<SVGGElement> = {
                        stroke: path.color,
                        strokeWidth: path.strokeWidth,
                        fill: "none",
                        strokeLinecap: path.strokeWidth === 2.25 ? 'square' : 'round',
                        strokeLinejoin: 'round',
                        strokeDasharray: getStrokeDashArray(path.lineType),
                        strokeOpacity: path.opacity !== undefined ? path.opacity : (path.tool === 'marker' ? 0.3 : (path.tool === 'pencil' ? 0.85 : 1.0)),
                      };
          
                      if (path.tool === 'pencil') {
                          styleProps.filter = 'url(#pencilTexturePdf)';
                          // Remove hardcoded opacity override for pencil, now handled in default above or by path.opacity
                      }
                      
                      const pointGroups = getPathAsPoints(path, state.isHandwritingMode, true);

                      const strokeElement = (
                        <g key={`stroke-${path.id}`} {...styleProps}>
                          {pointGroups.map((points, index) => {
                            const groupStyleProps: React.SVGProps<SVGPathElement> = {};
                            if (path.lineType === 'child-bearing') {
                              groupStyleProps.strokeWidth = path.strokeWidth * (index === 0 ? 0.75 : 0.25);
                            }
                            const d = pointsToSvgPath(points, false);
                            return <path key={`${path.id}-${index}`} d={d} {...groupStyleProps} />;
                          })}
                        </g>
                      );

                      return (
                          <React.Fragment key={path.id}>
                              {fillElement}
                              {strokeElement}
                          </React.Fragment>
                      );
                  })}
              </g>
            );
          })}
        </g>
      </>
    );
  }, [state, pageWidth, pageHeight, layoutData, moveOperation]);

  useEffect(() => {
    if (onReady && svgRef.current) {
      const svg = svgRef.current;
      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      onReady(clonedSvg);
    }
  }, [onReady, svgContent]);
  
  if (!renderAsRootSvg) {
    return svgContent;
  }

  return (
    <svg ref={svgRef} width={`${pageWidth}mm`} height={`${pageHeight}mm`} viewBox={`0 0 ${pageWidth} ${pageHeight}`} xmlns="http://www.w3.org/2000/svg">
      {svgContent}
    </svg>
  );
};

// Memoize the component. 
// IMPORTANT: We custom check props because 'state' is a large object. 
// We want to re-render ONLY if relevant parts of state change (drawingLayers, grid, etc.),
// but NOT if transient state like 'cursorPos' changes (which isn't passed here anyway, but good practice).
export const PdfLayout = memo(PdfLayoutContent, (prev, next) => {
    return (
        prev.pageWidth === next.pageWidth &&
        prev.pageHeight === next.pageHeight &&
        prev.renderAsRootSvg === next.renderAsRootSvg &&
        prev.moveOperation === next.moveOperation &&
        // Check relevant state slices
        prev.state.present === next.state.present &&
        prev.state.drawingLayers === next.state.drawingLayers &&
        prev.state.selectedPathIds === next.state.selectedPathIds &&
        prev.state.firstFloorDeduction === next.state.firstFloorDeduction &&
        prev.state.stairDeductions === next.state.stairDeductions &&
        prev.state.showBaseGrid === next.state.showBaseGrid &&
        prev.state.showModuleGrid === next.state.showModuleGrid &&
        prev.state.isHandwritingMode === next.state.isHandwritingMode
    );
});