/**
 * Regression test: language settings toggles must use csrfFetch()
 * (otherwise /api/language/* POSTs will fail with 403 CSRF validation failed).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('cli-manager language settings (CSRF)', () => {
  const source = readFileSync(
    new URL('../src/templates/dashboard-js/views/cli-manager.js', import.meta.url),
    'utf8'
  );

  it('uses csrfFetch() for /api/language/* POST requests', () => {
    assert.match(source, /await csrfFetch\('\/api\/language\/chinese-response',\s*\{/);
    assert.match(source, /await csrfFetch\('\/api\/language\/windows-platform',\s*\{/);
    assert.match(source, /await csrfFetch\('\/api\/language\/codex-cli-enhancement',\s*\{/);
  });

  it('does not use bare fetch() for /api/language/* POST requests', () => {
    assert.doesNotMatch(
      source,
      /await fetch\('\/api\/language\/chinese-response',\s*\{[\s\S]*?method:\s*'POST'/
    );
    assert.doesNotMatch(
      source,
      /await fetch\('\/api\/language\/windows-platform',\s*\{[\s\S]*?method:\s*'POST'/
    );
    assert.doesNotMatch(
      source,
      /await fetch\('\/api\/language\/codex-cli-enhancement',\s*\{[\s\S]*?method:\s*'POST'/
    );
  });
});

