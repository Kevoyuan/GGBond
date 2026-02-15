'use client';

import { useState, useCallback } from 'react';
import { Toast, ToastType } from '@/components/Toast';

export interface UseToastReturn {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
  showErrorToast: (message: string, duration?: number) => void;
  showWarningToast: (message: string, duration?: number) => void;
  showInfoToast: (message: string, duration?: number) => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showErrorToast = useCallback((message: string, duration = 6000) => {
    addToast('error', message, duration);
  }, [addToast]);

  const showWarningToast = useCallback((message: string, duration = 5000) => {
    addToast('warning', message, duration);
  }, [addToast]);

  const showInfoToast = useCallback((message: string, duration = 4000) => {
    addToast('info', message, duration);
  }, [addToast]);

  return {
    toasts,
    addToast,
    dismissToast,
    showErrorToast,
    showWarningToast,
    showInfoToast,
  };
}
