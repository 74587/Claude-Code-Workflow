#!/usr/bin/env node

/**
 * Root package CLI entrypoint for npm global installs.
 * Keeps npm-generated shims stable even if internal package layout changes.
 */

import { run } from '../ccw/dist/cli.js';

await run(process.argv);
