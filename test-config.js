const { getToolConfig } = require('./ccw/dist/tools/claude-cli-tools.js');

const workingDir = 'D:\\Claude_dms3';
const tool = 'claude';

const config = getToolConfig(workingDir, tool);
console.log('Claude tool config:', JSON.stringify(config, null, 2));
