import React, { useState } from 'react';
import { ChevronDown, Code2, Zap, ChevronRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  currentModel: string;
  onModelChange: (model: string) => void;
}

export function Header({ currentModel, onModelChange }: HeaderProps) {
  const [menuLevel, setMenuLevel] = useState<'main' | 'manual'>('main');
  const [customModelInput, setCustomModelInput] = useState('');

  // Reset menu level when closing dropdown (we can't easily detect close with CSS hover, 
  // so we'll just let it persist or reset on selection)
  
  const autoModels = [
    { id: 'auto-gemini-3', name: 'Auto (Gemini 3)', description: 'Let Gemini CLI decide (gemini-3-pro/flash)', icon: Zap },
    { id: 'auto-gemini-2.5', name: 'Auto (Gemini 2.5)', description: 'Let Gemini CLI decide (gemini-2.5-pro/flash)', icon: Zap },
  ];

  const manualModels = [
    { id: 'gemini-3-pro-preview', name: 'gemini-3-pro-preview', icon: Code2 },
    { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview', icon: Zap },
    { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro', icon: Code2 },
    { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', icon: Zap },
    { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite', icon: Zap },
  ];

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customModelInput.trim()) {
      onModelChange(customModelInput.trim());
      setCustomModelInput('');
    }
  };

  const handleModelSelect = (id: string) => {
    onModelChange(id);
    setMenuLevel('main'); // Reset to main menu
  };

  const getModelName = (id: string) => {
    const auto = autoModels.find(m => m.id === id);
    if (auto) return auto.name;
    const manual = manualModels.find(m => m.id === id);
    if (manual) return manual.name;
    return id;
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 z-20 relative">
      <div className="flex items-center gap-4">
        {/* Model Selector */}
        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent text-sm font-medium transition-colors border border-transparent hover:border-border">
            <span className="text-muted-foreground">Model:</span>
            <span className="text-foreground max-w-[200px] truncate">{getModelName(currentModel)}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 w-72 bg-popover border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
            <div className="p-1 flex flex-col gap-1 max-h-[400px] overflow-y-auto">
              
              {menuLevel === 'main' ? (
                <>
                  {/* Auto Options */}
                  {autoModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm flex items-start gap-3 hover:bg-accent transition-colors",
                        currentModel === model.id ? 'bg-accent/50 text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <model.icon className={cn("w-4 h-4 mt-0.5", currentModel === model.id ? 'text-primary' : 'text-muted-foreground')} />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-[10px] opacity-70 leading-tight">{model.description}</span>
                      </div>
                      {currentModel === model.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />}
                    </button>
                  ))}

                  {/* Manual Option */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuLevel('manual');
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                        <div className="w-1 h-1 rounded-full bg-current opacity-50 mx-0.5" />
                        <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                      </div>
                      <span className="font-medium">Manual</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                </>
              ) : (
                <>
                  {/* Back Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuLevel('main');
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-xs flex items-center gap-2 hover:bg-accent transition-colors text-muted-foreground mb-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back</span>
                  </button>

                  <div className="h-px bg-border my-1" />

                  {/* Manual Models */}
                  {manualModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 hover:bg-accent transition-colors",
                        currentModel === model.id ? 'bg-accent/50 text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <model.icon className={cn("w-4 h-4", currentModel === model.id ? 'text-primary' : 'text-muted-foreground')} />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{model.name}</span>
                      </div>
                      {currentModel === model.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                  ))}
                  
                  <div className="h-px bg-border my-1" />
            
                  <form onSubmit={handleCustomSubmit} className="p-2">
                    <input
                      type="text"
                      placeholder="Custom model ID..."
                      className="w-full bg-muted/50 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      value={customModelInput}
                      onChange={e => setCustomModelInput(e.target.value)}
                    />
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modes / Right Actions */}
      <div className="flex items-center bg-muted/50 p-1 rounded-lg">
        <button className="px-3 py-1 rounded-md bg-background shadow-sm text-xs font-medium text-foreground">
          Code
        </button>
        <button className="px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          Plan
        </button>
        <button className="px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          Ask
        </button>
      </div>
    </header>
  );
}
