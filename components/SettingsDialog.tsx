import React, { useEffect, useState } from 'react';
import { X, Settings, Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatSettings {
  model: string;
  systemInstruction: string;
  toolPermissionStrategy: 'safe' | 'auto';
  ui: {
    footer: {
      hideModelInfo: boolean;
      hideContextPercentage: boolean;
    };
    showMemoryUsage: boolean;
  };
  modelSettings: {
    compressionThreshold: number;
    maxSessionTurns: number;
    tokenBudget: number;
  };
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
}

const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'gemini-3-pro-preview' },
  { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview' },
  { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro' },
  { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash' },
  { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite' },
];

export function SettingsDialog({ open, onClose, settings, onSave }: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);

  useEffect(() => {
    // Merge provided settings with defaults to ensure all fields exist
    setLocalSettings({
      ...settings,
      toolPermissionStrategy: settings.toolPermissionStrategy ?? 'safe',
      ui: {
        footer: {
          hideModelInfo: settings.ui?.footer?.hideModelInfo ?? false,
          hideContextPercentage: settings.ui?.footer?.hideContextPercentage ?? false,
        },
        showMemoryUsage: settings.ui?.showMemoryUsage ?? true,
      },
      modelSettings: {
        compressionThreshold: settings.modelSettings?.compressionThreshold ?? 0.5,
        maxSessionTurns: settings.modelSettings?.maxSessionTurns ?? -1,
        tokenBudget: settings.modelSettings?.tokenBudget ?? 2000,
      }
    });
  }, [settings, open]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings({
        model: 'gemini-3-pro-preview',
        systemInstruction: '',
        toolPermissionStrategy: 'safe',
        ui: {
          footer: {
            hideModelInfo: false,
            hideContextPercentage: false,
          },
          showMemoryUsage: true,
        },
        modelSettings: {
          compressionThreshold: 0.5,
          maxSessionTurns: -1,
          tokenBudget: 2000,
        }
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2 font-medium text-lg">
            <Settings className="w-5 h-5 text-primary" />
            Settings
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5 opacity-70" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Model</label>
            <select
              value={localSettings.model}
              onChange={(e) => setLocalSettings(s => ({ ...s, model: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <p className="text-[13px] text-muted-foreground">Select the AI model to use.</p>
          </div>

          {/* System Instruction */}
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">System Instruction</label>
            <textarea 
              value={localSettings.systemInstruction}
              onChange={(e) => setLocalSettings(s => ({ ...s, systemInstruction: e.target.value }))}
              placeholder="e.g. You are a helpful coding assistant..."
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>

          {/* Tool Permissions */}
          <div className="space-y-2 pt-4 border-t">
            <label className="text-sm font-medium leading-none">Tool Permission Strategy</label>
            <select
              value={localSettings.toolPermissionStrategy}
              onChange={(e) => setLocalSettings(s => ({
                ...s,
                toolPermissionStrategy: e.target.value as 'safe' | 'auto'
              }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="safe">Safe (Approve / Deny / Allow Session)</option>
              <option value="auto">Auto (Always Allow)</option>
            </select>
            <p className="text-[13px] text-muted-foreground">
              Safe mode prompts for each privileged tool call. Auto mode sends tool calls without confirmation.
            </p>
          </div>

          {/* UI Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">UI Settings</h3>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Hide Model Info (Footer)</label>
              <input 
                type="checkbox"
                checked={localSettings.ui.footer.hideModelInfo}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  ui: { ...s.ui, footer: { ...s.ui.footer, hideModelInfo: e.target.checked } }
                }))}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Hide Context Percentage</label>
              <input 
                type="checkbox"
                checked={localSettings.ui.footer.hideContextPercentage}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  ui: { ...s.ui, footer: { ...s.ui.footer, hideContextPercentage: e.target.checked } }
                }))}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Show Memory Usage</label>
              <input 
                type="checkbox"
                checked={localSettings.ui.showMemoryUsage}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  ui: { ...s.ui, showMemoryUsage: e.target.checked } }
                ))}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>
          </div>

          {/* Model Configuration */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Model Configuration</h3>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Compression Threshold</label>
                <span className="text-sm text-muted-foreground">{localSettings.modelSettings.compressionThreshold}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.1"
                value={localSettings.modelSettings.compressionThreshold}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  modelSettings: { ...s.modelSettings, compressionThreshold: parseFloat(e.target.value) }
                }))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Session Turns (-1 for infinite)</label>
              <input 
                type="number"
                value={localSettings.modelSettings.maxSessionTurns}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  modelSettings: { ...s.modelSettings, maxSessionTurns: parseInt(e.target.value) }
                }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Shell Token Budget</label>
              <input 
                type="number"
                value={localSettings.modelSettings.tokenBudget}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  modelSettings: { ...s.modelSettings, tokenBudget: parseInt(e.target.value) }
                }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
