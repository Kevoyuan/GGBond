import React from 'react';
import { ModuleCard } from './ModuleCard';
import { MessageSquare, Save, Trash2, Play, Download, Upload } from 'lucide-react';

export function ChatManager() {
  const sessions = [
    { id: '1', tag: 'dev-setup', created: '2023-10-01', messages: 12 },
    { id: '2', tag: 'bug-fix-auth', created: '2023-10-02', messages: 45 },
    { id: '3', tag: 'feature-planning', created: '2023-10-03', messages: 8 },
  ];

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

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Tag / ID</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Messages</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{session.tag}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{session.created}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{session.messages}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400" title="Resume">
                        <Play size={14} />
                      </button>
                      <button className="p-1 text-zinc-500 hover:text-green-600 dark:hover:text-green-400" title="Export">
                        <Download size={14} />
                      </button>
                      <button className="p-1 text-zinc-500 hover:text-red-600 dark:hover:text-red-400" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ModuleCard>
  );
}
