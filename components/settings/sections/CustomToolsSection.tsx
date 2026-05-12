import React, { useState } from 'react';
import { Wrench, Trash2, Plus } from 'lucide-react';

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface CustomToolsSectionProps {
  customTools: CustomTool[];
  setCustomTools: React.Dispatch<React.SetStateAction<CustomTool[]>>;
}

export function CustomToolsSection({ customTools, setCustomTools }: CustomToolsSectionProps) {
  const [showAddTool, setShowAddTool] = useState(false);
  const [newTool, setNewTool] = useState<Partial<CustomTool>>({ name: '', description: '', enabled: true });

  return (
    <div className="space-y-4 pt-4 border-t">
      <h3 className="text-sm font-semibold">Custom Tools</h3>

      {customTools.length > 0 && (
        <div className="space-y-2">
          {customTools.map(tool => (
            <div key={tool.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{tool.name}</div>
                  <div className="text-xs text-muted-foreground">{tool.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={tool.enabled}
                  onChange={async (e) => {
                    const updated = customTools.map(t =>
                      t.id === tool.id ? { ...t, enabled: e.target.checked } : t
                    );
                    setCustomTools(updated);
                    await fetch('/api/custom-tools', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...tool, enabled: e.target.checked }),
                    });
                  }}
                  className="h-4 w-4"
                />
                <button
                  onClick={async () => {
                    await fetch(`/api/custom-tools?id=${tool.id}`, { method: 'DELETE' });
                    setCustomTools(customTools.filter(t => t.id !== tool.id));
                  }}
                  className="p-1 hover:bg-destructive/20 rounded text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddTool ? (
        <div className="space-y-2 p-3 border rounded-md">
          <input
            type="text"
            placeholder="Tool name"
            value={newTool.name || ''}
            onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="Description"
            value={newTool.description || ''}
            onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!newTool.name) return;
                const tool: CustomTool = {
                  id: `custom-${Date.now()}`,
                  name: newTool.name,
                  description: newTool.description || '',
                  enabled: true,
                };
                await fetch('/api/custom-tools', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(tool),
                });
                setCustomTools([...customTools, tool]);
                setNewTool({ name: '', description: '', enabled: true });
                setShowAddTool(false);
              }}
              className="flex-1 px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddTool(false);
                setNewTool({ name: '', description: '', enabled: true });
              }}
              className="flex-1 px-3 py-1 border rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddTool(true)}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Plus className="w-4 h-4" />
          Add Custom Tool
        </button>
      )}
    </div>
  );
}
