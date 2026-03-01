'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileCode, GitBranch, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatContext } from '@/app/contexts/ChatContext';

interface FileDiffStat {
    file: string;
    added: number;
    removed: number;
    isUntracked?: boolean;
    isExternal?: boolean; // New: for files outside git or temporary artifacts
}

interface UncommittedFilesListProps {
    uncommitted: {
        added: number;
        removed: number;
        untracked: number;
        hasChanges: boolean;
        files: FileDiffStat[];
    } | null;
    className?: string;
}

export function UncommittedFilesList({ uncommitted, className }: UncommittedFilesListProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { activeContextFiles } = useChatContext();

    // Focus ONLY on files with actual changes (Git diff or true External Artifacts)
    const sessionFiles = useMemo(() => {
        const gitFiles = uncommitted?.files || [];
        
        // Helper to check if two paths refer to the same file
        const isSameFile = (pathA: string, pathB: string) => {
            if (pathA === pathB) return true;
            const normA = pathA.replace(/\\/g, '/').toLowerCase();
            const normB = pathB.replace(/\\/g, '/').toLowerCase();
            return normA.endsWith('/' + normB) || normB.endsWith('/' + normA);
        };

        // 1. Start with files that have Git diffs AND were touched by AI
        const touchedGitFiles = gitFiles
            .filter(gf => activeContextFiles.some(ap => isSameFile(gf.file, ap)))
            .map(gf => ({ ...gf, isExternal: false }));

        // 2. Add files that AI touched but are NOT in Git diff (likely true Artifacts)
        const externalArtifacts: FileDiffStat[] = [];
        
        // Deduplicate activeContextFiles first
        const uniqueActivePaths = Array.from(new Set(activeContextFiles));

        uniqueActivePaths.forEach(activePath => {
            const alreadyInGit = gitFiles.some(gf => isSameFile(gf.file, activePath));
            if (!alreadyInGit) {
                // If it's not in Git diff, check if it's likely an external artifact
                // Real artifacts usually have absolute paths or are in /temp/
                const isLikelyInternal = activePath.includes('GGBond') || !activePath.startsWith('/');
                
                if (!isLikelyInternal || activePath.includes('/temp/')) {
                    externalArtifacts.push({
                        file: activePath,
                        added: 0,
                        removed: 0,
                        isExternal: true
                    });
                }
            }
        });

        return [...touchedGitFiles, ...externalArtifacts];
    }, [uncommitted, activeContextFiles]);

    if (sessionFiles.length === 0) return null;

    // Calculate totals ONLY for the files visible in this session
    const totalAdded = sessionFiles.reduce((sum, f) => sum + (f.added || 0), 0);
    const totalRemoved = sessionFiles.reduce((sum, f) => sum + (f.removed || 0), 0);
    const untrackedCount = sessionFiles.filter(f => f.isUntracked).length;

    return (
        <div className={cn("w-full px-4 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300", className)}>
            <div className="max-w-3xl mx-auto">
                <div className="bg-card/40 border border-border/40 rounded-lg overflow-hidden backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                    {/* Summary Header */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/30 transition-colors text-[11px] font-medium"
                    >
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Sparkles className="w-3 h-3 text-purple-500" />
                            <span>Session Changes:</span>
                            <div className="flex items-center gap-1.5 ml-1">
                                {totalAdded > 0 && <span className="text-emerald-500">+{totalAdded}</span>}
                                {totalRemoved > 0 && <span className="text-rose-500">-{totalRemoved}</span>}
                                {untrackedCount > 0 && (
                                    <span className="text-amber-500 font-mono ml-0.5" title="New files in this session">+{untrackedCount} new</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground/60">
                            <span>{sessionFiles.length} file{sessionFiles.length !== 1 ? 's' : ''}</span>
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </div>
                    </button>

                    {/* File List */}
                    {isExpanded && (
                        <div className="border-t border-border/20 max-h-[160px] overflow-y-auto bg-muted/5 py-1.5 custom-scrollbar">
                            <div className="space-y-0.5">
                                {sessionFiles.map((f, idx) => (
                                    <div key={f.file || idx} className="flex items-center justify-between px-3 py-1 hover:bg-muted/30 group transition-colors">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {f.isExternal ? (
                                                <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                                            ) : f.isUntracked ? (
                                                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                            ) : (
                                                <FileCode className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                                            )}
                                            <span className="truncate text-[10px] text-foreground/80 font-mono group-hover:text-foreground transition-colors" title={f.file}>
                                                {f.file.split('/').pop()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-4 font-mono text-[9px]">
                                            {f.isExternal ? (
                                                <span className="text-purple-500/80 px-1 bg-purple-500/10 rounded">artifact</span>
                                            ) : f.isUntracked ? (
                                                <span className="text-amber-500/80">new file</span>
                                            ) : (
                                                <>
                                                    {f.added > 0 && <span className="text-emerald-500/80">+{f.added}</span>}
                                                    {f.removed > 0 && <span className="text-rose-500/80">-{f.removed}</span>}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
