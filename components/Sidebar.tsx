import { Plus, Moon, Sun, MessageSquare, Trash2, MoreVertical, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Session {
  id: string;
  title: string;
  updated_at: number;
}

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  settings: { model: string; systemInstruction: string };
  setSettings: (settings: { model: string; systemInstruction: string }) => void;
}

const AVAILABLE_MODELS = [
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
];

export function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  theme,
  toggleTheme,
  settings,
  setSettings
}: SidebarProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="font-bold text-xl flex items-center gap-2">
          <span className="text-primary">✦</span>
          Gemini UI
        </h1>
        <button onClick={toggleTheme} className="p-2 hover:bg-muted rounded-full transition-colors">
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
      
      <div className="p-4">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <div className="text-xs font-semibold text-muted-foreground mb-2 px-2 uppercase tracking-wider">Recent Chats</div>
        <div className="space-y-1">
          {sessions.map((session) => (
            <div 
              key={session.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer transition-colors",
                currentSessionId === session.id 
                  ? "bg-accent text-accent-foreground font-medium" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
              <span className="truncate flex-1">{session.title}</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background/50 rounded transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No recent chats
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </span>
          <MoreVertical className={cn("w-4 h-4 transition-transform", showSettings ? "rotate-180" : "")} />
        </button>
        
        {showSettings && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div>
              <label className="text-xs font-medium mb-1.5 block">Model</label>
              <select 
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {AVAILABLE_MODELS.map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block">System Instructions</label>
              <textarea 
                value={settings.systemInstruction}
                onChange={(e) => setSettings({ ...settings, systemInstruction: e.target.value })}
                placeholder="You are a helpful assistant..."
                className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}
        
        <div className="mt-4 text-[10px] text-muted-foreground text-center">
          v0.2.0 • gemini-cli • local-db
        </div>
      </div>
    </aside>
  );
}
