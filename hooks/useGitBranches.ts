import { useState, useEffect } from 'react';

/**
 * Hook to fetch git branch information for workspaces.
 */
export function useGitBranches(workspaces: string[]) {
    const [branches, setBranches] = useState<Record<string, string | null>>({});

    useEffect(() => {
        const fetchBranches = async () => {
            const results: Record<string, string | null> = {};
            // Filter out empty, null, undefined, or "Default"
            const validWorkspaces = workspaces.filter(w => w && w !== 'Default' && w.trim() !== '');

            if (validWorkspaces.length === 0) {
                setBranches({});
                return;
            }

            await Promise.all(
                validWorkspaces.map(async (workspace) => {
                    try {
                        const res = await fetch(`/api/git/branch?path=${encodeURIComponent(workspace)}`);
                        if (res.ok) {
                            const data = await res.json();
                            results[workspace] = data.branch || null;
                        } else {
                            results[workspace] = null;
                        }
                    } catch (error) {
                        console.error(`Failed to fetch branch for ${workspace}:`, error);
                        results[workspace] = null;
                    }
                })
            );
            setBranches(results);
        };

        fetchBranches();
    }, [workspaces.join(',')]);

    return branches;
}
