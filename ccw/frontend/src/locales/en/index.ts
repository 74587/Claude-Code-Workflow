/**
 * English translations
 * Consolidated exports for all English translation files
 */

import common from './common.json';
import navigation from './navigation.json';
import sessions from './sessions.json';
import issues from './issues.json';
import home from './home.json';
import orchestrator from './orchestrator.json';
import loops from './loops.json';
import commands from './commands.json';
import memory from './memory.json';
import settings from './settings.json';
import fixSession from './fix-session.json';
import history from './history.json';
import liteTasks from './lite-tasks.json';
import projectOverview from './project-overview.json';
import reviewSession from './review-session.json';
import sessionDetail from './session-detail.json';
import skills from './skills.json';
import cliManager from './cli-manager.json';
import mcpManager from './mcp-manager.json';

/**
 * Flattens nested JSON object to dot-separated keys
 * e.g., { actions: { save: 'Save' } } => { 'actions.save': 'Save' }
 */
function flattenMessages(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenMessages(value as Record<string, unknown>, fullKey));
    } else if (typeof value === 'string') {
      result[fullKey] = value;
    }
  }

  return result;
}

/**
 * Consolidated and flattened English messages
 */
export default {
  ...flattenMessages(common, 'common'),
  ...flattenMessages(navigation, 'navigation'),
  ...flattenMessages(sessions, 'sessions'),
  ...flattenMessages(issues, 'issues'),
  ...flattenMessages(home, 'home'),
  ...flattenMessages(orchestrator, 'orchestrator'),
  ...flattenMessages(loops, 'loops'),
  ...flattenMessages(commands, 'commands'),
  ...flattenMessages(memory, 'memory'),
  ...flattenMessages(settings, 'settings'),
  ...flattenMessages(fixSession, 'fixSession'),
  ...flattenMessages(history, 'history'),
  ...flattenMessages(liteTasks, 'liteTasks'),
  ...flattenMessages(projectOverview, 'projectOverview'),
  ...flattenMessages(reviewSession, 'reviewSession'),
  ...flattenMessages(sessionDetail, 'sessionDetail'),
  ...flattenMessages(skills, 'skills'),
  ...flattenMessages(cliManager), // No prefix - has cliEndpoints, cliInstallations, etc. as top-level keys
  ...flattenMessages(mcpManager, 'mcp'),
} as Record<string, string>;
