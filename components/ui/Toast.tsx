'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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

  const handleDismiss = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 300);
  }, [onDismiss, toast.id]);

  useEffect(() => {
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
  }, [toast.duration, handleDismiss]);

  const icons = {
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    info: <Info className="w-5 h-5 text-[var(--accent)]" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  };

  const styles = {
    error: 'bg-[var(--bg-secondary)] border-[var(--border-error)]',
    success: 'bg-[var(--bg-secondary)] border-[var(--border-subtle)]',
    info: 'bg-[var(--bg-secondary)] border-[var(--border-subtle)]',
    warning: 'bg-[var(--bg-secondary)] border-[var(--border-warning)]',
  };

  const iconStyles = {
    error: 'text-[var(--text-error)]',
    success: 'text-[var(--text-success)]',
    info: 'text-[var(--accent)]',
    warning: 'text-[var(--text-warning)]',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-opacity transition-transform duration-300',
        styles[toast.type],
        isVisible && !isLeaving ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      )}
      role="alert"
    >
      <span className={iconStyles[toast.type]}>{icons[toast.type]}</span>
      <p className="flex-1 text-sm text-[var(--text-primary)]">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-[var(--text-secondary)]" />
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
    'top-right': 'top-[var(--titlebar-h)] right-4',
    'top-left': 'top-[var(--titlebar-h)] left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-[var(--titlebar-h)] left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col gap-2 w-full max-w-xs pointer-events-none',
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

interface ToastContextValue {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a no-op function when outside provider instead of throwing
    const noop = () => {};
    return {
      showToast: noop,
      showError: noop,
      showSuccess: noop,
      showInfo: noop,
      showWarning: noop,
    };
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
  defaultPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ToastProvider = ({ children, defaultPosition = 'top-right' }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${toastIdRef.current++}`;
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const showError = useCallback((message: string, duration?: number) => {
    showToast('error', message, duration);
  }, [showToast]);

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast('success', message, duration);
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    showToast('info', message, duration);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    showToast('warning', message, duration);
  }, [showToast]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showInfo, showWarning }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} position={defaultPosition} />
    </ToastContext.Provider>
  );
};

// Helper to create toast utilities
export const createToast = (type: ToastType, message: string, duration?: number): Toast => ({
  id: Math.random().toString(36).substring(2, 9),
  type,
  message,
  duration,
});
