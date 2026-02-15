import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PanelHeaderProps {
    /** 标题文本 */
    title: string;
    /** 标题旁的图标 */
    icon?: LucideIcon;
    /** 图标颜色，默认为 text-primary */
    iconColor?: string;
    /** 右侧的操作按钮区域 */
    actions?: React.ReactNode;
    /** 标题旁的徽章内容（如计数） */
    badge?: string | number;
    /** 额外的 CSS 类名 */
    className?: string;
    /** 是否粘性定位，默认为 true */
    sticky?: boolean;
}

/**
 * PanelHeader - 侧边栏面板的统一样式标题栏
 * 设计规范: h-14 (56px), text-xs uppercase bold, backdrop-blur-md
 */
export function PanelHeader({
    title,
    icon: Icon,
    iconColor = 'text-primary',
    actions,
    badge,
    className,
    sticky = true
}: PanelHeaderProps) {
    return (
        <div className={cn(
            "h-14 flex items-center justify-between px-4 border-b bg-card/80 backdrop-blur-md z-20 transition-all",
            sticky && "sticky top-0",
            className
        )}>
            <div className="flex items-center gap-2 overflow-hidden">
                {Icon && (
                    <div className={cn("p-1.5 rounded-lg bg-primary/5", iconColor.replace('text-', 'bg-').replace('primary', 'primary/10'))}>
                        <Icon className={cn("w-3.5 h-3.5 shrink-0 transition-colors", iconColor)} />
                    </div>
                )}
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 truncate select-none">
                        {title}
                    </h2>
                    {badge !== undefined && badge !== null && (
                        <span className="flex items-center justify-center px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold min-w-[1.25rem] border border-primary/20">
                            {badge}
                        </span>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-1 shrink-0">
                    {actions}
                </div>
            )}
        </div>
    );
}
