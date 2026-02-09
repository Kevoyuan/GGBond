import React from 'react';

export function Header() {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 z-20 relative">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-lg tracking-tight">Gemini Chat</span>
      </div>

      {/* Modes / Right Actions - Keeping these for now as placeholders or future use */}
      <div className="flex items-center bg-muted/50 p-1 rounded-lg">
        <button className="px-3 py-1 rounded-md bg-background shadow-sm text-xs font-medium text-foreground">
          Code
        </button>
        <button className="px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          Plan
        </button>
        <button className="px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          Ask
        </button>
      </div>
    </header>
  );
}
