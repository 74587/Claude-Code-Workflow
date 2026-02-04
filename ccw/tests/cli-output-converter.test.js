/**
 * CLI Output Converter - Streaming/Final de-duplication tests
 *
 * Runs against the shipped runtime in `ccw/dist`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createOutputParser, flattenOutputUnits } from '../dist/tools/cli-output-converter.js';

describe('cli-output-converter (streaming de-dup)', () => {
  it('normalizes cumulative Gemini delta frames into suffix deltas', () => {
    const parser = createOutputParser('json-lines');
    const ts0 = '2026-02-04T00:00:00.000Z';
    const ts1 = '2026-02-04T00:00:01.000Z';

    const input = [
      JSON.stringify({ type: 'message', timestamp: ts0, role: 'assistant', content: 'Hello', delta: true }),
      JSON.stringify({ type: 'message', timestamp: ts1, role: 'assistant', content: 'Hello world', delta: true }),
      '',
    ].join('\n');

    const units = parser.parse(Buffer.from(input, 'utf8'), 'stdout');

    assert.equal(units.length, 2);
    assert.equal(units[0].type, 'streaming_content');
    assert.equal(units[0].content, 'Hello');
    assert.equal(units[1].type, 'streaming_content');
    assert.equal(units[1].content, ' world');
  });

  it('skips non-delta final assistant frame after deltas (avoids stream duplication)', () => {
    const parser = createOutputParser('json-lines');
    const ts0 = '2026-02-04T00:00:00.000Z';
    const ts1 = '2026-02-04T00:00:01.000Z';
    const ts2 = '2026-02-04T00:00:02.000Z';

    const input = [
      JSON.stringify({ type: 'message', timestamp: ts0, role: 'assistant', content: 'Hello', delta: true }),
      JSON.stringify({ type: 'message', timestamp: ts1, role: 'assistant', content: ' world', delta: true }),
      // Some CLIs send a final non-delta message repeating the full content
      JSON.stringify({ type: 'message', timestamp: ts2, role: 'assistant', content: 'Hello world', delta: false }),
      '',
    ].join('\n');

    const units = parser.parse(Buffer.from(input, 'utf8'), 'stdout');
    assert.equal(units.some((u) => u.type === 'agent_message'), false);
    assert.equal(units.filter((u) => u.type === 'streaming_content').length, 2);

    const reconstructed = flattenOutputUnits(units, { includeTypes: ['agent_message'] });
    assert.equal(reconstructed, 'Hello world');
  });

  it('does not synthesize an extra agent_message when one already exists', () => {
    const units = [
      { type: 'streaming_content', content: 'a', timestamp: '2026-02-04T00:00:00.000Z' },
      { type: 'streaming_content', content: 'b', timestamp: '2026-02-04T00:00:01.000Z' },
      { type: 'agent_message', content: 'ab', timestamp: '2026-02-04T00:00:02.000Z' },
    ];

    const out = flattenOutputUnits(units, { includeTypes: ['agent_message'] });
    assert.equal(out, 'ab');
  });
});

