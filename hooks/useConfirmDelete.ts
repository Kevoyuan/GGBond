'use client';

import { useState, useCallback } from 'react';

/**
 * Hook for managing delete confirmation state.
 * Returns the pending ID and handlers for setting/clearing it.
 */
export function useConfirmDelete<T extends string>() {
    const [pendingId, setPendingId] = useState<T | null>(null);

    const startDelete = useCallback((id: T) => {
        setPendingId(id);
    }, []);

    const cancelDelete = useCallback(() => {
        setPendingId(null);
    }, []);

    const confirmDelete = useCallback((id: T, onConfirm: (id: T) => void) => {
        onConfirm(id);
        setPendingId(null);
    }, []);

    const handleMouseLeave = useCallback((currentId: T) => {
        if (pendingId === currentId) {
            setPendingId(null);
        }
    }, [pendingId]);

    const isPending = useCallback((id: T) => pendingId === id, [pendingId]);

    return {
        pendingId,
        startDelete,
        cancelDelete,
        confirmDelete,
        handleMouseLeave,
        isPending,
    };
}
