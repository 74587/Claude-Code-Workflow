// ========================================
// DiscoveryCard Component Tests
// ========================================
// Tests for the discovery card component with i18n

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { DiscoveryCard } from './DiscoveryCard';
import type { DiscoverySession } from '@/lib/api';

describe('DiscoveryCard', () => {
  const mockSession: DiscoverySession = {
    id: '1',
    name: 'Test Session',
    status: 'running',
    progress: 50,
    findings_count: 5,
    created_at: '2024-01-01T00:00:00Z',
  };

  const defaultProps = {
    session: mockSession,
    isActive: false,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with en locale', () => {
    it('should render session name', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'en' });
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    it('should show running status badge', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'en' });
      expect(screen.getByText(/Running/i)).toBeInTheDocument();
    });

    it('should show completed status badge', () => {
      const completedSession: DiscoverySession = {
        ...mockSession,
        status: 'completed',
      };

      render(<DiscoveryCard {...defaultProps} session={completedSession} />, { locale: 'en' });
      expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    });

    it('should show failed status badge', () => {
      const failedSession: DiscoverySession = {
        ...mockSession,
        status: 'failed',
      };

      render(<DiscoveryCard {...defaultProps} session={failedSession} />, { locale: 'en' });
      expect(screen.getByText(/Failed/i)).toBeInTheDocument();
    });

    it('should show progress bar for running sessions', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'en' });
      expect(screen.getByText(/Progress/i)).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should not show progress bar for completed sessions', () => {
      const completedSession: DiscoverySession = {
        ...mockSession,
        status: 'completed',
      };

      render(<DiscoveryCard {...defaultProps} session={completedSession} />, { locale: 'en' });
      expect(screen.queryByText(/Progress/i)).not.toBeInTheDocument();
    });

    it('should show findings count', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'en' });
      expect(screen.getByText(/Findings/i)).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should show formatted date', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'en' });
      const dateText = new Date(mockSession.created_at).toLocaleString();
      expect(screen.getByText(new RegExp(dateText.replace(/[\/:]/g, '[/:]'), 'i'))).toBeInTheDocument();
    });
  });

  describe('with zh locale', () => {
    it('should render session name', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'zh' });
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    it('should show translated running status badge', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'zh' });
      expect(screen.getByText(/运行中/i)).toBeInTheDocument();
    });

    it('should show translated completed status badge', () => {
      const completedSession: DiscoverySession = {
        ...mockSession,
        status: 'completed',
      };

      render(<DiscoveryCard {...defaultProps} session={completedSession} />, { locale: 'zh' });
      expect(screen.getByText(/已完成/i)).toBeInTheDocument();
    });

    it('should show translated failed status badge', () => {
      const failedSession: DiscoverySession = {
        ...mockSession,
        status: 'failed',
      };

      render(<DiscoveryCard {...defaultProps} session={failedSession} />, { locale: 'zh' });
      expect(screen.getByText(/失败/i)).toBeInTheDocument();
    });

    it('should show translated progress text', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'zh' });
      expect(screen.getByText(/进度/i)).toBeInTheDocument();
    });

    it('should show translated findings count', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'zh' });
      expect(screen.getByText(/发现/i)).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<DiscoveryCard {...defaultProps} onClick={onClick} />, { locale: 'en' });

      const card = screen.getByText('Test Session').closest('.cursor-pointer');
      if (card) {
        await user.click(card);
      }

      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('visual states', () => {
    it('should apply active styles when isActive', () => {
      const { container } = render(
        <DiscoveryCard {...defaultProps} isActive={true} />,
        { locale: 'en' }
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('ring-2');
      expect(card.className).toContain('ring-primary');
    });

    it('should not apply active styles when not active', () => {
      const { container } = render(
        <DiscoveryCard {...defaultProps} isActive={false} />,
        { locale: 'en' }
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).not.toContain('ring-2');
    });

    it('should have hover effect', () => {
      const { container } = render(
        <DiscoveryCard {...defaultProps} />,
        { locale: 'en' }
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('hover:shadow-md');
    });
  });

  describe('progress bar', () => {
    it('should render progress element for running sessions', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'en' });

      const progressBar = document.querySelector('[role="progressbar"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should not render progress element for completed sessions', () => {
      const completedSession: DiscoverySession = {
        ...mockSession,
        status: 'completed',
      };

      render(<DiscoveryCard {...defaultProps} session={completedSession} />, { locale: 'en' });

      const progressBar = document.querySelector('[role="progressbar"]');
      expect(progressBar).not.toBeInTheDocument();
    });

    it('should display correct progress percentage', () => {
      const sessionWithDifferentProgress: DiscoverySession = {
        ...mockSession,
        progress: 75,
      };

      render(<DiscoveryCard {...defaultProps} session={sessionWithDifferentProgress} />, { locale: 'en' });
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have clickable card with proper cursor', () => {
      const { container } = render(<DiscoveryCard {...defaultProps} />, { locale: 'en' });
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('cursor-pointer');
    });

    it('should have proper heading structure', () => {
      render(<DiscoveryCard {...defaultProps} />, { locale: 'en' });
      const heading = screen.getByRole('heading', { level: 3, name: 'Test Session' });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle zero findings', () => {
      const sessionWithNoFindings: DiscoverySession = {
        ...mockSession,
        findings_count: 0,
      };

      render(<DiscoveryCard {...defaultProps} session={sessionWithNoFindings} />, { locale: 'en' });
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle zero progress', () => {
      const sessionWithNoProgress: DiscoverySession = {
        ...mockSession,
        progress: 0,
      };

      render(<DiscoveryCard {...defaultProps} session={sessionWithNoProgress} />, { locale: 'en' });
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle 100% progress', () => {
      const sessionWithFullProgress: DiscoverySession = {
        ...mockSession,
        progress: 100,
      };

      render(<DiscoveryCard {...defaultProps} session={sessionWithFullProgress} />, { locale: 'en' });
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
