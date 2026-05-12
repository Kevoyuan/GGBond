import React from 'react';
import { ChatSettings } from '../SettingsDialog';

interface UISettingsSectionProps {
  localSettings: ChatSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<ChatSettings>>;
}

export function UISettingsSection({ localSettings, setLocalSettings }: UISettingsSectionProps) {
  return (
    <div className="space-y-4 pt-4 border-t">
      <h3 className="text-sm font-semibold">UI Settings</h3>

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Low Latency Mode</label>
        <input
          type="checkbox"
          checked={localSettings.ui.lowLatencyMode}
          onChange={(e) => setLocalSettings(s => ({
            ...s,
            ui: { ...s.ui, lowLatencyMode: e.target.checked }
          }))}
          className="h-4 w-4 rounded border-gray-300"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Advanced Mode</label>
        <input
          type="checkbox"
          checked={localSettings.ui.advancedMode}
          onChange={(e) => setLocalSettings(s => ({
            ...s,
            ui: { ...s.ui, advancedMode: e.target.checked }
          }))}
          className="h-4 w-4 rounded border-gray-300"
        />
      </div>

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
            ui: { ...s.ui, showMemoryUsage: e.target.checked }
          }))}
          className="h-4 w-4 rounded border-gray-300"
        />
      </div>
    </div>
  );
}
