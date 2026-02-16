import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface TooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
    className?: string; // Class for the tooltip content
    delay?: number; // Delay in ms before showing
    sideOffset?: number; // Distance from the trigger
}

export function Tooltip({
    children,
    content,
    side = 'right',
    className,
    delay = 0,
    sideOffset = 5,
    triggerClassName
}: TooltipProps & { triggerClassName?: string }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isPositioned, setIsPositioned] = useState(false);
    const [coords, setCoords] = useState<{ top: number, left: number }>({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout>(null);

    const updatePosition = () => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();

        let top = 0;
        let left = 0;

        switch (side) {
            case 'right':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.right + sideOffset;
                break;
            case 'left':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.left - tooltipRect.width - sideOffset;
                break;
            case 'top':
                top = triggerRect.top - tooltipRect.height - sideOffset;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = triggerRect.bottom + sideOffset;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
        }

        // Basic viewport bounds check
        const padding = 8;
        if (top < padding) top = padding;
        if (left < padding) left = padding;
        if (top + tooltipRect.height > window.innerHeight - padding) {
            top = window.innerHeight - tooltipRect.height - padding;
        }
        if (left + tooltipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tooltipRect.width - padding;
        }

        setCoords({ top, left });
        setIsPositioned(true);
    };

    useLayoutEffect(() => {
        if (isVisible) {
            updatePosition();
        } else {
            setIsPositioned(false);
        }
    }, [isVisible]);

    useEffect(() => {
        if (isVisible) {
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);

            // Re-check position in case content changed or layout shifted
            const id = requestAnimationFrame(updatePosition);
            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
                cancelAnimationFrame(id);
            };
        }
    }, [isVisible]);

    const handleMouseEnter = () => {
        if (delay === 0) {
            setIsVisible(true);
            return;
        }
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
        setIsPositioned(false);
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={cn("flex items-center justify-center", triggerClassName)}
            >
                {children}
            </div>

            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        zIndex: 9999,
                        visibility: isPositioned ? 'visible' : 'hidden',
                    }}
                    className={cn(
                        "px-2.5 py-1.5 rounded-md bg-zinc-800 text-zinc-50 border border-zinc-700 shadow-[0_4px_12px_rgba(0,0,0,0.5)]",
                        "dark:bg-zinc-800 dark:text-zinc-50 dark:border-zinc-700", // Force dark mode aesthetic for "Pro" feel usually
                        "text-[10px] font-semibold tracking-wide leading-none whitespace-nowrap",
                        "pointer-events-none select-none",
                        className
                    )}
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
}
