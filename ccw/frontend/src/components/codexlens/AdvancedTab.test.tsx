import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { render, screen, waitFor } from '@/test/i18n';
import { AdvancedTab } from './AdvancedTab';

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useCodexLensEnv: vi.fn(),
    useUpdateCodexLensEnv: vi.fn(),
    useCodexLensIgnorePatterns: vi.fn(),
    useUpdateIgnorePatterns: vi.fn(),
    useNotifications: vi.fn(),
  };
});

import {
  useCodexLensEnv,
  useUpdateCodexLensEnv,
  useCodexLensIgnorePatterns,
  useUpdateIgnorePatterns,
  useNotifications,
} from '@/hooks';

const mockRefetchEnv = vi.fn().mockResolvedValue(undefined);
const mockRefetchPatterns = vi.fn().mockResolvedValue(undefined);
const mockUpdateEnv = vi.fn().mockResolvedValue({ success: true, message: 'Saved' });
const mockUpdatePatterns = vi.fn().mockResolvedValue({
  success: true,
  patterns: ['dist', 'frontend/dist'],
  extensionFilters: ['*.min.js', 'frontend/skip.ts'],
  defaults: {
    patterns: ['dist', 'build'],
    extensionFilters: ['*.min.js'],
  },
});
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

function setupDefaultMocks() {
  vi.mocked(useCodexLensEnv).mockReturnValue({
    data: { success: true, env: {}, settings: {}, raw: '', path: '~/.codexlens/.env' },
    raw: '',
    env: {},
    settings: {},
    isLoading: false,
    error: null,
    refetch: mockRefetchEnv,
  });

  vi.mocked(useUpdateCodexLensEnv).mockReturnValue({
    updateEnv: mockUpdateEnv,
    isUpdating: false,
    error: null,
  });

  vi.mocked(useCodexLensIgnorePatterns).mockReturnValue({
    data: {
      success: true,
      patterns: ['dist', 'coverage'],
      extensionFilters: ['*.min.js', '*.map'],
      defaults: {
        patterns: ['dist', 'build', 'coverage'],
        extensionFilters: ['*.min.js', '*.map'],
      },
    },
    patterns: ['dist', 'coverage'],
    extensionFilters: ['*.min.js', '*.map'],
    defaults: {
      patterns: ['dist', 'build', 'coverage'],
      extensionFilters: ['*.min.js', '*.map'],
    },
    isLoading: false,
    error: null,
    refetch: mockRefetchPatterns,
  });

  vi.mocked(useUpdateIgnorePatterns).mockReturnValue({
    updatePatterns: mockUpdatePatterns,
    isUpdating: false,
    error: null,
  });

  vi.mocked(useNotifications).mockReturnValue({
    success: mockToastSuccess,
    error: mockToastError,
  } as ReturnType<typeof useNotifications>);
}

describe('AdvancedTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('renders existing filter configuration', () => {
    render(<AdvancedTab enabled={true} />);

    expect(screen.getByLabelText(/Ignored directories \/ paths/i)).toHaveValue('dist\ncoverage');
    expect(screen.getByLabelText(/Skipped files \/ globs/i)).toHaveValue('*.min.js\n*.map');
    expect(screen.getByText(/Directory filters: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/File filters: 2/i)).toBeInTheDocument();
  });

  it('saves parsed filter configuration', async () => {
    render(<AdvancedTab enabled={true} />);

    const ignorePatternsInput = screen.getByLabelText(/Ignored directories \/ paths/i);
    const extensionFiltersInput = screen.getByLabelText(/Skipped files \/ globs/i);

    fireEvent.change(ignorePatternsInput, { target: { value: 'dist,\nfrontend/dist' } });
    fireEvent.change(extensionFiltersInput, { target: { value: '*.min.js,\nfrontend/skip.ts' } });
    fireEvent.click(screen.getByRole('button', { name: /Save filters/i }));

    await waitFor(() => {
      expect(mockUpdatePatterns).toHaveBeenCalledWith({
        patterns: ['dist', 'frontend/dist'],
        extensionFilters: ['*.min.js', 'frontend/skip.ts'],
      });
    });
    expect(mockRefetchPatterns).toHaveBeenCalled();
  });

  it('restores default filter values before saving', async () => {
    render(<AdvancedTab enabled={true} />);

    fireEvent.click(screen.getByRole('button', { name: /Restore defaults/i }));

    expect(screen.getByLabelText(/Ignored directories \/ paths/i)).toHaveValue('dist\nbuild\ncoverage');
    expect(screen.getByLabelText(/Skipped files \/ globs/i)).toHaveValue('*.min.js\n*.map');

    fireEvent.click(screen.getByRole('button', { name: /Save filters/i }));

    await waitFor(() => {
      expect(mockUpdatePatterns).toHaveBeenCalledWith({
        patterns: ['dist', 'build', 'coverage'],
        extensionFilters: ['*.min.js', '*.map'],
      });
    });
  });

  it('blocks invalid filter entries before saving', async () => {
    render(<AdvancedTab enabled={true} />);

    fireEvent.change(screen.getByLabelText(/Ignored directories \/ paths/i), {
      target: { value: 'bad pattern!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save filters/i }));

    expect(mockUpdatePatterns).not.toHaveBeenCalled();
    expect(screen.getByText(/Invalid ignore patterns/i)).toBeInTheDocument();
  });
});
