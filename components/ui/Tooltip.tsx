import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
    delay = 200,
    sideOffset = 18 // Default to 18 for sidebar clearance
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isMeasured, setIsMeasured] = useState(false);
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
    };

    useLayoutEffect(() => {
        if (isVisible) {
            updatePosition();
            setIsMeasured(true);
        } else {
            setIsMeasured(false);
        }
    }, [isVisible]);

    useEffect(() => {
        if (isVisible && isMeasured) {
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
    }, [isVisible, isMeasured]);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
        setIsMeasured(false);
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="flex items-center justify-center"
            >
                {children}
            </div>

            {/* Measurement Phase: Render invisible div to calculate position */}
            {isVisible && !isMeasured && createPortal(
                <div
                    ref={tooltipRef}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        opacity: 0,
                        pointerEvents: 'none',
                        visibility: 'hidden'
                    }}
                    className={cn(
                        "px-2 py-1 bg-card text-foreground text-xs rounded-md shadow-md border border-border whitespace-nowrap",
                        className
                    )}
                >
                    {content}
                </div>,
                document.body
            )}

            {/* Presentation Phase: Render animated motion.div at calculated position */}
            {isVisible && isMeasured && createPortal(
                <AnimatePresence>
                    <motion.div
                        ref={tooltipRef}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        style={{
                            position: 'fixed',
                            top: coords.top,
                            left: coords.left,
                            zIndex: 9999,
                        }}
                        className={cn(
                            "px-2 py-1 bg-card text-foreground text-xs rounded-md shadow-md border border-border whitespace-nowrap",
                            className
                        )}
                    >
                        {content}
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
