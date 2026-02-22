import React, { useCallback, useRef, useState, useEffect, useMemo, useId } from 'react';
import { cn } from '@/lib/utils';

interface UseResizeOptions {
  direction: 'horizontal' | 'vertical';
  minSize: number;
  maxSize: number;
  initialSize: number;
  reverse?: boolean; // For left/top edge resizing
  onResize?: (size: number) => void;
  liveResizeCallback?: boolean;
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
  liveResizeCallback = true,
}: UseResizeOptions): UseResizeReturn {
  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);

  // Use refs to avoid re-renders during drag
  const isResizingRef = useRef(false);
  const resizeRef = useRef<{ startPos: number; startSize: number; lastResizeTime?: number } | null>(null);
  const sizeRef = useRef(initialSize);
  const frameRef = useRef<number | null>(null);
  const pendingSizeRef = useRef<number>(initialSize);

  // Store callbacks in refs to avoid dependency issues
  // This prevents the mouse move handler from being recreated on every render
  const onResizeRef = useRef(onResize);
  const liveResizeCallbackRef = useRef(liveResizeCallback);
  const directionRef = useRef(direction);
  const reverseRef = useRef(reverse);
  const minSizeRef = useRef(minSize);
  const maxSizeRef = useRef(maxSize);

  // Update refs when props change
  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    liveResizeCallbackRef.current = liveResizeCallback;
  }, [liveResizeCallback]);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    reverseRef.current = reverse;
  }, [reverse]);

  useEffect(() => {
    minSizeRef.current = minSize;
  }, [minSize]);

  useEffect(() => {
    maxSizeRef.current = maxSize;
  }, [maxSize]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setIsResizing(true);
    const startPos = directionRef.current === 'horizontal' ? e.clientX : e.clientY;
    resizeRef.current = { startPos, startSize: sizeRef.current };
  }, []);

  // flushResize is stable - uses refs internally
  const flushResize = useCallback(() => {
    frameRef.current = null;
    const nextSize = pendingSizeRef.current;
    sizeRef.current = nextSize;
    setSize(nextSize);

    const callback = onResizeRef.current;
    if (callback && liveResizeCallbackRef.current) {
      const now = performance.now();
      if (!resizeRef.current?.lastResizeTime || now - resizeRef.current.lastResizeTime > 16) {
        if (resizeRef.current) {
          resizeRef.current.lastResizeTime = now;
        }
        callback(nextSize);
      }
    }
  }, []);

  const scheduleResize = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(flushResize);
  }, [flushResize]);

  // Stable mouse move handler - uses refs only, no dependencies
  // This is the key optimization: the callback never changes
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !resizeRef.current) return;

    const currentPos = directionRef.current === 'horizontal' ? e.clientX : e.clientY;
    const delta = currentPos - resizeRef.current.startPos;

    // Default (right/bottom edge): drag right = wider, drag down = taller
    // Reverse (left/top edge): drag left = wider, drag down = taller
    const deltaMultiplier = reverseRef.current ? -1 : 1;
    const newSize = Math.max(
      minSizeRef.current,
      Math.min(maxSizeRef.current, resizeRef.current.startSize + delta * deltaMultiplier)
    );

    pendingSizeRef.current = newSize;
    scheduleResize();
  }, [scheduleResize]);

  const stopResizing = useCallback(() => {
    isResizingRef.current = false;
    setIsResizing(false);
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    sizeRef.current = pendingSizeRef.current;
    setSize(sizeRef.current);
    resizeRef.current = null;
    // Final sync
    onResizeRef.current?.(sizeRef.current);
  }, []);

  useEffect(() => {
    if (isResizing) {
      // Use passive: true for better scroll performance
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', stopResizing, { passive: true });
      document.body.style.cursor = directionRef.current === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      // Disable pointer events on document to improve drag responsiveness
      document.body.style.pointerEvents = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isResizing, handleMouseMove, stopResizing]);

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
        'flex items-center justify-center z-50 rounded-sm',
        isHorizontal
          ? 'w-2 h-full cursor-col-resize bg-[var(--bg-secondary)]/50 hover:bg-[var(--accent)]/30'
          : 'h-2 cursor-row-resize flex items-center justify-center bg-[var(--bg-secondary)]/50 hover:bg-[var(--accent)]/30 shrink-0 -mt-0.5 z-10',
        isResizing && 'bg-[var(--accent)]/40',
        className
      )}
      style={{
        // Optimize rendering performance during resize
        ...(isResizing ? { willChange: 'background-color' } : {}),
        // Disable pointer events smoothing for more responsive drag
        touchAction: 'none',
      }}
    >
      {/* Visible line indicator */}
      <div
        className={cn(
          isHorizontal ? 'w-0.5 h-8 bg-[var(--border)]' : 'w-10 h-0.5 bg-[var(--border)]',
          isResizing ? 'bg-[var(--accent)]' : 'group-hover:bg-[var(--accent)]/70',
          indicatorClassName
        )}
        style={{
          // Remove transition during resize for instant feedback
          transition: isResizing ? 'none' : undefined,
        }}
      />
    </div>
  );
});
