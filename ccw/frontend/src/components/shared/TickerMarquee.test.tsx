// ========================================
// TickerMarquee Component Tests
// ========================================

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TickerMarquee } from './TickerMarquee';
import type { TickerMessage } from '@/hooks/useRealtimeUpdates';

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

    expect(screen.getByText('Session WFS-001 created')).toBeInTheDocument();
    expect(screen.getByText('Task IMPL-001 completed successfully')).toBeInTheDocument();
    expect(screen.getByText('Workflow authentication started')).toBeInTheDocument();
  });

  it('shows waiting message when no messages', () => {
    render(<TickerMarquee mockMessages={[]} />);

    expect(screen.getByText(/Waiting for activity/i)).toBeInTheDocument();
  });

  it('renders links for messages with link property', () => {
    render(<TickerMarquee mockMessages={mockMessages} />);

    const sessionLink = screen.getByRole('link', { name: /Session WFS-001 created/i });
    expect(sessionLink).toHaveAttribute('href', '/sessions/WFS-001');
  });

  it('applies custom duration to animation', () => {
    const { container } = render(
      <TickerMarquee mockMessages={mockMessages} duration={60} />
    );

    const animatedDiv = container.querySelector('[class*="animate-marquee"]');
    expect(animatedDiv).toHaveStyle({ animationDuration: '60s' });
  });
});
