import { Message } from '@/components/MessageBubble';
import { GraphMessage } from '@/components/ConversationGraph';

export interface BranchInsightsData {
  nodeCount: number;
  leafCount: number;
  branchPointIds: string[];
  maxDepth: number;
  activeDepth: number;
}

/**
 * Transform messagesMap to GraphMessage[] for visualization
 */
export function transformToGraphMessage(
  messagesMap: Map<string, Message>,
  headId: string | null
): GraphMessage[] {
  return Array.from(messagesMap.entries()).map(([mapId, msg]) => {
    const stableId = msg.id || mapId;
    return {
      id: stableId,
      parentId: msg.parentId || null,
      role: msg.role,
      content: msg.content,
      isLeaf: stableId === headId,
    };
  });
}

/**
 * Compute branch insights from graph messages
 */
export function computeBranchInsights(
  graphMessages: GraphMessage[],
  headId: string | null
): BranchInsightsData {
  if (!graphMessages.length) {
    return {
      nodeCount: 0,
      leafCount: 0,
      branchPointIds: [],
      maxDepth: 0,
      activeDepth: 0,
    };
  }

  const parentById = new Map<string, string | null>();
  const childrenById = new Map<string, string[]>();

  for (const message of graphMessages) {
    parentById.set(message.id, message.parentId);
    childrenById.set(message.id, []);
  }

  for (const message of graphMessages) {
    if (message.parentId && childrenById.has(message.parentId)) {
      childrenById.get(message.parentId)?.push(message.id);
    }
  }

  const roots = graphMessages
    .filter((message) => !message.parentId || !childrenById.has(message.parentId))
    .map((message) => message.id);

  if (!roots.length) {
    roots.push(graphMessages[0].id);
  }

  const depthById = new Map<string, number>();
  const visited = new Set<string>();
  const queue = roots.map((id) => ({ id, depth: 0 }));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    depthById.set(current.id, current.depth);
    const children = childrenById.get(current.id) || [];
    for (const childId of children) {
      queue.push({ id: childId, depth: current.depth + 1 });
    }
  }

  const maxDepth = Array.from(depthById.values()).reduce((max, depth) => Math.max(max, depth), 0);
  const branchPointIds = Array.from(childrenById.entries())
    .filter(([, children]) => children.length > 1)
    .sort((a, b) => (depthById.get(a[0]) || 0) - (depthById.get(b[0]) || 0))
    .map(([id]) => id);
  const leafCount = Array.from(childrenById.values()).filter((children) => children.length === 0).length;

  let activeDepth = 0;
  let cursor = headId;
  const pathGuard = new Set<string>();
  while (cursor && !pathGuard.has(cursor)) {
    pathGuard.add(cursor);
    const parent = parentById.get(cursor) || null;
    if (!parent) break;
    activeDepth += 1;
    cursor = parent;
  }

  return {
    nodeCount: graphMessages.length,
    leafCount,
    branchPointIds,
    maxDepth,
    activeDepth,
  };
}

/**
 * Get branch jump messages (filtered branch point messages for display)
 */
export function getBranchJumpMessages(
  branchPointIds: string[],
  messagesMap: Map<string, Message>
): { id: string; message: Message }[] {
  return branchPointIds
    .map((id) => ({ id, message: messagesMap.get(id) }))
    .filter((entry): entry is { id: string; message: Message } => Boolean(entry.message))
    .slice(0, 6);
}
