import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export type SidePanelType = 'graph' | 'timeline' | 'artifact' | 'tasks' | 'plan' | 'terminal' | 'files' | 'modules' | 'usage' | null;
export type SidebarView = 'chat' | 'files' | 'skills' | 'hooks' | 'mcp' | 'agents' | 'quota' | 'memory' | null;
export type AppMode = 'code' | 'plan' | 'ask';
export type ApprovalMode = 'safe' | 'auto';
export const DEFAULT_APPROVAL_MODE: ApprovalMode = 'safe';

// ============================================================================
// Store Interface
// ============================================================================

interface UIState {
  // Dialog visibility
  settingsOpen: boolean;
  commandPaletteOpen: boolean;
  showAddWorkspace: boolean;

  // App mode
  mode: AppMode;
  approvalMode: ApprovalMode;

  // Sidebar state
  sidePanelType: SidePanelType;
  sidePanelWidth: number;
  isSidebarCollapsed: boolean;
  sidebarView: SidebarView;

  // Terminal state
  showTerminal: boolean;
  terminalPanelHeight: number;

  // Preview / artifact state
  previewFile: { name: string; path: string } | null;
  artifactPath: string | null;
  inputAreaHeight: number;

  // Streaming status (ephemeral)
  streamingStatus: string | undefined;

  // Actions — Dialogs
  setSettingsOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setShowAddWorkspace: (open: boolean) => void;

  // Actions — Mode
  setMode: (mode: AppMode) => void;
  setApprovalMode: (mode: ApprovalMode) => void;

  // Actions — Sidebar
  setSidePanelType: (type: SidePanelType) => void;
  setSidePanelWidth: (width: number) => void;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarView: (view: SidebarView) => void;

  // Actions — Terminal
  setShowTerminal: (show: boolean) => void;
  setTerminalPanelHeight: (height: number) => void;

  // Actions — Preview / Artifact
  setPreviewFile: (file: { name: string; path: string } | null) => void;
  setArtifactPath: (path: string | null) => void;
  setInputAreaHeight: (height: number) => void;

  // Actions — Streaming
  setStreamingStatus: (status: string | undefined) => void;

  // Bulk setters for convenience
  openArtifact: (path: string) => void;
  closeArtifact: () => void;
  toggleTerminal: () => void;
  toggleSidebarCollapse: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

const DEFAULT_TERMINAL_PANEL_HEIGHT = 360;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state — Dialogs
      settingsOpen: false,
      commandPaletteOpen: false,
      showAddWorkspace: false,

      // Initial state — Mode
      mode: 'code',
      approvalMode: DEFAULT_APPROVAL_MODE,

      // Initial state — Sidebar
      sidePanelType: null,
      sidePanelWidth: 400,
      isSidebarCollapsed: false,
      sidebarView: null,

      // Initial state — Terminal
      showTerminal: false,
      terminalPanelHeight: DEFAULT_TERMINAL_PANEL_HEIGHT,

      // Initial state — Preview
      previewFile: null,
      artifactPath: null,
      inputAreaHeight: 120,

      // Initial state — Streaming
      streamingStatus: undefined,

      // Actions — Dialogs
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setShowAddWorkspace: (open) => set({ showAddWorkspace: open }),

      // Actions — Mode
      setMode: (mode) => set({ mode }),
      setApprovalMode: (mode) => set({ approvalMode: mode }),

      // Actions — Sidebar
      setSidePanelType: (type) => set({ sidePanelType: type }),
      setSidePanelWidth: (width) => set({ sidePanelWidth: width }),
      setIsSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      setSidebarView: (view) => set({ sidebarView: view }),

      // Actions — Terminal
      setShowTerminal: (show) => set({ showTerminal: show }),
      setTerminalPanelHeight: (height) => set({ terminalPanelHeight: height }),

      // Actions — Preview / Artifact
      setPreviewFile: (file) => set({ previewFile: file }),
      setArtifactPath: (path) => set({ artifactPath: path }),
      setInputAreaHeight: (height) => set({ inputAreaHeight: height }),

      // Actions — Streaming
      setStreamingStatus: (status) => set({ streamingStatus: status }),

      // Bulk actions
      openArtifact: (path) => set({ artifactPath: path, sidePanelType: 'artifact' }),
      closeArtifact: () => set({ artifactPath: null, sidePanelType: null }),
      toggleTerminal: () => set((state) => ({ showTerminal: !state.showTerminal })),
      toggleSidebarCollapse: () => set((state) => {
        const next = !state.isSidebarCollapsed;
        if (next) {
          // When collapsing, close the side panel too
          return { isSidebarCollapsed: next, sidePanelType: null };
        }
        return { isSidebarCollapsed: next };
      }),
    }),
    {
      name: 'ggbond-ui-store',
      // Only persist these keys — streaming and ephemeral state excluded
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        sidePanelWidth: state.sidePanelWidth,
        terminalPanelHeight: state.terminalPanelHeight,
        inputAreaHeight: state.inputAreaHeight,
        mode: state.mode,
        approvalMode: state.approvalMode,
      }),
    }
  )
);
