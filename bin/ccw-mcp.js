#!/usr/bin/env node
/**
 * Root package MCP server entrypoint for npm global installs.
 * Avoids coupling the npm shim to nested internal bin paths.
 */

const toStderr = (...args) => console.error(...args);
console.log = toStderr;
console.info = toStderr;
console.debug = toStderr;
console.dir = toStderr;

try {
  await import('../ccw/dist/mcp-server/index.js');
} catch (err) {
  console.error('[ccw-mcp] Failed to start MCP server:', err);
  process.exit(1);
}
