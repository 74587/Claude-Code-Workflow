// ========================================
// Config Store Tests
// ========================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CONFIG_STORE_MODULE_PATH = './configStore';

describe('configStore backend sync', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not fetch backend config during module import', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await import(CONFIG_STORE_MODULE_PATH);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('syncs backend config explicitly with an absolute URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        config: {
          tools: {
            codex: {
              enabled: true,
              primaryModel: 'gpt-5',
              secondaryModel: 'gpt-5-mini',
              tags: ['analysis', 'debug'],
              type: 'builtin',
              envFile: '.env.codex',
              settingsFile: 'codex.settings.json',
              availableModels: ['gpt-5', 'gpt-5-mini'],
            },
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { syncConfigStoreFromBackend, useConfigStore } = await import(CONFIG_STORE_MODULE_PATH);

    await syncConfigStoreFromBackend(true);

    expect(fetchMock).toHaveBeenCalledWith(`${window.location.origin}/api/cli/config`);
    expect(useConfigStore.getState().cliTools.codex).toMatchObject({
      enabled: true,
      primaryModel: 'gpt-5',
      secondaryModel: 'gpt-5-mini',
      tags: ['analysis', 'debug'],
      type: 'builtin',
      envFile: '.env.codex',
      settingsFile: 'codex.settings.json',
      availableModels: ['gpt-5', 'gpt-5-mini'],
    });
  });
});
