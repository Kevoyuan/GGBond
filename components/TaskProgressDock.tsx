import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Circle, ListTodo, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface TodoItem {
  description: string;
  status: TodoStatus;
}

interface TaskProgressDockProps {
  todos: TodoItem[];
}

export function TaskProgressDock({ todos }: TaskProgressDockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const todosSignature = useMemo(
    () => todos.map((todo) => `${todo.status}:${todo.description}`).join('\n'),
    [todos]
  );

  useEffect(() => {
    setCollapsed(false);
    setDismissed(false);
  }, [todosSignature]);

  const completed = todos.filter((todo) => todo.status === 'completed').length;
  const total = todos.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isCompleted = total > 0 && completed === total;

  if (dismissed) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-2">
      <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur shadow-sm overflow-hidden">
        <div className={cn(
          'flex items-center justify-between gap-3 px-4 py-3 bg-muted/30',
          !collapsed && 'border-b border-border/50'
        )}>
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">Task Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium tabular-nums">
              {completed}/{total} ({percent}%)
            </span>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/70 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={collapsed ? 'Expand task progress' : 'Collapse task progress'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            </button>
            {isCompleted && (
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/70 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Close task progress"
                title="Close"
              >
                <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {!collapsed && (
          <>
            <div className="px-4 pt-2">
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <div className="px-4 py-3 space-y-1.5 max-h-[12rem] overflow-y-auto custom-scrollbar pr-1">
              {todos.map((todo, idx) => (
                <div key={`${todo.description}-${idx}`} className="flex items-start gap-2.5 min-h-[1.9rem]">
                  <div className="mt-0.5 shrink-0">
                    {todo.status === 'completed' && <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" />}
                    {todo.status === 'in_progress' && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none text-blue-500" aria-hidden="true" />}
                    {todo.status === 'cancelled' && <X className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
                    {todo.status === 'pending' && <Circle className="w-4 h-4 text-muted-foreground/70" aria-hidden="true" />}
                  </div>
                  <div
                    className={cn(
                      'text-sm leading-7 truncate',
                      todo.status === 'completed'
                        ? 'text-muted-foreground line-through'
                        : todo.status === 'cancelled'
                          ? 'text-muted-foreground/80 line-through'
                          : 'text-foreground'
                    )}
                    title={todo.description}
                  >
                    {idx + 1}. {todo.description}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
