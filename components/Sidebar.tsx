import React, { useState, useMemo } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Settings, 
  Moon, 
  Sun, 
  FolderOpen,
  Box,
  Search,
  Plug
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Session {
  id: string;
  title: string;
  created_at: string;
}

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onOpenSkills: () => void;
  isDark: boolean;
  toggleTheme: () => void;
}

type SidebarView = 'chat' | 'files';

export function Sidebar({ 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onDeleteSession, 
  onNewChat,
  onOpenSkills,
  isDark,
  toggleTheme
}: SidebarProps) {
  const [activeView, setActiveView] = useState<SidebarView>('chat');
  const [searchTerm, setSearchTerm] = useState('');

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const groups: Record<string, Session[]> = {
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Older': []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const lastWeek = today - 86400000 * 7;

    sessions.forEach(session => {
      const date = new Date(session.created_at).getTime();
      if (date >= today) {
        groups['Today'].push(session);
      } else if (date >= yesterday) {
        groups['Yesterday'].push(session);
      } else if (date >= lastWeek) {
        groups['Previous 7 Days'].push(session);
      } else {
        groups['Older'].push(session);
      }
    });

    return groups;
  }, [sessions]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedSessions;
    const result: Record<string, Session[]> = {};
    Object.entries(groupedSessions).forEach(([key, list]) => {
      const filtered = list.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()));
      if (filtered.length > 0) result[key] = filtered;
    });
    return result;
  }, [groupedSessions, searchTerm]);

  return (
    <div className="flex h-full border-r bg-muted/10">
      {/* Navigation Rail */}
      <div className="w-14 border-r flex flex-col items-center py-4 gap-4 bg-card z-10 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
          <Box className="w-5 h-5 text-primary" />
        </div>
        
        <div className="flex flex-col gap-3 w-full px-2 items-center">
          <button 
            onClick={onNewChat}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
          
          <div className="w-8 h-px bg-border/50 my-1" />
          
          <NavButton 
            active={activeView === 'chat'} 
            onClick={() => setActiveView('chat')}
            icon={MessageSquare}
            label="Chats"
          />

          <NavButton 
            active={activeView === 'files'} 
            onClick={() => setActiveView('files')}
            icon={FolderOpen}
            label="Files"
          />

          <NavButton 
            active={false} 
            onClick={onOpenSkills}
            icon={Plug}
            label="Skills"
          />
        </div>

        <div className="mt-auto flex flex-col gap-3 w-full px-2 items-center">
          <button 
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-secondary-foreground border border-border">
            U
          </div>
        </div>
      </div>

      {/* Side Panel Content */}
      <div className="w-64 flex flex-col bg-muted/5">
        {activeView === 'chat' ? (
          <>
            <div className="p-4 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="relative group">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search chats..." 
                  className="w-full bg-background border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
              {Object.entries(filteredGroups).map(([group, list]) => (
                list.length > 0 && (
                  <div key={group} className="mb-6">
                    <div className="px-3 mb-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">
                      {group}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {list.map((session) => (
                        <div 
                          key={session.id}
                          className={cn(
                            "group flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg cursor-pointer transition-all border border-transparent",
                            currentSessionId === session.id 
                              ? "bg-background shadow-sm border-border text-foreground font-medium" 
                              : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => onSelectSession(session.id)}
                        >
                          <MessageSquare className={cn(
                            "w-4 h-4 shrink-0 transition-opacity",
                            currentSessionId === session.id ? "text-primary opacity-100" : "opacity-50"
                          )} />
                          <span className="truncate flex-1">{session.title}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
              
              {Object.values(filteredGroups).every(l => l.length === 0) && (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                  <Search className="w-8 h-8 mb-2 opacity-20" />
                  <p>No chats found</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 opacity-40" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Project Files</h3>
            <p className="text-sm opacity-70">
              File exploration is currently available via the command line.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 relative group",
        active 
          ? "bg-primary text-primary-foreground shadow-md" 
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="w-5 h-5" />
      
      {/* Tooltip */}
      <div className="absolute left-full ml-3 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-border">
        {label}
      </div>
    </button>
  );
}
