import React from 'react';
import { Target, AlertTriangle, Book, History, FileCode, Activity, ListTodo, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface StateSnapshotDisplayProps {
  content: string;
}

export function StateSnapshotDisplay({ content }: StateSnapshotDisplayProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  // Extract sections using regex
  const extractSection = (tag: string) => {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  };

  const snapshot = {
    overall_goal: extractSection('overall_goal'),
    active_constraints: extractSection('active_constraints'),
    key_knowledge: extractSection('key_knowledge'),
    artifact_trail: extractSection('artifact_trail'),
    file_system_state: extractSection('file_system_state'),
    recent_actions: extractSection('recent_actions'),
    task_state: extractSection('task_state'),
  };

  // Extract the header text (before the snapshot)
  const headerText = content.split('<state_snapshot>')[0].trim();

  // Parse task state for progress bar
  const taskState = snapshot.task_state || '';
  const tasks = taskState.split('\n').filter(line => line.trim());
  const completedTasks = tasks.filter(t => t.includes('[DONE]')).length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl">
      {/* Header Message */}
      {headerText && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{headerText}</div>
        </div>
      )}

      {/* Snapshot Card */}
      <div className="border border-border/60 rounded-xl bg-card overflow-hidden shadow-sm">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Session State Snapshot</span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border/40"
            >
              <div className="p-4 grid gap-6 md:grid-cols-2">
                {/* Left Column */}
                <div className="space-y-6">
                  <Section icon={Target} title="Overall Goal" content={snapshot.overall_goal} color="text-blue-500" />
                  <Section icon={AlertTriangle} title="Active Constraints" content={snapshot.active_constraints} color="text-amber-500" />
                  <Section icon={Book} title="Key Knowledge" content={snapshot.key_knowledge} color="text-purple-500" />
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <ListTodo className="w-4 h-4" />
                      <span>Task Progress</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 p-2 rounded border border-border/50">
                      {snapshot.task_state}
                    </div>
                  </div>

                  <Section icon={History} title="Recent Actions" content={snapshot.recent_actions} color="text-green-500" />
                  <Section icon={FileCode} title="File System State" content={snapshot.file_system_state} color="text-slate-500" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Section({ icon: Icon, title, content, color }: { icon: any, title: string, content: string | null, color: string }) {
  if (!content) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className={cn("w-4 h-4", color)} />
        <span>{title}</span>
      </div>
      <div className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap bg-muted/30 p-2.5 rounded-lg border border-border/50 font-mono">
        {content}
      </div>
    </div>
  );
}
