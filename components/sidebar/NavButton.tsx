import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';

interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ElementType;
    label: string;
}

export function NavButton({ active, onClick, icon: Icon, label }: NavButtonProps) {
    return (
        <Tooltip content={label} side="right" sideOffset={18}>
            <div
                onClick={onClick}
                className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 relative group cursor-pointer border",
                    active
                        ? "bg-primary text-primary-foreground shadow-md border-primary/20"
                        : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
            >
                <Icon className="w-5 h-5" />
            </div>
        </Tooltip>
    );
}
