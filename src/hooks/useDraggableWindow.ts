
import React, { useState, useRef, useEffect } from 'react';

export const useDraggableWindow = (
    initialPosition: { x: number, y: number },
    initialSize: { width: number, height: number },
    minWidth: number = 200,
    minHeight: number = 100
) => {
    const [position, setPosition] = useState(initialPosition);
    const [size, setSize] = useState(initialSize);
    const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number }>({ isDragging: false, startX: 0, startY: 0 });
    const resizeRef = useRef<{ isResizing: boolean; startX: number; startY: number; startWidth: number; startHeight: number; direction: 'xy' | 'y' }>({ 
        isResizing: false, startX: 0, startY: 0, startWidth: 0, startHeight: 0, direction: 'xy' 
    });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        e.preventDefault();
        dragRef.current = {
            isDragging: true,
            startX: e.clientX - position.x,
            startY: e.clientY - position.y
        };
    };

    const handleResizeMouseDown = (e: React.MouseEvent, direction: 'xy' | 'y') => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        resizeRef.current = {
            isResizing: true,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: size.width,
            startHeight: size.height,
            direction
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (dragRef.current.isDragging) {
                e.preventDefault();
                setPosition({
                    x: e.clientX - dragRef.current.startX,
                    y: e.clientY - dragRef.current.startY
                });
            }
            if (resizeRef.current.isResizing) {
                e.preventDefault();
                const dx = e.clientX - resizeRef.current.startX;
                const dy = e.clientY - resizeRef.current.startY;
                const { direction, startWidth, startHeight } = resizeRef.current;
                
                let newWidth = startWidth;
                let newHeight = startHeight;

                if (direction === 'xy') {
                    newWidth = Math.max(minWidth, startWidth + dx);
                    newHeight = Math.max(minHeight, startHeight + dy);
                } else if (direction === 'y') {
                    newHeight = Math.max(minHeight, startHeight + dy);
                }

                setSize({ width: newWidth, height: newHeight });
            }
        };

        const handleMouseUp = () => {
            dragRef.current.isDragging = false;
            resizeRef.current.isResizing = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [minWidth, minHeight]);

    return { position, size, handleMouseDown, handleResizeMouseDown, setPosition, setSize };
};