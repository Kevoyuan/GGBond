import React, { useCallback, useMemo } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    MiniMap,
    Controls,
    Background,
    Node,
    Edge,
    Handle,
    Position,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils'; // Assuming utils exist

// -- Types --
export interface GraphMessage {
    id: string; // Message ID (e.g. "msg-123")
    parentId: string | null;
    role: 'user' | 'model';
    content: string;
    isLeaf?: boolean;
}

interface ConversationGraphProps {
    messages: GraphMessage[];
    currentLeafId: string | null;
    onNodeClick?: (nodeId: string) => void;
    className?: string;
}

// -- Custom Node --
const CustomNode = ({ data, isConnectable }: any) => {
    const isSelected = data.isSelected;
    const isUser = data.role === 'user';

    return (
        <div className={cn(
            "px-4 py-2 rounded-lg shadow-md border min-w-[150px] max-w-[300px]",
            isUser ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200",
            isSelected ? "ring-2 ring-primary" : ""
        )}>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
            <div className="text-xs font-bold text-gray-500 mb-1">
                {isUser ? 'User' : 'Model'} {data.id}
            </div>
            <div className="text-sm truncate">
                {data.label}
            </div>
            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
        </div>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

// -- Helper to layout graph (simple implementation) --
// For a real app, use dagre or elkjs
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    // Simple vertical layout
    const yGap = 100;
    const xGap = 200;

    // Group by level (depth)
    const levels: Record<number, Node[]> = {};
    const nodeDepths: Record<string, number> = {};

    // 1. Calculate depths
    const calculateDepth = (nodeId: string, depth: number) => {
        nodeDepths[nodeId] = depth;
        if (!levels[depth]) levels[depth] = [];

        // Check if node is already in levels[depth] to prevent duplicates if graph has cycles (shouldn't)
        if (!levels[depth].find(n => n.id === nodeId)) {
            const node = nodes.find(n => n.id === nodeId);
            if (node) levels[depth].push(node);
        }

        // Find children
        const childrenEdges = edges.filter(e => e.source === nodeId);
        childrenEdges.forEach(e => calculateDepth(e.target, depth + 1));
    };

    // Find roots
    const roots = nodes.filter(n => !edges.find(e => e.target === n.id));
    roots.forEach(r => calculateDepth(r.id, 0));

    // 2. Assign positions
    nodes.forEach(node => {
        const depth = nodeDepths[node.id] || 0;
        const levelNodes = levels[depth] || [];
        const index = levelNodes.indexOf(node);

        node.position = {
            x: index * xGap,
            y: depth * yGap,
        };
    });

    return { nodes, edges };
};


export function ConversationGraph({ messages, currentLeafId, onNodeClick, className }: ConversationGraphProps) {
    // Transform messages to Nodes and Edges
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // 1. Create Nodes
        messages.forEach(msg => {
            // Determine if this node is part of the current active path
            // This requires traversing up from currentLeafId
            // For now, let's just mark the currentLeafId as selected
            const isSelected = msg.id === currentLeafId;

            nodes.push({
                id: msg.id,
                type: 'custom',
                data: {
                    label: msg.content,
                    role: msg.role,
                    id: msg.id,
                    isSelected
                },
                position: { x: 0, y: 0 }, // Will be set by layout
            });

            // 2. Create Edges
            if (msg.parentId) {
                edges.push({
                    id: `e${msg.parentId}-${msg.id}`,
                    source: msg.parentId,
                    target: msg.id,
                    type: 'smoothstep',
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                    },
                    animated: isSelected, // animate edge if part of active path (logic simplified)
                });
            }
        });

        return getLayoutedElements(nodes, edges);
    }, [messages, currentLeafId]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Update nodes when props change (re-layout)
    React.useEffect(() => {
        const { nodes: newNodes, edges: newEdges } = getLayoutedElements(initialNodes, initialEdges);
        setNodes(newNodes);
        setEdges(newEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (onNodeClick) {
            onNodeClick(node.id);
        }
    }, [onNodeClick]);

    return (
        <div className={cn("h-full w-full", className)}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
            >
                <MiniMap zoomable pannable />
                <Controls />
                <Background gap={12} size={1} />
            </ReactFlow>
        </div>
    );
}
