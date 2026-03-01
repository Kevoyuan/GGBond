import { useCallback, useEffect, useState } from 'react';

interface FileDiffStat {
    file: string;
    added: number;
    removed: number;
    isUntracked?: boolean;
}

interface BranchResponse {
    branch?: string | null;
    branches?: string[];
    uncommitted?: {
        added: number;
        removed: number;
        untracked: number;
        hasChanges: boolean;
        files: FileDiffStat[];
    } | null;
    error?: string;
}

interface SwitchBranchResult {
    ok: boolean;
    branch?: string;
    error?: string;
}

export function useWorkspaceBranch(workspacePath: string | null) {
    const [currentBranch, setCurrentBranch] = useState<string | null>(null);
    const [branches, setBranches] = useState<string[]>([]);
    const [uncommitted, setUncommitted] = useState<BranchResponse['uncommitted']>(null);
    const [loading, setLoading] = useState(false);
    const [switchingTo, setSwitchingTo] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const queryPath = (!workspacePath || workspacePath === 'Default') ? '' : `&path=${encodeURIComponent(workspacePath)}`;
            const res = await fetch(`/api/git/branch?list=1${queryPath}`);
            if (!res.ok) {
                setCurrentBranch(null);
                setBranches([]);
                return;
            }

            const data = await res.json() as BranchResponse;
            setCurrentBranch(data.branch || null);
            setBranches(Array.isArray(data.branches) ? data.branches : []);
            setUncommitted(data.uncommitted ?? null);
        } catch {
            setCurrentBranch(null);
            setBranches([]);
            setUncommitted(null);
        } finally {
            setLoading(false);
        }
    }, [workspacePath]);

    const switchBranch = useCallback(async (branch: string): Promise<SwitchBranchResult> => {
        const trimmedBranch = branch.trim();
        if (!trimmedBranch) {
            return { ok: false, error: 'Branch is required' };
        }
        if (trimmedBranch === currentBranch) {
            return { ok: true, branch: trimmedBranch };
        }

        setSwitchingTo(trimmedBranch);
        try {
            const res = await fetch('/api/git/branch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: (!workspacePath || workspacePath === 'Default') ? '' : workspacePath,
                    branch: trimmedBranch,
                }),
            });

            const data = await res.json().catch(() => ({} as BranchResponse));
            if (!res.ok) {
                return {
                    ok: false,
                    error: typeof data?.error === 'string' ? data.error : 'Failed to switch branch',
                };
            }

            const nextBranch = data.branch || trimmedBranch;
            setCurrentBranch(nextBranch);
            if (Array.isArray(data.branches)) {
                setBranches(data.branches);
            } else {
                setBranches((prev) => (prev.includes(nextBranch) ? prev : [nextBranch, ...prev]));
            }
            setUncommitted(data.uncommitted ?? null);

            return { ok: true, branch: nextBranch };
        } catch {
            return { ok: false, error: 'Failed to switch branch' };
        } finally {
            setSwitchingTo(null);
        }
    }, [workspacePath, currentBranch]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        currentBranch,
        branches,
        uncommitted,
        loading,
        switchingTo,
        refresh,
        switchBranch,
    };
}
