'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem = ({ toast, onDismiss }: ToastItemProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleDismiss = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 300);
  }, [onDismiss, toast.id]);

  const icons = {
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  };

  const styles = {
    error: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    success: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
  };

  const iconStyles = {
    error: 'text-red-500',
    success: 'text-green-500',
    info: 'text-blue-500',
    warning: 'text-yellow-500',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300',
        styles[toast.type],
        isVisible && !isLeaving ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      )}
      role="alert"
    >
      <span className={iconStyles[toast.type]}>{icons[toast.type]}</span>
      <p className="flex-1 text-sm text-gray-900 dark:text-gray-100">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ToastContainer = ({
  toasts,
  onDismiss,
  position = 'top-right'
}: ToastContainerProps) => {
  const positions = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none',
        positions[position]
      )}
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};

// Toast context for easy usage across the app
interface ToastContextValue {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
}

export const useToast = () => {
  // This will be provided via context in the actual implementation
  // For now, we'll use a simple approach with state in the parent
  throw new Error('useToast must be used within a ToastProvider');
};

// Helper to create toast utilities
export const createToast = (type: ToastType, message: string, duration?: number): Toast => ({
  id: Math.random().toString(36).substring(2, 9),
  type,
  message,
  duration,
});
