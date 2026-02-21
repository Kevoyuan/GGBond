'use client';

import { ThinkingBlock } from '../../components/ThinkingBlock';

export default function DebugThinkingPage() {
    const sampleContent = JSON.stringify([
        { subject: "Analyze Request", description: "User wants to redesign the UI." },
        { subject: "Identify Components", description: "Checking MessageBubble and ThinkingBlock." },
        { subject: "Implement Changes", description: "Removing boxes and adding list style." },
        { subject: "Verify", description: "Checking the new look." }
    ]);

    const rawContent = "This is a raw thought process without JSON structure.\nIt should just render as text.";

    return (
        <div className="p-10 max-w-2xl mx-auto space-y-10">
            <div>
                <h2 className="mb-4 font-bold">Structured Thoughts</h2>
                <ThinkingBlock content={sampleContent} defaultExpanded={true} />
            </div>

            <div>
                <h2 className="mb-4 font-bold">Raw Thoughts</h2>
                <ThinkingBlock content={rawContent} defaultExpanded={true} />
            </div>
        </div>
    );
}
