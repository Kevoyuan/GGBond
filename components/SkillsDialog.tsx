import React, { useEffect, useState } from 'react';
import { X, Plug, AlertCircle, Loader2, Play, Pause, Trash, Plus, Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skill } from '@/app/api/skills/route';

interface SkillsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SkillsDialog({ open, onClose }: SkillsDialogProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [installSource, setInstallSource] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSkills = skills.filter(skill => 
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (skill.description && skill.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    if (open) {
      fetchSkills();
    }
  }, [open]);

  const fetchSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/skills');
      if (!res.ok) throw new Error('Failed to fetch skills');
      const data = await res.json();
      setSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!installSource.trim()) return;
    
    setProcessing('installing');
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', source: installSource }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Install failed');
      }

      setInstallSource('');
      setShowInstall(false);
      await fetchSkills();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setProcessing(null);
    }
  };

  const handleAction = async (action: 'enable' | 'disable' | 'uninstall', name: string) => {
    setProcessing(name);
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, name }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }

      // Refresh list
      await fetchSkills();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setProcessing(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Agent Skills</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowInstall(!showInstall)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                showInstall 
                  ? "bg-primary/10 text-primary border-primary/20" 
                  : "bg-background hover:bg-muted text-muted-foreground border-border"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Install Skill
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Install Form */}
        {showInstall && (
          <div className="p-4 border-b bg-muted/10 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={installSource}
                onChange={(e) => setInstallSource(e.target.value)}
                placeholder="Enter skill path or URL (e.g., /path/to/skill or https://github.com/...)"
                className="flex-1 px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
              />
              <button
                onClick={handleInstall}
                disabled={!installSource.trim() || processing === 'installing'}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processing === 'installing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Install
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {!loading && !error && skills.length > 0 && (
          <div className="px-4 py-3 border-b bg-muted/5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Loading skills...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-destructive">
              <AlertCircle className="w-8 h-8" />
              <p>{error}</p>
              <button 
                onClick={fetchSkills}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <Plug className="w-8 h-8 opacity-20" />
              <p>No skills discovered.</p>
              <p className="text-xs opacity-70">Use <code>gemini skills install</code> via CLI to add skills.</p>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <Search className="w-8 h-8 opacity-20" />
              <p>No skills match "{searchQuery}"</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredSkills.map((skill) => (
                <div 
                  key={skill.name}
                  className={cn(
                    "flex flex-col gap-2 p-4 rounded-lg border transition-all",
                    skill.status === 'Enabled' 
                      ? "bg-card border-border shadow-sm" 
                      : "bg-muted/30 border-transparent opacity-80 hover:opacity-100"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-base truncate">{skill.name}</h3>
                        {skill.isBuiltIn && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 font-medium">
                            Built-in
                          </span>
                        )}
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
                          skill.status === 'Enabled' 
                            ? "bg-green-500/10 text-green-500 border-green-500/20" 
                            : "bg-muted text-muted-foreground border-border"
                        )}>
                          {skill.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {skill.description || 'No description provided.'}
                      </p>
                      {skill.location && (
                        <p className="text-xs text-muted-foreground/50 mt-2 truncate font-mono">
                          {skill.location}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {processing === skill.name ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary m-2" />
                      ) : (
                        <>
                          {skill.status === 'Enabled' ? (
                            <button
                              onClick={() => handleAction('disable', skill.name)}
                              className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Disable Skill"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAction('enable', skill.name)}
                              className="p-2 rounded-md hover:bg-primary/10 text-primary transition-colors"
                              title="Enable Skill"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          
                          {!skill.isBuiltIn && (
                            <button
                              onClick={() => {
                                if (confirm(`Uninstall skill "${skill.name}"?`)) {
                                  handleAction('uninstall', skill.name);
                                }
                              }}
                              className="p-2 rounded-md hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors"
                              title="Uninstall Skill"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex justify-between items-center text-xs text-muted-foreground">
          <p>Powered by <code>gemini-cli</code></p>
          <p>Install more skills via terminal</p>
        </div>
      </div>
    </div>
  );
}
