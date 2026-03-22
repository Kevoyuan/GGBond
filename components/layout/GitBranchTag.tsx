import { GitBranch } from 'lucide-react';

interface GitBranchTagProps {
  branch: string | null;
  className?: string;
}

export function GitBranchTag({ branch, className }: GitBranchTagProps) {
  if (!branch) return null;

  return (
    <div
      className={`
        flex items-center gap-1.5
        text-[10px] sm:text-xs
        text-muted-foreground/70
        bg-secondary/50
        border border-border/30
        px-2 py-1 rounded-md
        max-w-[120px] truncate
        ${className || ''}
      `}
    >
      <GitBranch className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
      <span className="truncate font-medium">{branch}</span>
    </div>
  );
}
