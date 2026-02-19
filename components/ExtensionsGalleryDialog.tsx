'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
    X,
    Loader2,
    Search,
    Download,
    Tag,
    Sparkles,
    AlertCircle,
    ExternalLink,
    Copy,
    Check,
    User,
    Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GalleryExtension {
    id: string;
    name: string;
    description: string;
    installCommand: string;
    category?: string;
    author?: string;
    githubUrl?: string;
}

interface ExtensionsGalleryDialogProps {
    open: boolean;
    onClose: () => void;
    onInstalled?: () => void;
}

export function ExtensionsGalleryDialog({ open, onClose, onInstalled }: ExtensionsGalleryDialogProps) {
    const [galleryExtensions, setGalleryExtensions] = useState<GalleryExtension[]>([]);
    const [galleryCategories, setGalleryCategories] = useState<string[]>([]);
    const [isLoadingGallery, setIsLoadingGallery] = useState(false);
    const [galleryError, setGalleryError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [installingExtension, setInstallingExtension] = useState<string | null>(null);
    const [selectedExtension, setSelectedExtension] = useState<GalleryExtension | null>(null);
    const [copiedCommand, setCopiedCommand] = useState(false);

    // Load gallery when dialog opens
    useEffect(() => {
        if (open) {
            loadGallery();
        }
    }, [open]);

    // Reset state when closing
    useEffect(() => {
        if (!open) {
            setSearchQuery('');
            setSelectedCategory(null);
            setGalleryError(null);
            setSelectedExtension(null);
            setCopiedCommand(false);
        }
    }, [open]);

    const loadGallery = async () => {
        setIsLoadingGallery(true);
        setGalleryError(null);
        try {
            const res = await fetch('/api/mcp/gallery');
            if (!res.ok) {
                throw new Error('Failed to load extensions gallery');
            }
            const data = await res.json() as { extensions: GalleryExtension[]; categories: string[] };
            setGalleryExtensions(data.extensions);
            setGalleryCategories(data.categories);
        } catch (err) {
            setGalleryError(err instanceof Error ? err.message : 'Failed to load gallery');
        } finally {
            setIsLoadingGallery(false);
        }
    };

    const handleInstallExtension = async (extension: GalleryExtension) => {
        setInstallingExtension(extension.id);
        try {
            // Extract repo URL from install command
            const urlMatch = extension.installCommand.match(/https:\/\/[^\s]+/);
            if (!urlMatch) {
                throw new Error('Invalid install command');
            }
            const repoUrl = urlMatch[0];

            // Call API to install extension
            const res = await fetch('/api/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'installExtension',
                    name: extension.name,
                    repoUrl,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to install extension');
            }

            // Notify parent to reload servers
            onInstalled?.();
            onClose();
        } catch (err) {
            setGalleryError(err instanceof Error ? err.message : 'Failed to install extension');
        } finally {
            setInstallingExtension(null);
        }
    };

    const handleCopyInstallCommand = async (command: string) => {
        try {
            await navigator.clipboard.writeText(command);
            setCopiedCommand(true);
            setTimeout(() => setCopiedCommand(false), 2000);
        } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = command;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopiedCommand(true);
            setTimeout(() => setCopiedCommand(false), 2000);
        }
    };

    const handleOpenGitHub = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const filteredExtensions = useMemo(() => {
        let filtered = galleryExtensions;

        if (selectedCategory) {
            filtered = filtered.filter(ext => ext.category === selectedCategory);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                ext =>
                    ext.name.toLowerCase().includes(query) ||
                    ext.description.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [galleryExtensions, searchQuery, selectedCategory]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-background border border-primary/20 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Extensions Gallery</h2>
                            <p className="text-sm text-muted-foreground">Browse and install Gemini CLI extensions</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search and Filter */}
                <div className="p-5 border-b bg-card/50 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search extensions by name or description..."
                            className="w-full pl-12 pr-4 py-3 rounded-lg border border-border/60 bg-background/80 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-colors"
                            autoFocus
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                                selectedCategory === null
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/60 hover:bg-muted text-muted-foreground"
                            )}
                        >
                            All
                        </button>
                        {galleryCategories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={cn(
                                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                                    selectedCategory === category
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/60 hover:bg-muted text-muted-foreground"
                                )}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Extensions List */}
                <div className="flex-1 overflow-auto p-5">
                    {galleryError && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300 mb-4">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{galleryError}</span>
                            </div>
                        </div>
                    )}

                    {isLoadingGallery ? (
                        <div className="flex flex-col items-center justify-center h-64 opacity-60">
                            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
                            <p className="text-sm text-muted-foreground">Loading extensions...</p>
                        </div>
                    ) : filteredExtensions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 opacity-40">
                            <Search className="w-12 h-12 mb-4" />
                            <p className="text-base">No extensions found</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {searchQuery ? 'Try adjusting your search' : 'No extensions available'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredExtensions.map((ext) => (
                                <div
                                    key={ext.id}
                                    className="group p-5 rounded-xl border border-border/50 bg-card/40 hover:bg-card/80 hover:border-primary/30 transition-all duration-200 flex flex-col cursor-pointer"
                                    onClick={() => setSelectedExtension(ext)}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-base font-semibold truncate">{ext.name}</h4>
                                            {ext.category && (
                                                <div className="flex items-center gap-1.5 mt-2">
                                                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                                        {ext.category}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-4 flex-1">
                                        {ext.description}
                                    </p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleInstallExtension(ext);
                                        }}
                                        disabled={installingExtension === ext.id}
                                        className="w-full py-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-bold uppercase tracking-wider transition-colors border border-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {installingExtension === ext.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Installing...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-4 h-4" />
                                                Install
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-card/30 text-center">
                    <p className="text-xs text-muted-foreground">
                        Showing {filteredExtensions.length} of {galleryExtensions.length} extensions
                    </p>
                </div>

                {/* Extension Detail Dialog */}
                {selectedExtension && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div
                            className="bg-background border border-primary/20 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header with gradient */}
                            <div className="relative h-24 bg-gradient-to-br from-primary/20 via-purple-500/20 to-primary/20">
                                <button
                                    onClick={() => setSelectedExtension(null)}
                                    className="absolute top-3 right-3 p-2 rounded-lg bg-black/20 hover:bg-black/30 text-white/80 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="absolute -bottom-8 left-5">
                                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg border-4 border-background">
                                        <Package className="w-8 h-8 text-white" />
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="pt-12 p-6">
                                <h3 className="text-xl font-bold mb-1">{selectedExtension.name}</h3>

                                {/* Author */}
                                {selectedExtension.author && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                        <User className="w-4 h-4" />
                                        <span>{selectedExtension.author}</span>
                                    </div>
                                )}

                                {/* Category */}
                                {selectedExtension.category && (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
                                        <Tag className="w-3.5 h-3.5" />
                                        {selectedExtension.category}
                                    </div>
                                )}

                                {/* Description */}
                                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                                    {selectedExtension.description}
                                </p>

                                {/* Install Command */}
                                <div className="mb-4">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                                        Install Command
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 px-4 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm font-mono text-foreground overflow-x-auto">
                                            {selectedExtension.installCommand}
                                        </code>
                                        <button
                                            onClick={() => handleCopyInstallCommand(selectedExtension.installCommand)}
                                            className="p-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors border border-primary/20 shrink-0"
                                            title="Copy to clipboard"
                                        >
                                            {copiedCommand ? (
                                                <Check className="w-4 h-4" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        onClick={() => handleInstallExtension(selectedExtension)}
                                        disabled={installingExtension === selectedExtension.id}
                                        className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {installingExtension === selectedExtension.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Installing...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-4 h-4" />
                                                Install Extension
                                            </>
                                        )}
                                    </button>
                                    {selectedExtension.githubUrl && (
                                        <button
                                            onClick={() => handleOpenGitHub(selectedExtension.githubUrl!)}
                                            className="p-3 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/50"
                                            title="View on GitHub"
                                        >
                                            <ExternalLink className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
