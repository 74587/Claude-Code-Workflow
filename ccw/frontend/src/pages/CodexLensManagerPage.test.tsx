// ========================================
// CodexLens Manager Page Tests (v2)
// ========================================
// Tests for v2 search management page

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { CodexLensManagerPage } from './CodexLensManagerPage';

// Mock the v2 search manager hook
vi.mock('@/hooks/useV2SearchManager', () => ({
  useV2SearchManager: vi.fn(),
}));

import { useV2SearchManager } from '@/hooks/useV2SearchManager';

const mockStatus = {
  indexed: true,
  totalFiles: 150,
  totalChunks: 1200,
  lastIndexedAt: '2026-03-17T10:00:00Z',
  dbSizeBytes: 5242880,
  vectorDimension: 384,
  ftsEnabled: true,
};

const defaultHookReturn = {
  status: mockStatus,
  isLoadingStatus: false,
  statusError: null,
  refetchStatus: vi.fn(),
  search: vi.fn().mockResolvedValue({
    query: 'test',
    results: [],
    timingMs: 12.5,
    totalResults: 0,
  }),
  isSearching: false,
  searchResult: null,
  reindex: vi.fn().mockResolvedValue(undefined),
  isReindexing: false,
};

describe('CodexLensManagerPage (v2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (vi.mocked(useV2SearchManager) as any).mockReturnValue(defaultHookReturn);
  });

  it('should render page title', () => {
    render(<CodexLensManagerPage />);
    // The title comes from i18n codexlens.title
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('should render index status section', () => {
    render(<CodexLensManagerPage />);
    // Check for file count display
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('should render search input', () => {
    render(<CodexLensManagerPage />);
    const input = screen.getByPlaceholderText(/search query/i);
    expect(input).toBeInTheDocument();
  });

  it('should call refetchStatus on refresh click', async () => {
    const refetchStatus = vi.fn();
    (vi.mocked(useV2SearchManager) as any).mockReturnValue({
      ...defaultHookReturn,
      refetchStatus,
    });

    const user = userEvent.setup();
    render(<CodexLensManagerPage />);

    const refreshButton = screen.getByText(/Refresh/i);
    await user.click(refreshButton);

    expect(refetchStatus).toHaveBeenCalledOnce();
  });

  it('should call search when clicking search button', async () => {
    const searchFn = vi.fn().mockResolvedValue({
      query: 'test query',
      results: [],
      timingMs: 5,
      totalResults: 0,
    });
    (vi.mocked(useV2SearchManager) as any).mockReturnValue({
      ...defaultHookReturn,
      search: searchFn,
    });

    const user = userEvent.setup();
    render(<CodexLensManagerPage />);

    const input = screen.getByPlaceholderText(/search query/i);
    await user.type(input, 'test query');

    const searchButton = screen.getByText(/Search/i);
    await user.click(searchButton);

    expect(searchFn).toHaveBeenCalledWith('test query');
  });

  it('should display search results', () => {
    (vi.mocked(useV2SearchManager) as any).mockReturnValue({
      ...defaultHookReturn,
      searchResult: {
        query: 'auth',
        results: [
          { file: 'src/auth.ts', score: 0.95, snippet: 'export function authenticate()' },
        ],
        timingMs: 8.2,
        totalResults: 1,
      },
    });

    render(<CodexLensManagerPage />);

    expect(screen.getByText('src/auth.ts')).toBeInTheDocument();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('export function authenticate()')).toBeInTheDocument();
  });

  it('should call reindex on button click', async () => {
    const reindexFn = vi.fn().mockResolvedValue(undefined);
    (vi.mocked(useV2SearchManager) as any).mockReturnValue({
      ...defaultHookReturn,
      reindex: reindexFn,
    });

    const user = userEvent.setup();
    render(<CodexLensManagerPage />);

    const reindexButton = screen.getByText(/Reindex/i);
    await user.click(reindexButton);

    expect(reindexFn).toHaveBeenCalledOnce();
  });

  it('should show loading skeleton when status is loading', () => {
    (vi.mocked(useV2SearchManager) as any).mockReturnValue({
      ...defaultHookReturn,
      status: null,
      isLoadingStatus: true,
    });

    render(<CodexLensManagerPage />);

    // Should have pulse animation elements
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('should show error alert when status fetch fails', () => {
    (vi.mocked(useV2SearchManager) as any).mockReturnValue({
      ...defaultHookReturn,
      status: null,
      statusError: new Error('Network error'),
    });

    render(<CodexLensManagerPage />);

    // Error message should be visible
    expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
  });

  it('should show not indexed state', () => {
    (vi.mocked(useV2SearchManager) as any).mockReturnValue({
      ...defaultHookReturn,
      status: {
        ...mockStatus,
        indexed: false,
        totalFiles: 0,
        totalChunks: 0,
      },
    });

    render(<CodexLensManagerPage />);

    expect(screen.getByText(/Not Indexed/i)).toBeInTheDocument();
  });

  describe('i18n - Chinese locale', () => {
    it('should display translated text in Chinese', () => {
      render(<CodexLensManagerPage />, { locale: 'zh' });

      // Page title from zh codexlens.json
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });
});
