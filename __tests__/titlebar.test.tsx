import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Titlebar } from '../components/layout/Titlebar';

// Mock Tauri window API
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    close: vi.fn(),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    startDragging: vi.fn(),
  }),
}));

describe('Titlebar Component', () => {
  it('renders correctly in expanded state', () => {
    const onToggleCollapse = vi.fn();
    const onNewChat = vi.fn();

    render(
      <Titlebar
        isCollapsed={false}
        onToggleCollapse={onToggleCollapse}
        onNewChat={onNewChat}
        nativeWindowControls={false}
      />
    );

    const toggleButton = screen.getByTitle('Collapse sidebar');
    expect(toggleButton).toBeDefined();

    fireEvent.click(toggleButton);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('renders correctly in collapsed state with rotate-180 class', () => {
    const onToggleCollapse = vi.fn();
    const onNewChat = vi.fn();

    const { container } = render(
      <Titlebar
        isCollapsed={true}
        onToggleCollapse={onToggleCollapse}
        onNewChat={onNewChat}
        nativeWindowControls={false}
      />
    );

    const toggleButton = screen.getByTitle('Expand sidebar');
    expect(toggleButton).toBeDefined();

    // Check if the svg inside has rotate-180
    const svg = toggleButton.querySelector('svg');
    expect(svg?.className.baseVal).toContain('rotate-180');

    fireEvent.click(toggleButton);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('renders native window controls spacer when nativeWindowControls is true', () => {
    const { container } = render(
      <Titlebar
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        onNewChat={vi.fn()}
        nativeWindowControls={true}
      />
    );

    // Look for the aria-hidden spacer
    const spacer = container.querySelector('[aria-hidden="true"]');
    expect(spacer).toBeDefined();
    expect(spacer?.className).toContain('w-[84px]');
  });
});
