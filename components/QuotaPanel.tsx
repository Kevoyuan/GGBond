'use client';

import React, { useEffect, useState, memo } from 'react';
import { Shield, Info, RefreshCw, AlertCircle, Clock, Zap, Activity, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PanelHeader } from './sidebar/PanelHeader';

interface BucketInfo {
    remainingAmount?: string;
    remainingFraction?: number;
    resetTime?: string;
    tokenType?: string;
    modelId?: string;
}

interface QuotaResponse {
    quota?: {
        buckets?: BucketInfo[];
    };
}

interface QuotaPanelProps {
    className?: string;
}

export const QuotaPanel = memo(function QuotaPanel({ className }: QuotaPanelProps) {
    const [quota, setQuota] = useState<QuotaResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchQuota = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/quota');
            if (res.ok) {
                const data = await res.json();
                setQuota(data);
                setLastUpdated(new Date());
                setError(null);
            } else {
                setError('Failed to fetch quota information');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuota();
        // Refresh every 5 minutes
        const interval = setInterval(fetchQuota, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={cn("flex flex-col h-full bg-card/30", className)}>
            <PanelHeader
                title="Real-time Quota"
                icon={Activity}
                actions={
                    <button
                        onClick={fetchQuota}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        title="Sync Usage"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                    </button>
                }
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {loading && !quota ? (
                    <div className="flex flex-col items-center justify-center h-48 opacity-20">
                        <RefreshCw className="w-10 h-10 animate-spin mb-3" />
                        <p className="text-xs font-bold uppercase tracking-widest text-center">Syncing Resources...</p>
                    </div>
                ) : error ? (
                    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-4 text-center group">
                        <AlertCircle className="w-10 h-10 text-red-500 mx-auto opacity-50 group-hover:scale-110 transition-transform" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-red-500">Synchronization Error</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{error}</p>
                        </div>
                        <button
                            onClick={fetchQuota}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 active:scale-95 transition-colors"
                        >
                            Retry Sync
                        </button>
                    </div>
                ) : !quota?.quota?.buckets || quota.quota.buckets.length === 0 ? (
                    <div className="p-10 text-center space-y-4 opacity-20 grayscale">
                        <Shield className="w-12 h-12 mx-auto text-muted-foreground" />
                        <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">No usage constraints detected for this project.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {quota.quota.buckets.map((bucket, idx) => {
                            const fraction = bucket.remainingFraction ?? 0;
                            const isLow = fraction < 0.2;
                            const isCritical = fraction < 0.05;

                            return (
                                <div key={idx} className="group p-4 rounded-xl border border-border/50 bg-card/40 space-y-4 relative overflow-hidden transition-colors duration-300 hover:border-primary/30">
                                    <div className="flex items-start justify-between relative z-10 gap-2">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className={cn(
                                                "w-9 h-9 rounded-lg flex items-center justify-center border transition-colors shrink-0",
                                                isCritical ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                    isLow ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                        "bg-primary/5 text-primary border-primary/10 group-hover:bg-primary/10"
                                            )}>
                                                <Zap className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground/60 truncate">
                                                    {bucket.modelId || 'Provisioned Capacity'}
                                                </p>
                                                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                                                    {bucket.tokenType || 'Global Requests'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={cn(
                                                "text-xl font-mono font-bold leading-none tracking-tighter",
                                                isCritical ? "text-red-500" : isLow ? "text-amber-500" : "text-primary"
                                            )}>
                                                {(fraction * 100).toFixed(0)}%
                                            </p>
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground/40 mt-1 tracking-tight">Available</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1 relative z-10">
                                        <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden border border-border/5">
                                            <div
                                                className={cn(
                                                    "h-full transition-colors duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]",
                                                    isCritical ? "bg-red-500 shadow-red-500/40" : isLow ? "bg-amber-500 shadow-amber-500/40" : "bg-primary"
                                                )}
                                                style={{ width: `${fraction * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] pt-1 relative z-10 font-bold uppercase tracking-tighter">
                                        <div className="flex items-center gap-2 text-muted-foreground/70">
                                            <div className="p-0.5 rounded bg-muted">
                                                <Info className="w-2.5 h-2.5" />
                                            </div>
                                            <span>{bucket.remainingAmount || 'UNLIMITED'}</span>
                                        </div>
                                        {bucket.resetTime && (
                                            <div className="flex items-center gap-2 text-muted-foreground/50">
                                                <div className="p-0.5 rounded bg-muted">
                                                    <Clock className="w-2.5 h-2.5" />
                                                </div>
                                                <span>REFRESH: {new Date(bucket.resetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Glass reflection effect */}
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 -mr-12 -mt-12 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-card/20">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    <span className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5" />
                        Status: Nominal
                    </span>
                    <span className="font-mono tabular-nums">{lastUpdated ? lastUpdated.toLocaleTimeString([], { hour12: false }) : '--:--:--'}</span>
                </div>

            </div>
        </div>
    );
});
