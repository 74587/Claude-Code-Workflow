// ========================================
// TickerMarquee Component Tests
// ========================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/i18n';
import { TickerMarquee } from './TickerMarquee';
import type { TickerMessage } from '@/hooks/useRealtimeUpdates';

// Mock useRealtimeUpdates to avoid actual WebSocket connections
vi.mock('@/hooks/useRealtimeUpdates', () => ({
  useRealtimeUpdates: () => ({
    messages: [],
    connectionStatus: 'connected',
    reconnect: vi.fn(),
  }),
}));

describe('TickerMarquee', () => {
  const mockMessages: TickerMessage[] = [
    {
      id: '1',
      text: 'Session WFS-001 created',
      type: 'session',
      link: '/sessions/WFS-001',
      timestamp: Date.now(),
    },
    {
      id: '2',
      text: 'Task IMPL-001 completed successfully',
      type: 'task',
      link: '/tasks/IMPL-001',
      timestamp: Date.now(),
    },
    {
      id: '3',
      text: 'Workflow authentication started',
      type: 'workflow',
      timestamp: Date.now(),
    },
  ];

  it('renders mock messages when provided', () => {
    render(<TickerMarquee mockMessages={mockMessages} />);

    expect(screen.getAllByText('Session WFS-001 created').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Task IMPL-001 completed successfully').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Workflow authentication started').length).toBeGreaterThan(0);
  });

  it('shows waiting message when no messages', () => {
    render(<TickerMarquee mockMessages={[]} />);

    expect(screen.getAllByText(/Waiting for activity/i).length).toBeGreaterThan(0);
  });

  it('renders links for messages with link property', () => {
    render(<TickerMarquee mockMessages={mockMessages} />);

    const sessionLinks = screen.getAllByRole('link', { name: /Session WFS-001 created/i });
    expect(sessionLinks.length).toBeGreaterThan(0);
    expect(sessionLinks[0]).toHaveAttribute('href', '/sessions/WFS-001');
  });

  it('applies custom duration to animation', () => {
    const { container } = render(
      <TickerMarquee mockMessages={mockMessages} duration={60} />
    );

    const animatedDiv = container.querySelector('[class*="animate-marquee"]');
    expect(animatedDiv).toHaveStyle({ animationDuration: '60s' });
  });
});
