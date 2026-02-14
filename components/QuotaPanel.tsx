
import React, { useEffect, useState } from 'react';
import { Shield, Info, RefreshCw, AlertCircle, Clock, Zap, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function QuotaPanel({ className }: QuotaPanelProps) {
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
        <div className={cn("flex flex-col h-full bg-card", className)}>
            <div className="p-3 border-b flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-sm">Real-time Quota</h2>
                </div>
                <button
                    onClick={fetchQuota}
                    className="p-1.5 hover:bg-accent rounded-md transition-colors"
                    title="Refresh Quota"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {loading && !quota ? (
                    <div className="flex flex-col items-center justify-center h-40 space-y-2 opacity-50">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-xs">Checking resources...</p>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-2 text-center">
                        <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
                        <p className="text-xs text-destructive font-medium">{error}</p>
                        <button
                            onClick={fetchQuota}
                            className="text-[10px] uppercase tracking-wider font-bold text-primary hover:underline pt-1"
                        >
                            Retry
                        </button>
                    </div>
                ) : !quota?.quota?.buckets || quota.quota.buckets.length === 0 ? (
                    <div className="p-8 text-center space-y-3 opacity-50">
                        <Shield className="w-12 h-12 mx-auto text-muted-foreground" />
                        <p className="text-sm italic">No quota information available for this project.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {quota.quota.buckets.map((bucket, idx) => {
                            const fraction = bucket.remainingFraction ?? 0;
                            const isLow = fraction < 0.2;
                            const isCritical = fraction < 0.05;

                            return (
                                <div key={idx} className="p-4 rounded-xl border bg-card/50 space-y-3 relative overflow-hidden group hover:border-primary/30 transition-colors">
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center",
                                                isCritical ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                                                    isLow ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                                                        "bg-primary/10 text-primary"
                                            )}>
                                                <Zap className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wider opacity-60">
                                                    {bucket.modelId || 'General API'}
                                                </p>
                                                <p className="text-sm font-semibold">
                                                    {bucket.tokenType || 'Requests'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={cn(
                                                "text-lg font-mono font-bold leading-none",
                                                isCritical ? "text-red-500" : isLow ? "text-amber-500" : "text-primary"
                                            )}>
                                                {(fraction * 100).toFixed(0)}%
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-1">Remaining</p>
                                        </div>
                                    </div>

                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative z-10">
                                        <div
                                            className={cn(
                                                "h-full transition-all duration-1000 ease-out rounded-full",
                                                isCritical ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-primary"
                                            )}
                                            style={{ width: `${fraction * 100}%` }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 relative z-10">
                                        <div className="flex items-center gap-1">
                                            <Info className="w-3 h-3" />
                                            <span>{bucket.remainingAmount || 'Limited'}</span>
                                        </div>
                                        {bucket.resetTime && (
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                <span>Resets: {new Date(bucket.resetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-muted/30 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Tier: Standard</span>
                    <span>{lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : 'Not updated'}</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-relaxed">
                    Quota reflects your currently associated Google Cloud project limits. Using a paid tier increases these thresholds significantly.
                </p>
            </div>
        </div>
    );
}
