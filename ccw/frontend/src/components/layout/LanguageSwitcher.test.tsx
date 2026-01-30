// ========================================
// LanguageSwitcher Component Tests
// ========================================
// Tests for the language switcher component

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAppStore } from '@/stores/appStore';
import userEvent from '@testing-library/user-event';

describe('LanguageSwitcher Component', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({ locale: 'en' });
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the select component', () => {
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should display current locale value', () => {
      useAppStore.setState({ locale: 'en' });
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveTextContent('English');
    });

    it('should display Chinese locale when set', () => {
      useAppStore.setState({ locale: 'zh' });
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveTextContent('中文');
    });

    it('should have aria-label for accessibility', () => {
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-label', 'Select language');
    });

    it('should render in compact mode', () => {
      render(<LanguageSwitcher compact />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select).toHaveClass('w-[110px]');
    });

    it('should render in default mode', () => {
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select).toHaveClass('w-[160px]');
    });
  });

  describe('language options', () => {
    it('should display English option', async () => {
      const user = userEvent.setup();
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      await user.click(select);

      // Wait for dropdown to appear and check for option role
      await waitFor(() => {
        const englishOption = screen.getByRole('option', { name: /English/ });
        expect(englishOption).toBeInTheDocument();
      });
    });

    it('should display Chinese option', async () => {
      const user = userEvent.setup();
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      await user.click(select);

      // Wait for dropdown to appear
      await waitFor(() => {
        const chineseOption = screen.getByRole('option', { name: /中文/ });
        expect(chineseOption).toBeInTheDocument();
      });
    });

    it('should display flag icons for options', async () => {
      const user = userEvent.setup();
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      await user.click(select);

      // Check for flag emojis in options
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBe(2);
        const optionsText = options.map(opt => opt.textContent).join(' ');
        expect(optionsText).toContain('🇺🇸');
        expect(optionsText).toContain('🇨🇳');
      });
    });
  });

  describe('language switching behavior', () => {
    it('should call setLocale when option is selected', async () => {
      const user = userEvent.setup();
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      await user.click(select);

      // Wait for Chinese option and click it
      await waitFor(() => {
        const chineseOption = screen.getByText('中文');
        user.click(chineseOption);
      });

      // Verify locale was updated in store
      await waitFor(() => {
        expect(useAppStore.getState().locale).toBe('zh');
      });
    });

    it('should switch to English when selected', async () => {
      const user = userEvent.setup();
      useAppStore.setState({ locale: 'zh' });

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveTextContent('中文');

      await user.click(select);

      // Wait for English option and click it
      await waitFor(() => {
        const englishOption = screen.getByText('English');
        user.click(englishOption);
      });

      // Verify locale was updated in store
      await waitFor(() => {
        expect(useAppStore.getState().locale).toBe('en');
      });
    });

    it('should persist locale selection to store', async () => {
      const user = userEvent.setup();
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      await user.click(select);

      await waitFor(() => {
        const chineseOption = screen.getByText('中文');
        user.click(chineseOption);
      });

      // Check that store was updated
      await waitFor(() => {
        const storeLocale = useAppStore.getState().locale;
        expect(storeLocale).toBe('zh');
      });
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(<LanguageSwitcher className="custom-class" />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('custom-class');
    });
  });

  describe('accessibility', () => {
    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      select.focus();

      expect(select).toHaveFocus();

      // Open with Enter
      await user.keyboard('{Enter}');

      // Should show options after opening
      await waitFor(() => {
        const englishOption = screen.getByRole('option', { name: /English/ });
        expect(englishOption).toBeInTheDocument();
      });
    });

    it('should maintain focus management', async () => {
      const user = userEvent.setup();
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      await user.click(select);

      // Focus should remain on select or move to options
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });
    });
  });

  describe('integration with useLocale hook', () => {
    it('should reflect current locale from store', () => {
      useAppStore.setState({ locale: 'zh' });
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveTextContent('中文');
    });

    it('should update when store locale changes externally', async () => {
      const { rerender } = render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveTextContent('English');

      // Update store externally
      useAppStore.setState({ locale: 'zh' });

      // Re-render to reflect change
      rerender(<LanguageSwitcher />);

      expect(select).toHaveTextContent('中文');
    });
  });
});
