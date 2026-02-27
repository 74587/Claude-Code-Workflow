// ========================================
// CcwToolsMcpCard Component Tests
// ========================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/i18n';
import userEvent from '@testing-library/user-event';

import { CcwToolsMcpCard } from './CcwToolsMcpCard';
import { updateCcwConfig, updateCcwConfigForCodex } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  installCcwMcp: vi.fn(),
  uninstallCcwMcp: vi.fn(),
  updateCcwConfig: vi.fn(),
  installCcwMcpToCodex: vi.fn(),
  uninstallCcwMcpFromCodex: vi.fn(),
  updateCcwConfigForCodex: vi.fn(),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('CcwToolsMcpCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves enabledTools when saving config (Codex)', async () => {
    const updateCodexMock = vi.mocked(updateCcwConfigForCodex);
    updateCodexMock.mockResolvedValue({
      isInstalled: true,
      enabledTools: [],
      installedScopes: ['global'],
    });

    render(
      <CcwToolsMcpCard
        target="codex"
        isInstalled={true}
        enabledTools={['write_file', 'read_many_files']}
        onToggleTool={vi.fn()}
        onUpdateConfig={vi.fn()}
        onInstall={vi.fn()}
      />,
      { locale: 'en' }
    );

    const user = userEvent.setup();
    await user.click(screen.getByText(/CCW MCP Server|mcp\.ccw\.title/i));
    await user.click(
      screen.getByRole('button', { name: /Save Configuration|mcp\.ccw\.actions\.saveConfig/i })
    );

    await waitFor(() => {
      expect(updateCodexMock).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledTools: ['write_file', 'read_many_files'],
        })
      );
    });
  });

  it('preserves enabledTools when saving config (Claude)', async () => {
    const updateClaudeMock = vi.mocked(updateCcwConfig);
    updateClaudeMock.mockResolvedValue({
      isInstalled: true,
      enabledTools: [],
      installedScopes: ['global'],
    });

    render(
      <CcwToolsMcpCard
        isInstalled={true}
        enabledTools={['write_file', 'smart_search']}
        onToggleTool={vi.fn()}
        onUpdateConfig={vi.fn()}
        onInstall={vi.fn()}
      />,
      { locale: 'en' }
    );

    const user = userEvent.setup();
    await user.click(screen.getByText(/CCW MCP Server|mcp\.ccw\.title/i));
    await user.click(
      screen.getByRole('button', { name: /Save Configuration|mcp\.ccw\.actions\.saveConfig/i })
    );

    await waitFor(() => {
      expect(updateClaudeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledTools: ['write_file', 'smart_search'],
        })
      );
    });
  });
});

