'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ChatInterface } from '@/components/chat-interface';
import { ThemeProvider } from '@/components/theme-provider';

export default function Home() {
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar 
          currentSessionId={currentSessionId}
          onSelectSession={setCurrentSessionId}
        />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <ChatInterface 
            sessionId={currentSessionId}
            onNewSession={setCurrentSessionId}
          />
        </main>
      </div>
    </ThemeProvider>
  );
}
