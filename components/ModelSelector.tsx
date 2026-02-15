import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Code2, Shield, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MODELS = [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', icon: Code2 },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: Zap },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', icon: Zap },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', icon: Zap },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', icon: Code2 },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', icon: Zap },
];

interface ModelSelectorProps {
    value: string;
    onChange: (value: string) => void;
    variant?: 'inline' | 'form' | 'dropdown';
    showInherit?: boolean;
    className?: string;
}

export function ModelSelector({
    value,
    onChange,
    variant = 'inline',
    showInherit = false,
    className
}: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const allModels = showInherit
        ? [...MODELS, { id: 'inherit', name: 'Inherit from settings', icon: Settings }]
        : MODELS;

    const currentModel = allModels.find(m => m.id === value) || allModels[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (variant === 'form' || variant === 'dropdown') {
        return (
            <div className={cn("relative", className)} ref={menuRef}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "w-full flex items-center justify-between px-4 py-3 text-sm rounded-lg border bg-background hover:border-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20",
                        isOpen && "border-primary/50 ring-2 ring-primary/20"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-5 h-5 rounded bg-muted/50 border shadow-sm">
                            <currentModel.icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="font-medium">{currentModel.name}</span>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 py-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                            {allModels.map((model) => (
                                <button
                                    key={model.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(model.id);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors",
                                        value === model.id
                                            ? "bg-primary/5 text-primary font-semibold"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm",
                                            value === model.id && "border-primary/20 bg-primary/10"
                                        )}>
                                            <model.icon className="w-3.5 h-3.5" />
                                        </div>
                                        <span>{model.name}</span>
                                    </div>
                                    {value === model.id && (
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className={cn("relative", className)} ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors mr-1 cursor-pointer z-20 relative"
            >
                <Zap className="w-3.5 h-3.5" />
                <span>{currentModel.name}</span>
                <ChevronDown className={cn("w-3 h-3 opacity-50 transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-52 bg-background border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50 py-1">
                        {allModels.map(model => (
                            <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                    onChange(model.id);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors",
                                    value === model.id
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                )}
                            >
                                <model.icon className="w-3.5 h-3.5" />
                                <span>{model.name}</span>
                                {value === model.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
