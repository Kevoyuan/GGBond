import React, { useState, useEffect, useCallback } from 'react';
import { ListOrdered, Play, Pause, Trash2, RotateCcw, ChevronDown, ChevronUp, X, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueItem {
  id: number;
  session_id: string;
  content: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  error?: string;
}

interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface QueuePanelProps {
  sessionId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onProcessNext?: () => void;
  isProcessing?: boolean;
}

export function QueuePanel({ sessionId, isOpen, onToggle, onProcessNext, isProcessing = false }: QueuePanelProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQueue = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/queue?sessionId=${sessionId}&stats=true`);
      const data = await res.json();
      setItems(data.messages || []);
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchQueue();
      // Poll for updates when processing
      const interval = setInterval(fetchQueue, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, sessionId, fetchQueue]);

  const handleClear = async (type?: 'completed' | 'failed' | 'all') => {
    if (!sessionId) return;

    const action = type === 'all' ? 'clear' : type === 'completed' ? 'clearCompleted' : 'clearFailed';
    try {
      await fetch(`/api/queue?action=${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      fetchQueue();
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await fetch('/api/queue?action=cancel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      fetchQueue();
    } catch (error) {
      console.error('Failed to cancel item:', error);
    }
  };

  const handleRetry = async (id: number) => {
    try {
      await fetch('/api/queue?action=retry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      fetchQueue();
    } catch (error) {
      console.error('Failed to retry item:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const truncateContent = (content: string, maxLength: number = 80) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'cancelled':
        return <X className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="border border-gray-700 bg-gray-900">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-200">Message Queue</span>
          {stats && (
            <span className="text-xs text-gray-400">
              ({stats.pending} pending, {stats.processing} processing)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchQueue}
            className="p-1 hover:bg-gray-700 rounded"
            title="Refresh"
          >
            <RotateCcw className={cn("w-4 h-4 text-gray-400", loading && "animate-spin")} />
          </button>
          {onProcessNext && stats && stats.pending > 0 && (
            <button
              onClick={onProcessNext}
              disabled={isProcessing}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded",
                isProcessing
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Process Next
            </button>
          )}
          <button
            onClick={() => handleClear('completed')}
            className="p-1 hover:bg-gray-700 rounded"
            title="Clear completed"
          >
            <Trash2 className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            No messages in queue
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  item.status === 'processing' && "bg-blue-900/20"
                )}
              >
                <div className="mt-0.5">
                  {getStatusIcon(item.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">
                    {truncateContent(item.content)}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{formatTime(item.created_at)}</span>
                    {item.started_at && (
                      <span>→ {formatTime(item.started_at)}</span>
                    )}
                    {item.error && (
                      <span className="text-red-400">Error: {item.error}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(item.status === 'pending' || item.status === 'processing') && (
                    <button
                      onClick={() => handleCancel(item.id)}
                      className="p-1 hover:bg-gray-700 rounded"
                      title="Cancel"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                  {(item.status === 'failed' || item.status === 'cancelled') && (
                    <button
                      onClick={() => handleRetry(item.id)}
                      className="p-1 hover:bg-gray-700 rounded"
                      title="Retry"
                    >
                      <RotateCcw className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default QueuePanel;
