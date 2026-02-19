import React, { useEffect, useState } from 'react';
import { X, Settings, Save, RotateCcw, Shield, Zap, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/Select';

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

const FALLBACK_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'gemini-3-pro-preview', icon: Code2 },
  { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview', icon: Zap },
  { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro', icon: Code2 },
  { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', icon: Zap },
  { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite', icon: Zap },
];

export function SettingsDialog({ open, onClose, settings, onSave }: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);
  const [models, setModels] = useState<typeof FALLBACK_MODELS>(FALLBACK_MODELS);
  const [defaultModel, setDefaultModel] = useState('gemini-2.5-pro');

  // Fetch models from API
  useEffect(() => {
    if (!open) return;
    fetch('/api/models')
      .then(r => r.json())
      .then(data => {
        const modelList = (data.known || []).map((m: { id: string; name?: string; tier?: string }) => ({
          id: m.id,
          name: m.name || m.id,
          icon: m.tier === 'pro' ? Code2 : Zap,
        }));
        if (modelList.length > 0) {
          setModels(modelList);
          setDefaultModel(data.current || modelList[0].id);
        }
      })
      .catch(() => {});
  }, [open]);

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
        model: defaultModel,
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
          <Select
            label="Model"
            value={localSettings.model}
            onChange={(value) => setLocalSettings(s => ({ ...s, model: value }))}
            options={models}
            description="Select the AI model to use."
          />

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
          <Select
            label="Tool Permission Strategy"
            value={localSettings.toolPermissionStrategy}
            onChange={(value) => setLocalSettings(s => ({
              ...s,
              toolPermissionStrategy: value as 'safe' | 'auto'
            }))}
            options={[
              { id: 'safe', name: 'Safe', description: 'Approve / Deny / Allow Session', icon: Shield },
              { id: 'auto', name: 'Auto', description: 'Always Allow', icon: Zap },
            ]}
            description="Safe mode prompts for each privileged tool call. Auto mode sends tool calls without confirmation."
          />

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
                <label className="text-sm font-medium">Compression Threshold <span className="text-muted-foreground font-normal">(default: 50%)</span></label>
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
