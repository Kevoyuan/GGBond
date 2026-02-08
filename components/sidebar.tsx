'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, MessageSquare, Trash2, Settings, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface Session {
  id: string;
  title: string;
  updated_at: number;
}

export function Sidebar({ 
  currentSessionId, 
  onSelectSession 
}: { 
  currentSessionId?: string;
  onSelectSession: (id: string | undefined) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [currentSessionId]); // Refresh when session changes

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;
    
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (currentSessionId === id) {
        onSelectSession(undefined);
      }
      fetchSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  return (
    <div className="flex h-full w-[250px] flex-col border-r bg-muted/30">
      <div className="p-4">
        <Button 
          onClick={() => onSelectSession(undefined)} 
          className="w-full justify-start gap-2" 
          variant="default"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-2">
          {sessions.map((session) => (
            <Button
              key={session.id}
              variant={currentSessionId === session.id ? "secondary" : "ghost"}
              className={cn(
                "justify-start gap-2 px-2 text-left font-normal",
                currentSessionId === session.id && "bg-secondary"
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="truncate w-full">{session.title || 'Untitled Chat'}</span>
              <div 
                className="ml-auto opacity-0 group-hover:opacity-100 hover:text-destructive"
                onClick={(e) => handleDelete(e, session.id)}
              >
                <Trash2 className="h-3 w-3" />
              </div>
            </Button>
          ))}
          {sessions.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No chats yet.
            </div>
          )}
        </div>
      </ScrollArea>
      <Separator />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
