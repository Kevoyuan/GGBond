'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ChatContextType {
  activeContextFiles: string[];
  addContextFile: (filePath: string) => void;
  removeContextFile: (filePath: string) => void;
  clearContextFiles: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeContextFiles, setActiveContextFiles] = useState<string[]>([]);

  const addContextFile = useCallback((filePath: string) => {
    setActiveContextFiles((prev) => {
      if (prev.includes(filePath)) return prev;
      return [...prev, filePath];
    });
  }, []);

  const removeContextFile = useCallback((filePath: string) => {
    setActiveContextFiles((prev) => prev.filter((f) => f !== filePath));
  }, []);

  const clearContextFiles = useCallback(() => {
    setActiveContextFiles([]);
  }, []);

  return (
    <ChatContext.Provider value={{ activeContextFiles, addContextFile, removeContextFile, clearContextFiles }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}