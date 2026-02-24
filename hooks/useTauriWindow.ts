import { useCallback, useRef } from 'react';

/**
 * Custom hook for Tauri 2 window management.
 * Lazy-loads the Tauri Window API and caches the instance.
 * All methods silently no-op when running outside of Tauri (browser / Electron).
 */
export function useTauriWindow() {
    // Cache the window instance so we only import once
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const windowRef = useRef<any | null>(null);
    const resolvedRef = useRef(false);

    const getWindow = useCallback(async () => {
        if (resolvedRef.current) return windowRef.current;
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            windowRef.current = getCurrentWindow();
        } catch {
            windowRef.current = null;
        }
        resolvedRef.current = true;
        return windowRef.current;
    }, []);

    /** Start window drag — call from onMouseDown on drag-region elements */
    const startDrag = useCallback(async (e: React.MouseEvent) => {
        // Only trigger on left mouse button and on direct titlebar clicks
        if (e.button !== 0) return;
        e.preventDefault();
        try {
            const win = await getWindow();
            if (win) await win.startDragging();
        } catch {
            // No-op outside Tauri
        }
    }, [getWindow]);

    const close = useCallback(async () => {
        try {
            const win = await getWindow();
            if (win) await win.close();
            else window.close();
        } catch {
            window.close();
        }
    }, [getWindow]);

    const minimize = useCallback(async () => {
        try {
            const win = await getWindow();
            if (win) await win.minimize();
        } catch {
            // No-op
        }
    }, [getWindow]);

    const toggleMaximize = useCallback(async () => {
        try {
            const win = await getWindow();
            if (win) await win.toggleMaximize();
        } catch {
            // No-op
        }
    }, [getWindow]);

    return { startDrag, close, minimize, toggleMaximize };
}
