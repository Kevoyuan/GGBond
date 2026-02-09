import React, { useState, useEffect } from 'react';
import { ModuleCard } from './ModuleCard';
import { MessageSquare, Save, Trash2, Play, Download, Upload } from 'lucide-react';

interface Session {
  id: string;
  title: string;
  created_at: string;
}

export function ChatManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete session', error);
    }
  };

  return (
    <ModuleCard title="Session Management" description="Manage chat checkpoints and history" icon={MessageSquare}>
      <div className="space-y-4">
        <div className="flex gap-2">
           <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
             <Save size={14} /> Save Current
           </button>
           <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700">
             <Upload size={14} /> Import
           </button>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-zinc-500">Loading sessions...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">Title / ID</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]" title={session.title || session.id}>
                      {session.title || session.id}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(session.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400" title="Resume">
                          <Play size={14} />
                        </button>
                        <button className="p-1 text-zinc-500 hover:text-green-600 dark:hover:text-green-400" title="Export">
                          <Download size={14} />
                        </button>
                        <button 
                          className="p-1 text-zinc-500 hover:text-red-600 dark:hover:text-red-400" 
                          title="Delete"
                          onClick={() => handleDelete(session.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                      No sessions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ModuleCard>
  );
}
