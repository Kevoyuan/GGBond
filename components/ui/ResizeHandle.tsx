import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface UseResizeOptions {
  direction: 'horizontal' | 'vertical';
  minSize: number;
  maxSize: number;
  initialSize: number;
  reverse?: boolean; // For left/top edge resizing
  onResize?: (size: number) => void;
}

interface UseResizeReturn {
  size: number;
  isResizing: boolean;
  resizeProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    className?: string;
  };
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    className?: string;
  };
}

export function useResize({
  direction,
  minSize,
  maxSize,
  initialSize,
  reverse = false,
  onResize,
}: UseResizeOptions): UseResizeReturn {
  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);

  // Use refs to avoid re-renders during drag
  const isResizingRef = useRef(false);
  const resizeRef = useRef<{ startPos: number; startSize: number; lastResizeTime?: number } | null>(null);
  const sizeRef = useRef(initialSize);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setIsResizing(true);
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    resizeRef.current = { startPos, startSize: sizeRef.current };
  }, [direction]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !resizeRef.current) return;

    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = currentPos - resizeRef.current.startPos;

    // Default (right/bottom edge): drag right = wider, drag down = taller
    // Reverse (left/top edge): drag left = wider, drag down = taller
    const deltaMultiplier = reverse ? -1 : 1;
    const newSize = Math.max(
      minSize,
      Math.min(maxSize, resizeRef.current.startSize + delta * deltaMultiplier)
    );

    sizeRef.current = newSize;
    setSize(newSize);

    // Throttle onResize callback to reduce parent re-renders
    if (onResize) {
      const now = performance.now();
      if (!resizeRef.current.lastResizeTime || now - resizeRef.current.lastResizeTime > 16) {
        resizeRef.current.lastResizeTime = now;
        onResize(newSize);
      }
    }
  }, [direction, reverse, minSize, maxSize, onResize]);

  const stopResizing = useCallback(() => {
    isResizingRef.current = false;
    setIsResizing(false);
    resizeRef.current = null;
    // Final sync
    onResize?.(sizeRef.current);
  }, [onResize]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      // Add will-change for performance
      document.body.style.willChange = 'width, height';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.willChange = '';
    };
  }, [isResizing, handleMouseMove, stopResizing, direction]);

  const cursorClass = useMemo(
    () => direction === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize',
    [direction]
  );
  const activeClass = isResizing ? 'bg-[var(--accent)]' : '';

  return {
    size,
    isResizing,
    resizeProps: {
      onMouseDown: startResizing,
      className: cursorClass,
    },
    handleProps: {
      onMouseDown: startResizing,
      className: cn(cursorClass, activeClass),
    },
  };
}

// Standalone resize handle component
interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  isResizing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
  indicatorClassName?: string;
}

export const ResizeHandle = React.memo(function ResizeHandle({
  direction,
  isResizing,
  onMouseDown,
  className,
  indicatorClassName,
}: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal';

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        'flex items-center justify-center transition-colors z-50',
        isHorizontal
          ? 'w-1.5 h-full cursor-col-resize bg-transparent hover:bg-[var(--accent)]/50'
          : 'h-[5px] cursor-row-resize flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors shrink-0 -mt-1 z-10',
        isResizing && 'bg-[var(--accent)]',
        className
      )}
    >
      {/* Visible line indicator */}
      <div
        className={cn(
          isHorizontal ? 'w-0.5 h-full bg-[var(--border-subtle)]' : 'w-8 h-0.5 bg-[var(--border-subtle)]',
          isResizing ? 'bg-[var(--accent)]' : 'group-hover:bg-[var(--accent)]/50',
          indicatorClassName
        )}
      />
    </div>
  );
});
