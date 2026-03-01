'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from '../ModuleCard';
import { FileCode2, FileText, FileJson, Loader2, FolderOpen, AlertTriangle, Eye, Edit3, Pencil } from 'lucide-react';

interface FileOpsData {
  filePath: string;
  fileName: string;
  directory: string;
  read: number;
  write: number;
  edit: number;
  shell: number;
  total: number;
  lastOperationDate: string;
}

interface DirectoryHeatmap {
  directory: string;
  count: number;
}

export function FileHeatmapPanel() {
  const [files, setFiles] = useState<FileOpsData[]>([]);
  const [directories, setDirectories] = useState<DirectoryHeatmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'files' | 'heatmap'>('files');

  useEffect(() => {
    fetch('/api/analytics/file-ops')
      .then(res => res.json())
      .then(data => {
        setFiles(data.files || []);
        setDirectories(data.directories || []);
      })
      .catch(err => {
        console.error('Failed to load file ops:', err);
        setError('Failed to load data');
      })
      .finally(() => setLoading(false));
  }, []);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java'].includes(ext || '')) {
      return <FileCode2 size={14} className="text-blue-500" />;
    }
    if (['json', 'yaml', 'yml', 'toml'].includes(ext || '')) {
      return <FileJson size={14} className="text-amber-500" />;
    }
    if (['md', 'txt'].includes(ext || '')) {
      return <FileText size={14} className="text-gray-500" />;
    }
    return <FileCode2 size={14} className="text-gray-400" />;
  };

  const getHeatmapColor = (count: number, maxCount: number) => {
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 'bg-emerald-600';
    if (ratio >= 0.6) return 'bg-emerald-500';
    if (ratio >= 0.4) return 'bg-emerald-400';
    if (ratio >= 0.2) return 'bg-emerald-300';
    return 'bg-emerald-200 dark:bg-emerald-900';
  };

  if (loading) {
    return (
      <ModuleCard title="File Operation Heatmap" description="Most edited files in your project" icon={FolderOpen}>
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      </ModuleCard>
    );
  }

  if (error) {
    return (
      <ModuleCard title="File Operation Heatmap" description="Most edited files in your project" icon={FolderOpen}>
        <div className="text-center py-8 text-muted-foreground text-sm">
          <AlertTriangle size={16} className="mx-auto mb-2" />
          {error}
        </div>
      </ModuleCard>
    );
  }

  if (files.length === 0) {
    return (
      <ModuleCard title="File Operation Heatmap" description="Most edited files in your project" icon={FolderOpen}>
        <div className="text-center py-8 text-muted-foreground text-sm">
          No file operations recorded yet
        </div>
      </ModuleCard>
    );
  }

  const maxCount = Math.max(...directories.map(d => d.count), 1);
  const maxFileOps = Math.max(...files.map(f => f.total), 1);

  return (
    <ModuleCard title="File Operation Heatmap" description="Most edited files in your project" icon={FolderOpen} className="h-[30rem] flex flex-col">
      <div className="flex-1 min-h-[0] overflow-y-auto pr-1 space-y-4 scrollbar-thin">
        {/* View toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setView('files')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${view === 'files'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
          >
            Top Files
          </button>
          <button
            onClick={() => setView('heatmap')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${view === 'heatmap'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
          >
            Directory Heatmap
          </button>
        </div>

        {view === 'files' ? (
          <div className="space-y-2">
            {files.slice(0, 15).map((file, idx) => (
              <div
                key={file.filePath}
                className="p-2 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  {getFileIcon(file.fileName)}
                  <span className="text-sm font-medium truncate flex-1" title={file.filePath}>
                    {file.fileName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {file.total} ops
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1" title="Read operations">
                    <Eye size={10} />
                    <span>{file.read}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Edit operations">
                    <Edit3 size={10} />
                    <span>{file.edit}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Write operations">
                    <Pencil size={10} />
                    <span>{file.write}</span>
                  </div>
                </div>

                {/* Mini bar */}
                <div className="mt-2 h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-400" style={{ width: `${(file.read / file.total) * 100}%` }} />
                  <div className="h-full bg-amber-400" style={{ width: `${(file.edit / file.total) * 100}%` }} />
                  <div className="h-full bg-emerald-400" style={{ width: `${(file.write / file.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Directories with most file operations
            </p>
            <div className="grid grid-cols-2 gap-2">
              {directories.slice(0, 10).map((dir) => (
                <div
                  key={dir.directory}
                  className={`p-2 rounded-lg ${getHeatmapColor(dir.count, maxCount)} text-white`}
                >
                  <div className="text-xs font-medium truncate" title={dir.directory}>
                    {dir.directory.split('/').pop() || dir.directory}
                  </div>
                  <div className="text-lg font-bold">{dir.count}</div>
                  <div className="text-[10px] opacity-80 truncate" title={dir.directory}>
                    {dir.directory}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModuleCard>
  );
}
