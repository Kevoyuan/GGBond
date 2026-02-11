
import React, { useEffect, useState } from 'react';
import { User, Sparkles, Shield, Cpu, ExternalLink, Play, RefreshCw, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentDefinition {
    name: string;
    displayName?: string;
    description: string;
    kind: 'local' | 'remote';
    experimental?: boolean;
}

interface AgentPanelProps {
    onSelectAgent: (agent: AgentDefinition) => void;
    selectedAgentName?: string;
    className?: string;
}

export function AgentPanel({ onSelectAgent, selectedAgentName, className }: AgentPanelProps) {
    const [agents, setAgents] = useState<AgentDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAgents = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/agents');
            if (res.ok) {
                const data = await res.json();
                setAgents(data.agents || []);
                setError(null);
            } else {
                setError('Failed to fetch agents');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    return (
        <div className={cn("flex flex-col h-full bg-card", className)}>
            <div className="p-4 border-b flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-sm">Agent Discovery</h2>
                </div>
                <button
                    onClick={fetchAgents}
                    className="p-1.5 hover:bg-accent rounded-md transition-colors"
                    title="Refresh Agents"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {loading && agents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 space-y-2 opacity-50">
                        <Sparkles className="w-8 h-8 animate-pulse text-primary" />
                        <p className="text-xs">Discovering agents...</p>
                    </div>
                ) : error ? (
                    <div className="p-4 text-center space-y-2">
                        <p className="text-xs text-destructive">{error}</p>
                        <button
                            onClick={fetchAgents}
                            className="text-xs text-primary hover:underline"
                        >
                            Try Again
                        </button>
                    </div>
                ) : agents.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground opacity-50">
                        <User className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-sm italic">No agents found</p>
                    </div>
                ) : (
                    agents.map((agent) => (
                        <div
                            key={agent.name}
                            className={cn(
                                "group p-3 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden",
                                selectedAgentName === agent.name
                                    ? "bg-primary/5 border-primary ring-1 ring-primary/20"
                                    : "bg-card hover:bg-accent/50 border-border hover:border-border/80"
                            )}
                            onClick={() => onSelectAgent(agent)}
                        >
                            <div className="flex items-start gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                                    agent.kind === 'remote' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                )}>
                                    {agent.kind === 'remote' ? (
                                        <ExternalLink className="w-5 h-5" />
                                    ) : agent.experimental ? (
                                        <Shield className="w-5 h-5" />
                                    ) : (
                                        <Cpu className="w-5 h-5" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium text-sm truncate mr-1">
                                            {agent.displayName || agent.name}
                                        </h3>
                                        {agent.experimental && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-full font-bold uppercase tracking-tighter">
                                                Exp
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                                        {agent.description}
                                    </p>
                                </div>
                            </div>

                            <div className={cn(
                                "absolute bottom-2 right-2 flex items-center gap-1.5 transition-all duration-200",
                                selectedAgentName === agent.name ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
                            )}>
                                <span className="text-[10px] font-medium text-primary uppercase tracking-widest mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Activate
                                </span>
                                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                                    <Play className="w-3 h-3 fill-current ml-0.5" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t bg-muted/30 text-[10px] text-muted-foreground text-center leading-relaxed">
                Specialized agents can perform complex tasks beyond general chat by using pre-configured toolsets and instructions.
            </div>
        </div>
    );
}
