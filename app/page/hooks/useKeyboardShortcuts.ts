'use client';

import { useEffect } from 'react';
import type { SidebarView } from '@/lib/stores/ui-store';

interface UseKeyboardShortcutsProps {
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  showTerminal: boolean;
  setShowTerminal: (show: boolean) => void;
  handleNewChat: () => void;
  setSettingsOpen: (open: boolean) => void;
  setSidebarView: (view: SidebarView) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
}

export function useKeyboardShortcuts({
  commandPaletteOpen,
  setCommandPaletteOpen,
  showTerminal,
  setShowTerminal,
  handleNewChat,
  setSettingsOpen,
  setSidebarView,
  isSidebarCollapsed,
  setIsSidebarCollapsed
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K for Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      // Cmd+J or Ctrl+J for Terminal
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setShowTerminal(!showTerminal);
      }
      // Cmd+N or Ctrl+N for New Chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleNewChat();
      }
      // Cmd+, or Ctrl+, for Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
      // Cmd+1-7 for sidebar navigation
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '7') {
        const views = ['chat', 'agents', 'skills', 'hooks', 'mcp', 'quota', 'memory'] as const;
        const idx = parseInt(e.key, 10) - 1;
        if (idx < views.length) {
          e.preventDefault();
          setSidebarView(views[idx] as SidebarView);
          if (isSidebarCollapsed) setIsSidebarCollapsed(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    commandPaletteOpen,
    setCommandPaletteOpen,
    showTerminal,
    setShowTerminal,
    handleNewChat,
    setSettingsOpen,
    setSidebarView,
    isSidebarCollapsed,
    setIsSidebarCollapsed
  ]);
}
