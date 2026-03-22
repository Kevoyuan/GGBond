import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Bot, Copy, FileJson, FileText, GitBranch, UserRound } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils';
import { copyToClipboard, exportToJSON, exportToMermaid } from '@/lib/export-utils';

export interface GraphMessage {
  id: string;
  parentId: string | null;
  role: 'user' | 'model';
  content: string;
  isLeaf?: boolean;
}

interface ConversationGraphProps {
  messages: GraphMessage[];
  currentLeafId: string | null;
  onNodeClick?: (nodeId: string) => void;
  onCopyNotification?: (message: string) => void;
  className?: string;
}

interface GraphNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  role: 'user' | 'model';
  isActiveLeaf: boolean;
  isOnActivePath: boolean;
  isBranchPoint: boolean;
  childCount: number;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 92;
const HORIZONTAL_GAP = 44;
const VERTICAL_GAP = 72;
const ROOT_GAP = 84;
const TOOL_CALL_TAG_REGEX = /<tool-call[^>]*\/>/g;

const readToolCallAttribute = (tag: string, key: string) => {
  const match = tag.match(new RegExp(`${key}="([^"]*)"`));
  return match?.[1] || '';
};

const getGraphPreviewText = (rawContent: string) => {
  if (!rawContent) return '(empty)';

  const textOnly = rawContent.replace(TOOL_CALL_TAG_REGEX, ' ').replace(/\s+/g, ' ').trim();
  if (textOnly) return textOnly;

  const firstTag = rawContent.match(/<tool-call[^>]*\/>/)?.[0];
  if (!firstTag) return '(empty)';

  const name = readToolCallAttribute(firstTag, 'name');
  const status = readToolCallAttribute(firstTag, 'status');
  if (name && status) return `Tool ${name} (${status})`;
  if (name) return `Tool ${name}`;
  return '[tool call]';
};

const CustomNode = ({ data, isConnectable }: NodeProps<Node<GraphNodeData>>) => {
  const nodeData = data as GraphNodeData;
  const preview = getGraphPreviewText(nodeData.label);
  const isUser = nodeData.role === 'user';

  return (
    <div
      className={cn(
        'w-[220px] rounded-xl border px-3 py-2 shadow-sm transition-colors duration-200',
        'bg-gradient-to-b from-card to-card/80 backdrop-blur-sm',
        nodeData.isActiveLeaf && 'border-amber-400/90 ring-2 ring-amber-400/20 shadow-amber-500/10',
        !nodeData.isActiveLeaf && nodeData.isOnActivePath && 'border-blue-400/80 ring-1 ring-blue-400/20',
        !nodeData.isOnActivePath && 'border-border/70',
        nodeData.isBranchPoint && 'shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
      )}
    >
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!h-2 !w-2 !border-0 !bg-transparent" />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-md',
              isUser ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'
            )}
          >
            {isUser ? <UserRound size={11} /> : <Bot size={11} />}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {isUser ? 'User' : 'Model'}
          </span>
        </div>

        {nodeData.isBranchPoint && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">
            <GitBranch size={10} />
            {nodeData.childCount}
          </span>
        )}
      </div>

      <div className="text-xs text-foreground/90 line-clamp-3">{preview}</div>
      <div className="mt-1.5 text-[10px] font-mono text-muted-foreground">#{nodeData.id}</div>

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!h-2 !w-2 !border-0 !bg-transparent" />
    </div>
  );
};

const nodeTypes = {
  conversationNode: CustomNode,
};

const buildTreeLayout = (messages: GraphMessage[], currentLeafId: string | null) => {
  if (messages.length === 0) {
    return {
      nodes: [] as Node<GraphNodeData>[],
      edges: [] as Edge[],
    };
  }

  const messageById = new Map(messages.map((message) => [message.id, message]));
  const parentById = new Map<string, string | null>();
  const childrenById = new Map<string, string[]>();

  for (const message of messages) {
    parentById.set(message.id, message.parentId && messageById.has(message.parentId) ? message.parentId : null);
    childrenById.set(message.id, []);
  }

  for (const message of messages) {
    const parentId = parentById.get(message.id);
    if (parentId) {
      childrenById.get(parentId)?.push(message.id);
    }
  }

  const roots = messages
    .filter((message) => !parentById.get(message.id))
    .map((message) => message.id);

  if (roots.length === 0) {
    roots.push(messages[0].id);
  }

  const activePath = new Set<string>();
  if (currentLeafId && parentById.has(currentLeafId)) {
    let cursor: string | null = currentLeafId;
    while (cursor && !activePath.has(cursor)) {
      activePath.add(cursor);
      cursor = parentById.get(cursor) ?? null;
    }
  }

  const subtreeWidth = new Map<string, number>();

  const measure = (nodeId: string): number => {
    const cached = subtreeWidth.get(nodeId);
    if (cached !== undefined) {
      return cached;
    }

    const children = childrenById.get(nodeId) || [];
    if (children.length === 0) {
      subtreeWidth.set(nodeId, NODE_WIDTH);
      return NODE_WIDTH;
    }

    const childrenTotal = children.reduce((sum, childId, index) => {
      return sum + measure(childId) + (index > 0 ? HORIZONTAL_GAP : 0);
    }, 0);

    const width = Math.max(NODE_WIDTH, childrenTotal);
    subtreeWidth.set(nodeId, width);
    return width;
  };

  for (const rootId of roots) {
    measure(rootId);
  }

  const positions = new Map<string, { x: number; y: number }>();

  const place = (nodeId: string, depth: number, left: number) => {
    const width = subtreeWidth.get(nodeId) ?? NODE_WIDTH;
    const children = childrenById.get(nodeId) || [];

    positions.set(nodeId, {
      x: left + (width - NODE_WIDTH) / 2,
      y: depth * (NODE_HEIGHT + VERTICAL_GAP),
    });

    if (children.length === 0) {
      return;
    }

    const childrenTotal = children.reduce((sum, childId, index) => {
      return sum + (subtreeWidth.get(childId) ?? NODE_WIDTH) + (index > 0 ? HORIZONTAL_GAP : 0);
    }, 0);

    let childLeft = left + Math.max((width - childrenTotal) / 2, 0);
    for (const childId of children) {
      place(childId, depth + 1, childLeft);
      childLeft += (subtreeWidth.get(childId) ?? NODE_WIDTH) + HORIZONTAL_GAP;
    }
  };

  let rootLeft = 0;
  for (const rootId of roots) {
    place(rootId, 0, rootLeft);
    rootLeft += (subtreeWidth.get(rootId) ?? NODE_WIDTH) + ROOT_GAP;
  }

  const fallbackY = positions.size
    ? Math.max(...Array.from(positions.values()).map((position) => position.y)) + NODE_HEIGHT + VERTICAL_GAP
    : NODE_HEIGHT + VERTICAL_GAP;

  let fallbackIndex = 0;
  for (const message of messages) {
    if (!positions.has(message.id)) {
      positions.set(message.id, {
        x: fallbackIndex * (NODE_WIDTH + HORIZONTAL_GAP),
        y: fallbackY,
      });
      fallbackIndex += 1;
    }
  }

  const nodes: Node<GraphNodeData>[] = messages.map((message) => {
    const childCount = childrenById.get(message.id)?.length ?? 0;
    return {
      id: message.id,
      type: 'conversationNode',
      position: positions.get(message.id) || { x: 0, y: 0 },
      data: {
        id: message.id,
        label: message.content,
        role: message.role,
        isActiveLeaf: message.id === currentLeafId,
        isOnActivePath: activePath.has(message.id),
        isBranchPoint: childCount > 1,
        childCount,
      },
      draggable: false,
      selectable: true,
    };
  });

  const edges: Edge[] = [];
  for (const message of messages) {
    const parentId = parentById.get(message.id);
    if (!parentId) continue;

    const isActiveEdge = activePath.has(message.id) && activePath.has(parentId);
    const color = isActiveEdge ? '#60a5fa' : '#6b7280';

    edges.push({
      id: `${parentId}__${message.id}`,
      source: parentId,
      target: message.id,
      type: 'smoothstep',
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
      },
      style: {
        stroke: color,
        strokeWidth: isActiveEdge ? 2.2 : 1.2,
        opacity: isActiveEdge ? 0.95 : 0.6,
      },
    });
  }

  return { nodes, edges };
};

export function ConversationGraph({ messages, currentLeafId, onNodeClick, onCopyNotification, className }: ConversationGraphProps) {
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    return buildTreeLayout(messages, currentLeafId);
  }, [messages, currentLeafId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<GraphNodeData>) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  if (messages.length === 0) {
    return (
      <div className={cn('h-full w-full flex items-center justify-center text-sm text-muted-foreground', className)}>
        No conversation branches yet
      </div>
    );
  }

  return (
    <div className={cn('h-full w-full relative group', className)}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={async () => {
            const content = exportToMermaid(messages);
            await copyToClipboard(content);
            onCopyNotification?.('Copied Mermaid Markdown');
          }}
          className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition-colors duration-200 hover:bg-background/80 hover:border-border/60 shadow-lg"
          title="Copy Mermaid Markdown"
        >
          <FileText size={14} className="text-muted-foreground" />
          <span>Mermaid</span>
        </button>
        <button
          onClick={async () => {
            const content = exportToJSON(messages);
            await copyToClipboard(content);
            onCopyNotification?.('Copied JSON');
          }}
          className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition-colors duration-200 hover:bg-background/80 hover:border-border/60 shadow-lg"
          title="Copy JSON"
        >
          <FileJson size={14} className="text-muted-foreground" />
          <span>JSON</span>
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.1}
        maxZoom={1.8}
        attributionPosition="bottom-right"
      >
        <MiniMap
          zoomable
          pannable
          nodeColor={(node) => {
            const data = node.data as GraphNodeData;
            if (data.isActiveLeaf) return '#f59e0b';
            if (data.isOnActivePath) return '#60a5fa';
            return data.role === 'user' ? '#10b981' : '#64748b';
          }}
          className="!border !border-border/40 !bg-background/40 dark:!bg-[var(--bg-secondary)]/60 !backdrop-blur-md rounded-xl"
        />
        <Controls
          className="!border !border-border/40 !bg-background/40 dark:!bg-[var(--bg-secondary)]/60 !backdrop-blur-md rounded-lg overflow-hidden !shadow-xl [&_button]:!bg-transparent [&_button]:!border-border/20 [&_svg]:!fill-foreground [&_svg]:!text-foreground"
          showInteractive={false}
        />
        <Background gap={20} size={1} color="rgba(148,163,184,0.15)" />
      </ReactFlow>

      {/* Hide React Flow Attribution via standard CSS */}
      <style jsx global>{`
        .react-flow__attribution {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
