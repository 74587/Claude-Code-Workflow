// ========================================
// Overview Tab Component Tests
// ========================================
// Tests for CodexLens Overview Tab component

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { OverviewTab } from './OverviewTab';
import type { CodexLensVenvStatus, CodexLensConfig } from '@/lib/api';

const mockStatus: CodexLensVenvStatus = {
  ready: true,
  installed: true,
  version: '1.0.0',
  pythonVersion: '3.11.0',
  venvPath: '/path/to/venv',
};

const mockConfig: CodexLensConfig = {
  index_dir: '~/.codexlens/indexes',
  index_count: 100,
  api_max_workers: 4,
  api_batch_size: 8,
};

// Mock window.alert
global.alert = vi.fn();

describe('OverviewTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when installed and ready', () => {
    const defaultProps = {
      installed: true,
      status: mockStatus,
      config: mockConfig,
      isLoading: false,
    };

    it('should render status cards', () => {
      render(<OverviewTab {...defaultProps} />);

      expect(screen.getByText(/Installation Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Ready/i)).toBeInTheDocument();
      expect(screen.getByText(/Version/i)).toBeInTheDocument();
      expect(screen.getByText(/1.0.0/i)).toBeInTheDocument();
    });

    it('should render index path with full path in title', () => {
      render(<OverviewTab {...defaultProps} />);

      const indexPath = screen.getByText(/Index Path/i).nextElementSibling as HTMLElement;
      expect(indexPath).toHaveTextContent('~/.codexlens/indexes');
      expect(indexPath).toHaveAttribute('title', '~/.codexlens/indexes');
    });

    it('should render index count', () => {
      render(<OverviewTab {...defaultProps} />);

      expect(screen.getByText(/Index Count/i)).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should render quick actions section', () => {
      render(<OverviewTab {...defaultProps} />);

      expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
      expect(screen.getByText(/FTS Full/i)).toBeInTheDocument();
      expect(screen.getByText(/FTS Incremental/i)).toBeInTheDocument();
      expect(screen.getByText(/Vector Full/i)).toBeInTheDocument();
      expect(screen.getByText(/Vector Incremental/i)).toBeInTheDocument();
    });

    it('should render venv details section', () => {
      render(<OverviewTab {...defaultProps} />);

      expect(screen.getByText(/Python Virtual Environment Details/i)).toBeInTheDocument();
      expect(screen.getByText(/Python Version/i)).toBeInTheDocument();
      expect(screen.getByText(/3.11.0/i)).toBeInTheDocument();
    });

    it('should show coming soon alert when action clicked', async () => {
      const user = userEvent.setup();
      render(<OverviewTab {...defaultProps} />);

      const ftsFullButton = screen.getByText(/FTS Full/i);
      await user.click(ftsFullButton);

      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Coming Soon'));
    });
  });

  describe('when installed but not ready', () => {
    const notReadyProps = {
      installed: true,
      status: { ...mockStatus, ready: false },
      config: mockConfig,
      isLoading: false,
    };

    it('should show not ready status', () => {
      render(<OverviewTab {...notReadyProps} />);

      expect(screen.getByText(/Not Ready/i)).toBeInTheDocument();
    });

    it('should disable action buttons when not ready', () => {
      render(<OverviewTab {...notReadyProps} />);

      const ftsFullButton = screen.getByText(/FTS Full/i).closest('button');
      expect(ftsFullButton).toBeDisabled();
    });
  });

  describe('when not installed', () => {
    const notInstalledProps = {
      installed: false,
      status: undefined,
      config: undefined,
      isLoading: false,
    };

    it('should show not installed message', () => {
      render(<OverviewTab {...notInstalledProps} />);

      expect(screen.getByText(/CodexLens Not Installed/i)).toBeInTheDocument();
      expect(screen.getByText(/Please install CodexLens to use semantic code search features/i)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton', () => {
      const { container } = render(
        <OverviewTab
          installed={false}
          status={undefined}
          config={undefined}
          isLoading={true}
        />
      );

      // Check for pulse/skeleton elements
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('i18n - Chinese locale', () => {
    const defaultProps = {
      installed: true,
      status: mockStatus,
      config: mockConfig,
      isLoading: false,
    };

    it('should display translated text in Chinese', () => {
      render(<OverviewTab {...defaultProps} />, { locale: 'zh' });

      expect(screen.getByText(/安装状态/i)).toBeInTheDocument();
      expect(screen.getByText(/就绪/i)).toBeInTheDocument();
      expect(screen.getByText(/版本/i)).toBeInTheDocument();
      expect(screen.getByText(/索引路径/i)).toBeInTheDocument();
      expect(screen.getByText(/索引数量/i)).toBeInTheDocument();
      expect(screen.getByText(/快速操作/i)).toBeInTheDocument();
      expect(screen.getByText(/Python 虚拟环境详情/i)).toBeInTheDocument();
    });

    it('should translate action buttons', () => {
      render(<OverviewTab {...defaultProps} />, { locale: 'zh' });

      expect(screen.getByText(/FTS 全量/i)).toBeInTheDocument();
      expect(screen.getByText(/FTS 增量/i)).toBeInTheDocument();
      expect(screen.getByText(/向量全量/i)).toBeInTheDocument();
      expect(screen.getByText(/向量增量/i)).toBeInTheDocument();
    });
  });

  describe('status card colors', () => {
    it('should show success color when ready', () => {
      const { container } = render(
        <OverviewTab
          installed={true}
          status={mockStatus}
          config={mockConfig}
          isLoading={false}
        />
      );

      // Check for success/ready indication (check icon or success color)
      const statusCard = container.querySelector('.bg-success\\/10');
      expect(statusCard).toBeInTheDocument();
    });

    it('should show warning color when not ready', () => {
      const { container } = render(
        <OverviewTab
          installed={true}
          status={{ ...mockStatus, ready: false }}
          config={mockConfig}
          isLoading={false}
        />
      );

      // Check for warning/not ready indication
      const statusCard = container.querySelector('.bg-warning\\/10');
      expect(statusCard).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing status gracefully', () => {
      render(
        <OverviewTab
          installed={true}
          status={undefined}
          config={mockConfig}
          isLoading={false}
        />
      );

      // Should not crash and render available data
      expect(screen.getByText(/Version/i)).toBeInTheDocument();
    });

    it('should handle missing config gracefully', () => {
      render(
        <OverviewTab
          installed={true}
          status={mockStatus}
          config={undefined}
          isLoading={false}
        />
      );

      // Should not crash and render available data
      expect(screen.getByText(/Installation Status/i)).toBeInTheDocument();
    });

    it('should handle empty index path', () => {
      const emptyConfig: CodexLensConfig = {
        index_dir: '',
        index_count: 0,
        api_max_workers: 4,
        api_batch_size: 8,
      };

      render(
        <OverviewTab
          installed={true}
          status={mockStatus}
          config={emptyConfig}
          isLoading={false}
        />
      );

      expect(screen.getByText(/Index Path/i)).toBeInTheDocument();
    });

    it('should handle unknown version', () => {
      const unknownVersionStatus: CodexLensVenvStatus = {
        ...mockStatus,
        version: '',
      };

      render(
        <OverviewTab
          installed={true}
          status={unknownVersionStatus}
          config={mockConfig}
          isLoading={false}
        />
      );

      expect(screen.getByText(/Version/i)).toBeInTheDocument();
    });
  });
});
