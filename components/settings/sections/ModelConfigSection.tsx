import React from 'react';
import { ChatSettings } from '../SettingsDialog';

interface ModelConfigSectionProps {
  localSettings: ChatSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<ChatSettings>>;
}

export function ModelConfigSection({ localSettings, setLocalSettings }: ModelConfigSectionProps) {
  return (
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
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
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
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Max Retries</label>
        <input
          type="number"
          value={localSettings.modelSettings.maxRetries}
          onChange={(e) => setLocalSettings(s => ({
            ...s,
            modelSettings: { ...s.modelSettings, maxRetries: parseInt(e.target.value) }
          }))}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Applies to normal models. Preview models retry less aggressively to keep the app responsive.
        </p>
      </div>
    </div>
  );
}
