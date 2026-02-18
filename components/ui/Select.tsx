import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  id: string;
  name: string;
  description?: string;
  icon?: React.ElementType;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  description?: string;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  label,
  description,
  className
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentOption = options.find(o => o.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium leading-none">{label}</label>
      )}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-lg border bg-background hover:border-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20",
            isOpen && "border-primary/50 ring-2 ring-primary/20"
          )}
        >
          <div className="flex items-center gap-3">
            {currentOption?.icon && (
              <div className="flex items-center justify-center w-5 h-5 rounded bg-muted/50 border shadow-sm">
                <currentOption.icon className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <span className={cn(!currentOption && "text-muted-foreground")}>
              {currentOption?.name || placeholder}
            </span>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 py-2 max-h-[300px] overflow-y-auto scrollbar-thin">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors",
                    value === option.id
                      ? "bg-primary/5 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {option.icon && (
                      <div className={cn(
                        "flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm",
                        value === option.id && "border-primary/20 bg-primary/10"
                      )}>
                        <option.icon className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div>
                      <span>{option.name}</span>
                      {option.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                      )}
                    </div>
                  </div>
                  {value === option.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {description && (
        <p className="text-[13px] text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
