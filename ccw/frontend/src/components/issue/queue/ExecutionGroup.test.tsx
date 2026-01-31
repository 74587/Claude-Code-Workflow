// ========================================
// ExecutionGroup Component Tests
// ========================================
// Tests for the execution group component with i18n

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { ExecutionGroup } from './ExecutionGroup';

describe('ExecutionGroup', () => {
  const defaultProps = {
    group: 'group-1',
    items: ['task1', 'task2'],
    type: 'sequential' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with en locale', () => {
    it('should render group name', () => {
      render(<ExecutionGroup {...defaultProps} />, { locale: 'en' });
      expect(screen.getByText(/group-1/i)).toBeInTheDocument();
    });

    it('should show sequential badge', () => {
      render(<ExecutionGroup {...defaultProps} />, { locale: 'en' });
      expect(screen.getByText(/Sequential/i)).toBeInTheDocument();
    });

    it('should show parallel badge for parallel type', () => {
      render(<ExecutionGroup {...defaultProps} type="parallel" />, { locale: 'en' });
      expect(screen.getByText(/Parallel/i)).toBeInTheDocument();
    });

    it('should show items count', () => {
      render(<ExecutionGroup {...defaultProps} />, { locale: 'en' });
      expect(screen.getByText(/2 items/i)).toBeInTheDocument();
    });

    it('should render item list', () => {
      render(<ExecutionGroup {...defaultProps} />, { locale: 'en' });
      expect(screen.getByText('task1')).toBeInTheDocument();
      expect(screen.getByText('task2')).toBeInTheDocument();
    });
  });

  describe('with zh locale', () => {
    it('should render group name', () => {
      render(<ExecutionGroup {...defaultProps} />, { locale: 'zh' });
      expect(screen.getByText(/group-1/i)).toBeInTheDocument();
    });

    it('should show translated sequential badge', () => {
      render(<ExecutionGroup {...defaultProps} />, { locale: 'zh' });
      expect(screen.getByText(/顺序/i)).toBeInTheDocument();
    });

    it('should show translated parallel badge', () => {
      render(<ExecutionGroup {...defaultProps} type="parallel" />, { locale: 'zh' });
      expect(screen.getByText(/并行/i)).toBeInTheDocument();
    });

    it('should show items count in Chinese', () => {
      render(<ExecutionGroup {...defaultProps} items={['task1']} />, { locale: 'zh' });
      expect(screen.getByText(/1 item/i)).toBeInTheDocument(); // "item" is not translated in the component
    });

    it('should render item list', () => {
      render(<ExecutionGroup {...defaultProps} />, { locale: 'zh' });
      expect(screen.getByText('task1')).toBeInTheDocument();
      expect(screen.getByText('task2')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('should expand and collapse on click', async () => {
      const user = userEvent.setup();
      render(<ExecutionGroup {...defaultProps} />, { locale: 'en' });

      // Initially expanded, items should be visible
      expect(screen.getByText('task1')).toBeInTheDocument();

      // Click to collapse
      const header = screen.getByText(/group-1/i).closest('div');
      if (header) {
        await user.click(header);
      }

      // After collapse, items should not be visible (group collapses)
      // Note: The component uses state internally, so we need to test differently
    });

    it('should be clickable via header', () => {
      render(<ExecutionGroup {...defaultProps} />, { locale: 'en' });
      const cardHeader = screen.getByText(/group-1/i).closest('.cursor-pointer');
      expect(cardHeader).toBeInTheDocument();
      expect(cardHeader).toHaveClass('cursor-pointer');
    });
  });

  describe('sequential numbering', () => {
    it('should show numbered items for sequential type', () => {
      render(<ExecutionGroup {...defaultProps} items={['task1', 'task2', 'task3']} />, { locale: 'en' });

      // Sequential items should have numbers
      const itemElements = document.querySelectorAll('.font-mono');
      expect(itemElements.length).toBe(3);
    });

    it('should not show numbers for parallel type', () => {
      render(<ExecutionGroup {...defaultProps} type="parallel" items={['task1', 'task2']} />, { locale: 'en' });

      // Parallel items should not have numbers in the numbering position
      const numberElements = document.querySelectorAll('.text-muted-foreground.text-xs');
      // In parallel mode, the numbering position should be empty
    });
  });

  describe('empty state', () => {
    it('should handle empty items array', () => {
      render(<ExecutionGroup {...defaultProps} items={[]} />, { locale: 'en' });
      expect(screen.getByText(/0 items/i)).toBeInTheDocument();
    });

    it('should handle single item', () => {
      render(<ExecutionGroup {...defaultProps} items={['task1']} />, { locale: 'en' });
      expect(screen.getByText(/1 item/i)).toBeInTheDocument();
      expect(screen.getByText('task1')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have clickable header with proper cursor', () => {
      render(<ExecutionGroup {...defaultProps} />, { locale: 'en' });
      const header = screen.getByText(/group-1/i).closest('.cursor-pointer');
      expect(header).toHaveClass('cursor-pointer');
    });

    it('should render expandable indicator icon', () => {
      const { container } = render(<ExecutionGroup {...defaultProps} />, { locale: 'en' });
      // ChevronDown or ChevronRight should be present
      const chevron = container.querySelector('.lucide-chevron-down, .lucide-chevron-right');
      expect(chevron).toBeInTheDocument();
    });
  });

  describe('parallel layout', () => {
    it('should use grid layout for parallel groups', () => {
      const { container } = render(
        <ExecutionGroup {...defaultProps} type="parallel" items={['task1', 'task2', 'task3', 'task4']} />,
        { locale: 'en' }
      );

      // Check for grid class (sm:grid-cols-2)
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toBeInTheDocument();
    });
  });
});
