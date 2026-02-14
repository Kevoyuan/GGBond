import { GraphMessage } from '@/components/ConversationGraph';

/**
 * Escapes characters that might break Mermaid syntax OR just cleans up the text for preview.
 * Mermaid needs specific escaping for some characters like quotes, but for a flow chart 
 * node labels, we'll keep it simple: trim and replace newlines.
 */
const sanitizeMermaidText = (text: string) => {
    if (!text) return '';
    // Basic cleanup: remove tags, simplify whitespace
    const clean = text
        .replace(/<tool-call[^>]*\/>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/"/g, "'") // Replace double quotes with single to avoid Mermaid node label issues
        .trim();

    if (clean.length > 50) return clean.substring(0, 47) + '...';
    return clean || '(empty)';
};

/**
 * Exports a list of messages to Mermaid graph syntax.
 */
export function exportToMermaid(messages: GraphMessage[]): string {
    if (messages.length === 0) return '';

    let mermaid = 'graph TD\n';

    // Add styles for roles
    mermaid += '    %% Styles\n';
    mermaid += '    classDef user fill:#10b981,stroke:#059669,color:#fff\n';
    mermaid += '    classDef model fill:#3b82f6,stroke:#2563eb,color:#fff\n\n';

    for (const msg of messages) {
        const label = sanitizeMermaidText(msg.content);
        // Node definition: ID["[Role] Content"]
        mermaid += `    ${msg.id}["${msg.role.toUpperCase()}: ${label}"]\n`;
        mermaid += `    class ${msg.id} ${msg.role}\n`;

        if (msg.parentId) {
            mermaid += `    ${msg.parentId} --> ${msg.id}\n`;
        }
    }

    return mermaid;
}

/**
 * Exports a list of messages to JSON string.
 */
export function exportToJSON(messages: GraphMessage[]): string {
    return JSON.stringify(messages, null, 2);
}

/**
 * Copies the given text to the clipboard.
 */
export async function copyToClipboard(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
        return navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers (though less likely here)
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
}

/**
 * Triggers a browser download of the given content.
 */
export function downloadFile(content: string, filename: string, contentType: string) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
