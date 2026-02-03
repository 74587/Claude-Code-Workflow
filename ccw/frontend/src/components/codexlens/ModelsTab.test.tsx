// ========================================
// Models Tab Component Tests
// ========================================
// Tests for CodexLens Models Tab component

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { ModelsTab } from './ModelsTab';
import type { CodexLensModel } from '@/lib/api';

// Mock hooks - use importOriginal to preserve all exports
vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useCodexLensModels: vi.fn(),
    useCodexLensMutations: vi.fn(),
  };
});

import { useCodexLensModels, useCodexLensMutations } from '@/hooks';

const mockModels: CodexLensModel[] = [
  {
    profile: 'embedding1',
    name: 'BAAI/bge-small-en-v1.5',
    type: 'embedding',
    backend: 'onnx',
    installed: true,
    cache_path: '/cache/embedding1',
  },
  {
    profile: 'reranker1',
    name: 'BAAI/bge-reranker-v2-m3',
    type: 'reranker',
    backend: 'onnx',
    installed: false,
    cache_path: '/cache/reranker1',
  },
  {
    profile: 'embedding2',
    name: 'sentence-transformers/all-MiniLM-L6-v2',
    type: 'embedding',
    backend: 'torch',
    installed: false,
    cache_path: '/cache/embedding2',
  },
];

const mockMutations = {
  updateConfig: vi.fn().mockResolvedValue({ success: true }) as any,
  isUpdatingConfig: false,
  bootstrap: vi.fn().mockResolvedValue({ success: true }) as any,
  isBootstrapping: false,
  installSemantic: vi.fn().mockResolvedValue({ success: true }) as any,
  isInstallingSemantic: false,
  uninstall: vi.fn().mockResolvedValue({ success: true }) as any,
  isUninstalling: false,
  downloadModel: vi.fn().mockResolvedValue({ success: true }) as any,
  downloadCustomModel: vi.fn().mockResolvedValue({ success: true }) as any,
  isDownloading: false,
  deleteModel: vi.fn().mockResolvedValue({ success: true }) as any,
  deleteModelByPath: vi.fn().mockResolvedValue({ success: true }) as any,
  isDeleting: false,
  updateEnv: vi.fn().mockResolvedValue({ success: true, env: {}, settings: {}, raw: '' }) as any,
  isUpdatingEnv: false,
  selectGpu: vi.fn().mockResolvedValue({ success: true }) as any,
  resetGpu: vi.fn().mockResolvedValue({ success: true }) as any,
  isSelectingGpu: false,
  updatePatterns: vi.fn().mockResolvedValue({ patterns: [], extensionFilters: [], defaults: {} }) as any,
  isUpdatingPatterns: false,
  rebuildIndex: vi.fn().mockResolvedValue({ success: true }) as any,
  isRebuildingIndex: false,
  updateIndex: vi.fn().mockResolvedValue({ success: true }) as any,
  isUpdatingIndex: false,
  cancelIndexing: vi.fn().mockResolvedValue({ success: true }) as any,
  isCancellingIndexing: false,
  isMutating: false,
};

describe('ModelsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when installed', () => {
    beforeEach(() => {
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: mockModels,
        embeddingModels: mockModels.filter(m => m.type === 'embedding'),
        rerankerModels: mockModels.filter(m => m.type === 'reranker'),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensMutations).mockReturnValue(mockMutations);
    });

    it('should render search input', () => {
      render(<ModelsTab installed={true} />);

      expect(screen.getByPlaceholderText(/Search models/i)).toBeInTheDocument();
    });

    it('should render filter buttons with counts', () => {
      render(<ModelsTab installed={true} />);

      expect(screen.getByText(/All/)).toBeInTheDocument();
      expect(screen.getByText(/Embedding Models/)).toBeInTheDocument();
      expect(screen.getByText(/Reranker Models/)).toBeInTheDocument();
      expect(screen.getByText(/Downloaded/)).toBeInTheDocument();
      expect(screen.getByText(/Available/)).toBeInTheDocument();
    });

    it('should render model list', () => {
      render(<ModelsTab installed={true} />);

      expect(screen.getByText('BAAI/bge-small-en-v1.5')).toBeInTheDocument();
      expect(screen.getByText('BAAI/bge-reranker-v2-m3')).toBeInTheDocument();
      expect(screen.getByText('sentence-transformers/all-MiniLM-L6-v2')).toBeInTheDocument();
    });

    it('should filter models by search query', async () => {
      const user = userEvent.setup();
      render(<ModelsTab installed={true} />);

      const searchInput = screen.getByPlaceholderText(/Search models/i);
      await user.type(searchInput, 'bge');

      expect(screen.getByText('BAAI/bge-small-en-v1.5')).toBeInTheDocument();
      expect(screen.getByText('BAAI/bge-reranker-v2-m3')).toBeInTheDocument();
      expect(screen.queryByText('sentence-transformers/all-MiniLM-L6-v2')).not.toBeInTheDocument();
    });

    it('should filter by embedding type', async () => {
      const user = userEvent.setup();
      render(<ModelsTab installed={true} />);

      const embeddingButton = screen.getByText(/Embedding Models/i);
      await user.click(embeddingButton);

      expect(screen.getByText('BAAI/bge-small-en-v1.5')).toBeInTheDocument();
      expect(screen.queryByText('BAAI/bge-reranker-v2-m3')).not.toBeInTheDocument();
    });

    it('should filter by reranker type', async () => {
      const user = userEvent.setup();
      render(<ModelsTab installed={true} />);

      const rerankerButton = screen.getByText(/Reranker Models/i);
      await user.click(rerankerButton);

      expect(screen.getByText('BAAI/bge-reranker-v2-m3')).toBeInTheDocument();
      expect(screen.queryByText('BAAI/bge-small-en-v1.5')).not.toBeInTheDocument();
    });

    it('should filter by downloaded status', async () => {
      const user = userEvent.setup();
      render(<ModelsTab installed={true} />);

      const downloadedButton = screen.getByText(/Downloaded/i);
      await user.click(downloadedButton);

      expect(screen.getByText('BAAI/bge-small-en-v1.5')).toBeInTheDocument();
      expect(screen.queryByText('BAAI/bge-reranker-v2-m3')).not.toBeInTheDocument();
    });

    it('should filter by available status', async () => {
      const user = userEvent.setup();
      render(<ModelsTab installed={true} />);

      const availableButton = screen.getByText(/Available/i);
      await user.click(availableButton);

      expect(screen.getByText('BAAI/bge-reranker-v2-m3')).toBeInTheDocument();
      expect(screen.queryByText('BAAI/bge-small-en-v1.5')).not.toBeInTheDocument();
    });

    it('should call downloadModel when download clicked', async () => {
      const downloadModel = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(useCodexLensMutations).mockReturnValue({
        ...mockMutations,
        downloadModel,
      });

      const user = userEvent.setup();
      render(<ModelsTab installed={true} />);

      // Filter to show available models
      const availableButton = screen.getByText(/Available/i);
      await user.click(availableButton);

      const downloadButton = screen.getAllByText(/Download/i)[0];
      await user.click(downloadButton);

      await waitFor(() => {
        expect(downloadModel).toHaveBeenCalled();
      });
    });

    it('should refresh models on refresh button click', async () => {
      const refetch = vi.fn();
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: mockModels,
        embeddingModels: mockModels.filter(m => m.type === 'embedding'),
        rerankerModels: mockModels.filter(m => m.type === 'reranker'),
        isLoading: false,
        error: null,
        refetch,
      });

      const user = userEvent.setup();
      render(<ModelsTab installed={true} />);

      const refreshButton = screen.getByText(/Refresh/i);
      await user.click(refreshButton);

      expect(refetch).toHaveBeenCalledOnce();
    });
  });

  describe('when not installed', () => {
    beforeEach(() => {
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: undefined,
        embeddingModels: undefined,
        rerankerModels: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensMutations).mockReturnValue(mockMutations);
    });

    it('should show not installed message', () => {
      render(<ModelsTab installed={false} />);

      expect(screen.getByText(/CodexLens Not Installed/i)).toBeInTheDocument();
      expect(screen.getByText(/Please install CodexLens to use model management features/i)).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('should show loading state', () => {
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: undefined,
        embeddingModels: undefined,
        rerankerModels: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensMutations).mockReturnValue(mockMutations);

      render(<ModelsTab installed={true} />);

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('should show empty state when no models', () => {
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: [],
        embeddingModels: [],
        rerankerModels: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensMutations).mockReturnValue(mockMutations);

      render(<ModelsTab installed={true} />);

      expect(screen.getByText(/No models found/i)).toBeInTheDocument();
      expect(screen.getByText(/Try adjusting your search or filter criteria/i)).toBeInTheDocument();
    });

    it('should show empty state when search returns no results', async () => {
      const user = userEvent.setup();
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: mockModels,
        embeddingModels: mockModels.filter(m => m.type === 'embedding'),
        rerankerModels: mockModels.filter(m => m.type === 'reranker'),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensMutations).mockReturnValue(mockMutations);

      render(<ModelsTab installed={true} />);

      const searchInput = screen.getByPlaceholderText(/Search models/i);
      await user.type(searchInput, 'nonexistent-model');

      expect(screen.getByText(/No models found/i)).toBeInTheDocument();
    });
  });

  describe('i18n - Chinese locale', () => {
    beforeEach(() => {
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: mockModels,
        embeddingModels: mockModels.filter(m => m.type === 'embedding'),
        rerankerModels: mockModels.filter(m => m.type === 'reranker'),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensMutations).mockReturnValue(mockMutations);
    });

    it('should display translated text', () => {
      render(<ModelsTab installed={true} />, { locale: 'zh' });

      expect(screen.getByPlaceholderText(/搜索模型/i)).toBeInTheDocument();
      expect(screen.getByText(/筛选/i)).toBeInTheDocument();
      expect(screen.getByText(/全部/i)).toBeInTheDocument();
      expect(screen.getByText(/嵌入模型/i)).toBeInTheDocument();
      expect(screen.getByText(/重排序模型/i)).toBeInTheDocument();
      expect(screen.getByText(/已下载/i)).toBeInTheDocument();
      expect(screen.getByText(/可用/i)).toBeInTheDocument();
      expect(screen.getByText(/刷新/i)).toBeInTheDocument();
    });

    it('should translate empty state', () => {
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: [],
        embeddingModels: [],
        rerankerModels: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensMutations).mockReturnValue(mockMutations);

      render(<ModelsTab installed={true} />, { locale: 'zh' });

      expect(screen.getByText(/没有找到模型/i)).toBeInTheDocument();
      expect(screen.getByText(/尝试调整搜索或筛选条件/i)).toBeInTheDocument();
    });

    it('should translate not installed state', () => {
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: undefined,
        embeddingModels: undefined,
        rerankerModels: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensMutations).mockReturnValue(mockMutations);

      render(<ModelsTab installed={false} />, { locale: 'zh' });

      expect(screen.getByText(/CodexLens 未安装/i)).toBeInTheDocument();
    });
  });

  describe('custom model input', () => {
    beforeEach(() => {
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: mockModels,
        embeddingModels: mockModels.filter(m => m.type === 'embedding'),
        rerankerModels: mockModels.filter(m => m.type === 'reranker'),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensMutations).mockReturnValue(mockMutations);
    });

    it('should render custom model input section', () => {
      render(<ModelsTab installed={true} />);

      expect(screen.getByText(/Custom Model/i)).toBeInTheDocument();
    });

    it('should translate custom model section in Chinese', () => {
      render(<ModelsTab installed={true} />, { locale: 'zh' });

      expect(screen.getByText(/自定义模型/i)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', () => {
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: mockModels,
        embeddingModels: mockModels.filter(m => m.type === 'embedding'),
        rerankerModels: mockModels.filter(m => m.type === 'reranker'),
        isLoading: false,
        error: new Error('API Error'),
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensMutations).mockReturnValue(mockMutations);

      render(<ModelsTab installed={true} />);

      // Component should still render despite error
      expect(screen.getByText(/BAAI\/bge-small-en-v1.5/i)).toBeInTheDocument();
    });
  });
});
