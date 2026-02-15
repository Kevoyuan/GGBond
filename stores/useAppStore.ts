import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Agent {
  name: string;
  displayName?: string;
  description: string;
  kind: 'local' | 'remote';
  experimental?: boolean;
}

interface AppState {
  // Agents data with timestamp for cache validation
  agents: Agent[];
  agentsFetchedAt: number | null;

  // Set agents data
  setAgents: (agents: Agent[]) => void;

  // Check if agents cache is valid (less than 5 minutes old)
  isAgentsCacheValid: () => boolean;

  // Get cached agents (returns null if expired)
  getAgents: () => Agent[] | null;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      agents: [],
      agentsFetchedAt: null,

      setAgents: (agents) => set({
        agents,
        agentsFetchedAt: Date.now()
      }),

      isAgentsCacheValid: () => {
        const { agentsFetchedAt } = get();
        if (!agentsFetchedAt) return false;
        return Date.now() - agentsFetchedAt < CACHE_DURATION;
      },

      getAgents: () => {
        const { agents, agentsFetchedAt } = get();
        if (!agentsFetchedAt || Date.now() - agentsFetchedAt >= CACHE_DURATION) {
          return null;
        }
        return agents;
      }
    }),
    {
      name: 'ggbond-app-store'
    }
  )
);
