import React from 'react';
import { cn } from '@/lib/utils';
import { Folder, AtSign, Sparkles, User } from 'lucide-react';
import { 
  CommandItem, 
  MentionItem, 
  SkillSuggestionItem, 
  AgentItem, 
  SKILL_COMMAND_PREFIX 
} from './ChatInput';

interface CommandSuggestionsProps {
  activeTrigger: '/' | '@' | '#' | 'skill' | null;
  filteredCommands: CommandItem[];
  filteredMentions: MentionItem[];
  filteredSkills: SkillSuggestionItem[];
  filteredAgents: AgentItem[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  handleCommandSelect: (cmd: string) => void;
  handleMentionSelect: (path: string) => void;
  handleSkillSelect: (id: string) => void;
  handleAgentSelect: (name: string) => void;
  commandListRef: React.RefObject<HTMLDivElement | null>;
}

export function CommandSuggestions({
  activeTrigger,
  filteredCommands,
  filteredMentions,
  filteredSkills,
  filteredAgents,
  selectedIndex,
  setSelectedIndex,
  handleCommandSelect,
  handleMentionSelect,
  handleSkillSelect,
  handleAgentSelect,
  commandListRef
}: CommandSuggestionsProps) {
  if (!activeTrigger) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-card border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50">
      <div className="max-h-64 overflow-y-auto p-1" ref={commandListRef}>
        {activeTrigger === '/' && filteredCommands.map((cmd, index) => {
          const showHeader = index === 0 || cmd.group !== filteredCommands[index - 1].group;
          return (
            <React.Fragment key={cmd.command}>
              {showHeader && (
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30 border-y first:border-t-0 border-border sticky top-0 z-10 backdrop-blur-sm">
                  {cmd.group || 'Commands'}
                </div>
              )}
              <button
                data-index={index}
                onClick={() => handleCommandSelect(cmd.command)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm">
                  <cmd.icon className="w-3 h-3" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium">{cmd.command.startsWith(SKILL_COMMAND_PREFIX) ? cmd.command.slice(SKILL_COMMAND_PREFIX.length) : cmd.command}</span>
                  <span className="text-[10px] opacity-70 truncate">{cmd.description}</span>
                </div>
              </button>
            </React.Fragment>
          );
        })}
        {activeTrigger === '@' && filteredMentions.map((mention, index) => (
          <button
            key={mention.path}
            data-index={index}
            onClick={() => handleMentionSelect(mention.path)}
            className={cn(
              "w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm">
              {mention.type === 'directory' ? (
                <Folder className="w-3 h-3" />
              ) : (
                <AtSign className="w-3 h-3" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{mention.displayPath}</span>
              <span className="text-[10px] opacity-70">{mention.type}</span>
            </div>
          </button>
        ))}
        {activeTrigger === 'skill' && filteredSkills.map((skill, index) => (
          <button
            key={skill.id}
            data-index={index}
            onClick={() => handleSkillSelect(skill.id)}
            className={cn(
              "w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm">
              <Sparkles className="w-3 h-3" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{skill.id}</span>
              <span className="text-[10px] opacity-70 truncate">{skill.description || skill.name}</span>
            </div>
          </button>
        ))}
        {activeTrigger === '#' && filteredAgents.map((agent, index) => (
          <button
            key={agent.name}
            data-index={index}
            onClick={() => handleAgentSelect(agent.name)}
            className={cn(
              "w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm">
              <User className="w-3 h-3" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">#{agent.name}</span>
              <span className="text-[10px] opacity-70 truncate">{agent.displayName || agent.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
