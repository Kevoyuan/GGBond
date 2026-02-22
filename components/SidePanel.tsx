'use client';

import { useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '@/components/MessageBubble';
import { ConversationGraph, GraphMessage } from '@/components/ConversationGraph';
import { BranchInsights } from '@/components/BranchInsights';
import { MessageTimeline } from '@/components/MessageTimeline';
import { ArtifactPreview } from '@/components/ArtifactPreview';
import { cn } from '@/lib/utils';
import { ResizeHandle, useResize } from './ui/ResizeHandle';
import {
  transformToGraphMessage,
  computeBranchInsights,
  getBranchJumpMessages,
  BranchInsightsData,
} from '@/lib/side-panel-utils';

interface SidePanelProps {
  sidePanelType: 'graph' | 'timeline' | 'artifact' | null;
  sidePanelWidth: number;
  setSidePanelWidth: (width: number) => void;
  messages: Message[];
  messagesMap: Map<string, Message>;
  headId: string | null;
  setHeadId: (id: string | null) => void;
  showInfoToast: (message: string) => void;
  artifactPath?: string | null;
  onCloseArtifact?: () => void;
}

function summarizeBranchContent(content: string): string {
  if (!content) return '(empty)';

  const TOOL_CALL_TAG_REGEX = /<tool-call[^>]*>[\s\S]*?<\/tool-call>/g;
  const textOnly = content.replace(TOOL_CALL_TAG_REGEX, ' ').replace(/\s+/g, ' ').trim();
  if (textOnly) return textOnly;

  const firstTag = content.match(/<tool-call[^>]*\/>/)?.[0];
  if (!firstTag) return '(empty)';

  // Simple tool name extraction without getToolCallAttribute
  const nameMatch = firstTag.match(/name=["']([^"']+)["']/);
  const statusMatch = firstTag.match(/status=["']([^"']+)["']/);
  const name = nameMatch?.[1];
  const status = statusMatch?.[1];
  if (name && status) return `Tool ${name} (${status})`;
  if (name) return `Tool ${name}`;
  return '[tool call]';
}

export function SidePanel({
  sidePanelType,
  sidePanelWidth,
  setSidePanelWidth,
  messages,
  messagesMap,
  headId,
  setHeadId,
  showInfoToast,
  artifactPath,
  onCloseArtifact,
}: SidePanelProps) {
  // Use resize hook for panel width (reverse for left edge)
  const { size, isResizing, handleProps } = useResize({
    direction: 'horizontal',
    minSize: 250,
    maxSize: 800,
    initialSize: sidePanelWidth,
    reverse: true,
    onResize: setSidePanelWidth,
  });

  // Graph data computation
  const graphMessages: GraphMessage[] = useMemo(() => {
    if (sidePanelType !== 'graph') return [];
    return transformToGraphMessage(messagesMap, headId);
  }, [messagesMap, headId, sidePanelType]);

  // Branch insights computation
  const branchInsights: BranchInsightsData = useMemo(() => {
    return computeBranchInsights(graphMessages, headId);
  }, [graphMessages, headId]);

  // Branch jump messages for display
  const branchJumpMessages = useMemo(() => {
    return getBranchJumpMessages(branchInsights.branchPointIds, messagesMap);
  }, [branchInsights.branchPointIds, messagesMap]);

  // Event handlers
  const handleNodeClick = useCallback((nodeId: string) => {
    setHeadId(nodeId);
  }, [setHeadId]);

  const highlightMessage = useCallback((id: string) => {
    const el = document.getElementById(`message-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('message-highlight');

      // Wait for scroll (approx 450ms) before starting the 800ms removal timer
      setTimeout(() => {
        setTimeout(() => {
          el.classList.remove('message-highlight');
        }, 800);
      }, 450);
    }
  }, []);

  return (
    <div
      className={cn(
        "flex-none border-r bg-muted/5 relative flex flex-col overflow-hidden",
        // Disable transition during resize for smooth dragging
        !isResizing && "transition-[width] duration-200 ease-in-out",
        !sidePanelType && "w-0 border-none"
      )}
      style={{ width: sidePanelType ? size : 0 }}
    >
      <AnimatePresence mode="wait">
        {sidePanelType === 'graph' && (
          <motion.div
            key="graph"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.1 }}
            className="flex-1 flex flex-col min-h-0 relative h-full"
          >
            <div className="flex-1 min-h-0 relative">
              <ConversationGraph
                messages={graphMessages}
                currentLeafId={headId}
                onNodeClick={handleNodeClick}
                onCopyNotification={showInfoToast}
                className="absolute inset-0"
              />
            </div>
            <BranchInsights
              nodeCount={branchInsights.nodeCount}
              leafCount={branchInsights.leafCount}
              maxDepth={branchInsights.maxDepth}
              branchPointCount={branchInsights.branchPointIds.length}
              onBranchPointClick={handleNodeClick}
              branchPoints={branchJumpMessages.map((m) => ({
                id: m.id,
                content: summarizeBranchContent(m.message.content),
                role: m.message.role,
              }))}
            />
          </motion.div>
        )}

        {sidePanelType === 'timeline' && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.1 }}
            className="flex-1 flex flex-col min-h-0 relative h-full"
          >
            <MessageTimeline
              messages={messages}
              currentIndex={messages.length - 1}
              onMessageClick={(index) => {
                const msg = messages[index];
                if (msg && msg.id) {
                  highlightMessage(msg.id);
                }
              }}
            />
          </motion.div>
        )}

        {sidePanelType === 'artifact' && artifactPath && (
          <motion.div
            key="artifact"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.1 }}
            className="flex-1 flex flex-col min-h-0 relative h-full bg-background"
          >
            <ArtifactPreview 
              filePath={artifactPath} 
              onClose={() => onCloseArtifact?.()} 
              className="flex-1 h-full w-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Resize Handle (at edge with main content) */}
      <ResizeHandle
        direction="horizontal"
        isResizing={isResizing}
        onMouseDown={handleProps.onMouseDown}
        className="absolute top-0 left-0 h-full"
        indicatorClassName="bg-[var(--border-subtle)]"
      />
    </div>
  );
}
