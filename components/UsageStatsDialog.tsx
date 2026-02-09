import { Zap, Database, Activity, Calendar, BarChart3, Layers, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface StatEntry {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  cost: number;
  count: number;
}

interface UsageStats {
  daily: StatEntry;
  weekly: StatEntry;
  monthly: StatEntry;
  total: StatEntry;
}

interface UsageStatsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UsageStatsDialog({ open, onClose }: UsageStatsDialogProps) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Use Promise.resolve().then() to avoid "setState in effect" warning
      Promise.resolve().then(() => setLoading(true));
      fetch('/api/stats')
        .then(res => res.json())
        .then(data => setStats(data))
        .catch(err => console.error('Failed to fetch stats', err))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const defaultStat: StatEntry = {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
    cost: 0,
    count: 0,
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-5xl bg-background border border-border rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20 shrink-0">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg font-semibold tracking-tight">Usage Dashboard</h2>
                <p className="text-sm text-muted-foreground">
                  Track your token usage and estimated costs across different time periods.
                </p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {loading || !stats ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Loading usage statistics...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard 
                    title="Today" 
                    icon={<Activity className="w-4 h-4 text-blue-500" />} 
                    data={stats.daily || defaultStat} 
                  />
                  <StatCard 
                    title="This Week" 
                    icon={<Calendar className="w-4 h-4 text-purple-500" />} 
                    data={stats.weekly || defaultStat} 
                  />
                  <StatCard 
                    title="This Month" 
                    icon={<BarChart3 className="w-4 h-4 text-green-500" />} 
                    data={stats.monthly || defaultStat} 
                  />
                  <StatCard 
                    title="All Time" 
                    icon={<Layers className="w-4 h-4 text-orange-500" />} 
                    data={stats.total || defaultStat} 
                  />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function StatCard({ title, icon, data }: { title: string, icon: React.ReactNode, data: StatEntry }) {
  // Safe guard against undefined data
  if (!data) return null;
  
  // Calculate percentages
  const inputPercent = data.totalTokens > 0 ? (data.inputTokens / data.totalTokens) * 100 : 0;
  const outputPercent = data.totalTokens > 0 ? (data.outputTokens / data.totalTokens) * 100 : 0;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          {icon}
        </div>
        
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight">
            ${data.cost.toFixed(4)}
          </div>
          <div className="text-xs text-muted-foreground">
            Estimated Cost
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium">{data.totalTokens.toLocaleString()}</span>
            </div>
            <span className="text-muted-foreground">Total Tokens</span>
          </div>

          {/* Mini Bar Chart */}
          <div className="space-y-1.5">
            <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-blue-500/70" 
                style={{ width: `${inputPercent}%` }}
              />
              <div 
                className="h-full bg-green-500/70" 
                style={{ width: `${outputPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>In: {data.inputTokens.toLocaleString()}</span>
              <span>Out: {data.outputTokens.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-1.5" title="Cached Tokens">
              <Database className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{data.cachedTokens.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5" title="Requests">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{data.count} reqs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
