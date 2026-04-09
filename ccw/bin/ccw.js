#!/usr/bin/env node

/**
 * CCW CLI - Claude Code Workflow Dashboard
 * Entry point for global CLI installation
 */

import { run } from '../dist/cli.js';

await run(process.argv);
