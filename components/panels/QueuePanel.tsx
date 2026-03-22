'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ListOrdered, Play, Pause, Trash2, RotateCcw, ChevronDown, ChevronRight, X, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PanelHeader } from './sidebar/PanelHeader';

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
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const truncateContent = (content: string, maxLength: number = 60) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />;
      case 'processing':
        return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case 'failed':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      case 'cancelled':
        return <X className="w-3.5 h-3.5 text-muted-foreground/60" />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-card/30 border-l border-border/40">
      <PanelHeader
        title="Message Queue"
        icon={ListOrdered}
        badge={stats?.pending || undefined}
        actions={
          <div className="flex items-center gap-1">
            <button
              onClick={fetchQueue}
              className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="Refresh Queue"
            >
              <RotateCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </button>
            {onProcessNext && stats && stats.pending > 0 && (
              <button
                onClick={onProcessNext}
                disabled={isProcessing}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isProcessing
                    ? "bg-muted text-muted-foreground/30 cursor-not-allowed"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                )}
                title="Process Next"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => handleClear('completed')}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
              title="Clear Completed"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {stats && (
        <div className="px-4 py-2 bg-card/10 border-b border-border/30 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <div className="flex gap-3">
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {stats.pending} Pending
            </span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {stats.processing} Active
            </span>
          </div>
          <span className="font-mono text-[9px] opacity-40">Total: {stats.total}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 opacity-30 grayscale">
            <ListOrdered className="w-10 h-10 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Queue Vacuum</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "p-3 group hover:bg-muted/30 transition-colors relative",
                  item.status === 'processing' && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground/90 truncate group-hover:text-foreground transition-colors">
                      {truncateContent(item.content)}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/50 font-mono">
                      <span>{formatTime(item.created_at)}</span>
                      {item.started_at && (
                        <>
                          <span>→</span>
                          <span className="text-primary/70">{formatTime(item.started_at)}</span>
                        </>
                      )}
                    </div>
                    {item.error && (
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-red-500/80 font-bold uppercase tracking-tighter">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span className="truncate">{item.error}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-colors">
                    {(item.status === 'pending' || item.status === 'processing') && (
                      <button
                        onClick={() => handleCancel(item.id)}
                        className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded transition-colors"
                        title="Cancel Task"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(item.status === 'failed' || item.status === 'cancelled') && (
                      <button
                        onClick={() => handleRetry(item.id)}
                        className="p-1 hover:bg-emerald-500/10 hover:text-emerald-500 rounded transition-colors"
                        title="Retry Task"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-card/10">
        <p className="text-[10px] leading-relaxed text-muted-foreground/60 italic">
          Items are processed sequentially by the active model turn. Clearing completed tasks improves interface speed.
        </p>
      </div>
    </div>
  );
}

export default QueuePanel;
