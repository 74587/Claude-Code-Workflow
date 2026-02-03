// ========================================
// Settings Tab Component Tests
// ========================================
// Tests for CodexLens Settings Tab component with form validation

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { SettingsTab } from './SettingsTab';
import type { CodexLensConfig } from '@/lib/api';

// Mock hooks - use importOriginal to preserve all exports
vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useCodexLensConfig: vi.fn(),
    useUpdateCodexLensConfig: vi.fn(),
    useNotifications: vi.fn(() => ({
      toasts: [],
      wsStatus: 'disconnected' as const,
      wsLastMessage: null,
      isWsConnected: false,
      isPanelVisible: false,
      persistentNotifications: [],
      addToast: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      removeToast: vi.fn(),
      clearAllToasts: vi.fn(),
      setWsStatus: vi.fn(),
      setWsLastMessage: vi.fn(),
      togglePanel: vi.fn(),
      setPanelVisible: vi.fn(),
      addPersistentNotification: vi.fn(),
      removePersistentNotification: vi.fn(),
      clearPersistentNotifications: vi.fn(),
    })),
  };
});

import { useCodexLensConfig, useUpdateCodexLensConfig, useNotifications } from '@/hooks';

const mockConfig: CodexLensConfig = {
  index_dir: '~/.codexlens/indexes',
  index_count: 100,
  api_max_workers: 4,
  api_batch_size: 8,
};

describe('SettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when enabled and config loaded', () => {
    beforeEach(() => {
      vi.mocked(useCodexLensConfig).mockReturnValue({
        config: mockConfig,
        indexDir: mockConfig.index_dir,
        indexCount: 100,
        apiMaxWorkers: 4,
        apiBatchSize: 8,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useUpdateCodexLensConfig).mockReturnValue({
        updateConfig: vi.fn().mockResolvedValue({ success: true, message: 'Saved' }),
        isUpdating: false,
        error: null,
      });
    });

    it('should render current info card', () => {
      render(<SettingsTab enabled={true} />);

      expect(screen.getByText(/Current Index Count/i)).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText(/Current Workers/i)).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText(/Current Batch Size/i)).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('should render configuration form', () => {
      render(<SettingsTab enabled={true} />);

      expect(screen.getByText(/Basic Configuration/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Index Directory/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Max Workers/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Batch Size/i)).toBeInTheDocument();
    });

    it('should initialize form with config values', () => {
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i) as HTMLInputElement;
      const maxWorkersInput = screen.getByLabelText(/Max Workers/i) as HTMLInputElement;
      const batchSizeInput = screen.getByLabelText(/Batch Size/i) as HTMLInputElement;

      expect(indexDirInput.value).toBe('~/.codexlens/indexes');
      expect(maxWorkersInput.value).toBe('4');
      expect(batchSizeInput.value).toBe('8');
    });

    it('should show save button enabled when changes are made', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);
      await user.type(indexDirInput, '/new/index/path');

      const saveButton = screen.getByText(/Save/i);
      expect(saveButton).toBeEnabled();
    });

    it('should disable save and reset buttons when no changes', () => {
      render(<SettingsTab enabled={true} />);

      const saveButton = screen.getByText(/Save/i);
      const resetButton = screen.getByText(/Reset/i);

      expect(saveButton).toBeDisabled();
      expect(resetButton).toBeDisabled();
    });

    it('should call updateConfig on save', async () => {
      const updateConfig = vi.fn().mockResolvedValue({ success: true, message: 'Saved' });
      vi.mocked(useUpdateCodexLensConfig).mockReturnValue({
        updateConfig,
        isUpdating: false,
        error: null,
      });

      const success = vi.fn();
      vi.mocked(useNotifications).mockReturnValue({
        toasts: [],
        wsStatus: 'disconnected' as const,
        wsLastMessage: null,
        isWsConnected: false,
        isPanelVisible: false,
        persistentNotifications: [],
        addToast: vi.fn(),
        info: vi.fn(),
        success,
        warning: vi.fn(),
        error: vi.fn(),
        removeToast: vi.fn(),
        clearAllToasts: vi.fn(),
        setWsStatus: vi.fn(),
        setWsLastMessage: vi.fn(),
        togglePanel: vi.fn(),
        setPanelVisible: vi.fn(),
        addPersistentNotification: vi.fn(),
        removePersistentNotification: vi.fn(),
        clearPersistentNotifications: vi.fn(),
      });

      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);
      await user.type(indexDirInput, '/new/index/path');

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      await waitFor(() => {
        expect(updateConfig).toHaveBeenCalledWith({
          index_dir: '/new/index/path',
          api_max_workers: 4,
          api_batch_size: 8,
        });
      });
    });

    it('should reset form on reset button click', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i) as HTMLInputElement;
      await user.clear(indexDirInput);
      await user.type(indexDirInput, '/new/index/path');

      expect(indexDirInput.value).toBe('/new/index/path');

      const resetButton = screen.getByText(/Reset/i);
      await user.click(resetButton);

      expect(indexDirInput.value).toBe('~/.codexlens/indexes');
    });
  });

  describe('form validation', () => {
    beforeEach(() => {
      vi.mocked(useCodexLensConfig).mockReturnValue({
        config: mockConfig,
        indexDir: mockConfig.index_dir,
        indexCount: 100,
        apiMaxWorkers: 4,
        apiBatchSize: 8,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useUpdateCodexLensConfig).mockReturnValue({
        updateConfig: vi.fn().mockResolvedValue({ success: true }),
        isUpdating: false,
        error: null,
      });
    });

    it('should validate index dir is required', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      expect(screen.getByText(/Index directory is required/i)).toBeInTheDocument();
    });

    it('should validate max workers range (1-32)', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const maxWorkersInput = screen.getByLabelText(/Max Workers/i);
      await user.clear(maxWorkersInput);
      await user.type(maxWorkersInput, '0');

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      expect(screen.getByText(/Workers must be between 1 and 32/i)).toBeInTheDocument();
    });

    it('should validate max workers upper bound', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const maxWorkersInput = screen.getByLabelText(/Max Workers/i);
      await user.clear(maxWorkersInput);
      await user.type(maxWorkersInput, '33');

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      expect(screen.getByText(/Workers must be between 1 and 32/i)).toBeInTheDocument();
    });

    it('should validate batch size range (1-64)', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const batchSizeInput = screen.getByLabelText(/Batch Size/i);
      await user.clear(batchSizeInput);
      await user.type(batchSizeInput, '0');

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      expect(screen.getByText(/Batch size must be between 1 and 64/i)).toBeInTheDocument();
    });

    it('should validate batch size upper bound', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const batchSizeInput = screen.getByLabelText(/Batch Size/i);
      await user.clear(batchSizeInput);
      await user.type(batchSizeInput, '65');

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      expect(screen.getByText(/Batch size must be between 1 and 64/i)).toBeInTheDocument();
    });

    it('should clear error when user fixes invalid input', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      expect(screen.getByText(/Index directory is required/i)).toBeInTheDocument();

      await user.type(indexDirInput, '/valid/path');

      expect(screen.queryByText(/Index directory is required/i)).not.toBeInTheDocument();
    });
  });

  describe('when disabled', () => {
    beforeEach(() => {
      vi.mocked(useCodexLensConfig).mockReturnValue({
        config: mockConfig,
        indexDir: mockConfig.index_dir,
        indexCount: 100,
        apiMaxWorkers: 4,
        apiBatchSize: 8,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useUpdateCodexLensConfig).mockReturnValue({
        updateConfig: vi.fn().mockResolvedValue({ success: true }),
        isUpdating: false,
        error: null,
      });
    });

    it('should not render when enabled is false', () => {
      render(<SettingsTab enabled={false} />);

      // When not enabled, the component may render nothing or an empty state
      // This test documents the expected behavior
      expect(screen.queryByText(/Basic Configuration/i)).not.toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('should disable inputs when loading config', () => {
      vi.mocked(useCodexLensConfig).mockReturnValue({
        config: mockConfig,
        indexDir: mockConfig.index_dir,
        indexCount: 100,
        apiMaxWorkers: 4,
        apiBatchSize: 8,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useUpdateCodexLensConfig).mockReturnValue({
        updateConfig: vi.fn().mockResolvedValue({ success: true }),
        isUpdating: false,
        error: null,
      });

      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      expect(indexDirInput).toBeDisabled();
    });

    it('should show saving state when updating', async () => {
      vi.mocked(useCodexLensConfig).mockReturnValue({
        config: mockConfig,
        indexDir: mockConfig.index_dir,
        indexCount: 100,
        apiMaxWorkers: 4,
        apiBatchSize: 8,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useUpdateCodexLensConfig).mockReturnValue({
        updateConfig: vi.fn().mockResolvedValue({ success: true }),
        isUpdating: true,
        error: null,
      });

      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);
      await user.type(indexDirInput, '/new/path');

      const saveButton = screen.getByText(/Saving/i);
      expect(saveButton).toBeInTheDocument();
    });
  });

  describe('i18n - Chinese locale', () => {
    beforeEach(() => {
      vi.mocked(useCodexLensConfig).mockReturnValue({
        config: mockConfig,
        indexDir: mockConfig.index_dir,
        indexCount: 100,
        apiMaxWorkers: 4,
        apiBatchSize: 8,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useUpdateCodexLensConfig).mockReturnValue({
        updateConfig: vi.fn().mockResolvedValue({ success: true }),
        isUpdating: false,
        error: null,
      });
    });

    it('should display translated labels', () => {
      render(<SettingsTab enabled={true} />, { locale: 'zh' });

      expect(screen.getByText(/当前索引数量/i)).toBeInTheDocument();
      expect(screen.getByText(/当前工作线程/i)).toBeInTheDocument();
      expect(screen.getByText(/当前批次大小/i)).toBeInTheDocument();
      expect(screen.getByText(/基本配置/i)).toBeInTheDocument();
      expect(screen.getByText(/索引目录/i)).toBeInTheDocument();
      expect(screen.getByText(/最大工作线程/i)).toBeInTheDocument();
      expect(screen.getByText(/批次大小/i)).toBeInTheDocument();
      expect(screen.getByText(/保存/i)).toBeInTheDocument();
      expect(screen.getByText(/重置/i)).toBeInTheDocument();
    });

    it('should display translated validation errors', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />, { locale: 'zh' });

      const indexDirInput = screen.getByLabelText(/索引目录/i);
      await user.clear(indexDirInput);

      const saveButton = screen.getByText(/保存/i);
      await user.click(saveButton);

      expect(screen.getByText(/索引目录不能为空/i)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should show error notification on save failure', async () => {
      const error = vi.fn();
      vi.mocked(useNotifications).mockReturnValue({
        toasts: [],
        wsStatus: 'disconnected' as const,
        wsLastMessage: null,
        isWsConnected: false,
        isPanelVisible: false,
        persistentNotifications: [],
        addToast: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error,
        removeToast: vi.fn(),
        clearAllToasts: vi.fn(),
        setWsStatus: vi.fn(),
        setWsLastMessage: vi.fn(),
        togglePanel: vi.fn(),
        setPanelVisible: vi.fn(),
        addPersistentNotification: vi.fn(),
        removePersistentNotification: vi.fn(),
        clearPersistentNotifications: vi.fn(),
      });
      vi.mocked(useCodexLensConfig).mockReturnValue({
        config: mockConfig,
        indexDir: mockConfig.index_dir,
        indexCount: 100,
        apiMaxWorkers: 4,
        apiBatchSize: 8,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useUpdateCodexLensConfig).mockReturnValue({
        updateConfig: vi.fn().mockResolvedValue({ success: false, message: 'Save failed' }),
        isUpdating: false,
        error: null,
      });

      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);
      await user.type(indexDirInput, '/new/path');

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      await waitFor(() => {
        expect(error).toHaveBeenCalledWith(
          expect.stringContaining('Save failed'),
          expect.any(String)
        );
      });
    });
  });
});
