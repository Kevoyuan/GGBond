'use client';

import React, { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Trash2, Loader2, Search, X } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface ArchivedSession {
  id: string;
  title: string;
  created_at: string | number;
  updated_at?: string | number;
  workspace?: string;
}

interface ArchivedSessionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ArchivedSessionsDialog({
  open,
  onOpenChange,
  onRestore,
  onDelete
}: ArchivedSessionsDialogProps) {
  const [sessions, setSessions] = useState<ArchivedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      fetchArchivedSessions();
    }
  }, [open]);

  const fetchArchivedSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions?archived=true');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Failed to load archived sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-center justify-center",
      open ? "visible" : "invisible"
    )}>
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className={cn(
        "relative w-full max-w-lg mx-4 bg-background border rounded-xl shadow-2xl transform transition-all",
        open ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Archived Sessions</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search archived sessions..."
              className="w-full bg-muted border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Archive className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">
                {searchTerm ? 'No matching archived sessions' : 'No archived sessions yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{session.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {session.workspace && <span className="mr-2">{session.workspace}</span>}
                      <span>{formatDate(session.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => onRestore(session.id)}
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Restore"
                    >
                      <ArchiveRestore className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(session.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            {filteredSessions.length} archived session{filteredSessions.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
