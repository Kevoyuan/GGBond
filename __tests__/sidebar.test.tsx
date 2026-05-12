import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Sidebar } from '../components/layout/Sidebar';

// Mock dynamic components to avoid rendering their complex internals
vi.mock('@/components/sidebar/ChatView', () => ({
  ChatView: () => <div data-testid="chat-view">Chat View Mock</div>
}));
vi.mock('@/components/modules/SkillsManager', () => ({
  SkillsManager: () => <div data-testid="skills-manager">Skills Mock</div>
}));
vi.mock('@/components/panels/HooksPanel', () => ({
  HooksPanel: () => <div data-testid="hooks-panel">Hooks Mock</div>
}));
vi.mock('@/components/panels/MCPPanel', () => ({
  MCPPanel: () => <div data-testid="mcp-panel">MCP Mock</div>
}));
vi.mock('@/components/agent/AgentPanel', () => ({
  AgentPanel: () => <div data-testid="agent-panel">Agents Mock</div>
}));
vi.mock('@/components/panels/QuotaPanel', () => ({
  QuotaPanel: () => <div data-testid="quota-panel">Quota Mock</div>
}));
vi.mock('@/components/panels/MemoryPanel', () => ({
  MemoryPanel: () => <div data-testid="memory-panel">Memory Mock</div>
}));

describe('Sidebar Component', () => {
  const defaultProps = {
    sessions: [],
    currentSessionId: null,
    onSelectSession: vi.fn(),
    onDeleteSession: vi.fn(),
    onOpenSettings: vi.fn(),
    isDark: false,
    toggleTheme: vi.fn(),
  };

  it('renders correctly with chat view by default', () => {
    render(<Sidebar {...defaultProps} />);
    
    // Check that navigation items are rendered
    expect(screen.getByText('Chats')).toBeDefined();
    expect(screen.getByText('Agents')).toBeDefined();
    expect(screen.getByText('Skills')).toBeDefined();

    // Check that default view content is rendered
    expect(screen.getByTestId('chat-view')).toBeDefined();
  });

  it('navigates between views when sidebar items are clicked', () => {
    const onSetSidebarView = vi.fn();
    render(<Sidebar {...defaultProps} onSetSidebarView={onSetSidebarView} />);

    // Click Skills
    fireEvent.click(screen.getByText('Skills'));
    expect(onSetSidebarView).toHaveBeenCalledWith('skills');

    // Click Hooks
    fireEvent.click(screen.getByText('Hooks'));
    expect(onSetSidebarView).toHaveBeenCalledWith('hooks');
  });

  it('calls onSetSidebarView when a view is clicked and prop is provided', () => {
    const onSetSidebarView = vi.fn();
    render(<Sidebar {...defaultProps} onSetSidebarView={onSetSidebarView} />);
    
    fireEvent.click(screen.getByText('Hooks'));
    expect(onSetSidebarView).toHaveBeenCalledWith('hooks');
  });

  it('hides content view and search when collapsed', () => {
    const { container } = render(<Sidebar {...defaultProps} isCollapsed={true} />);
    
    // Check if the input placeholder is missing
    const searchInput = screen.queryByPlaceholderText(/Search/i);
    expect(searchInput).toBeNull();
  });
});
