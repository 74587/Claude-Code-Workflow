/**
 * Session Routes Module
 * Handles all Session/Task-related API endpoints
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { readFile, readdir, access } from 'fs/promises';
import { join } from 'path';
import type { RouteContext } from './types.js';

/**
 * Check if a file or directory exists (async version)
 * @param filePath - Path to check
 * @returns Promise<boolean>
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get session detail data (context, summaries, impl-plan, review, multi-cli)
 * @param {string} sessionPath - Path to session directory
 * @param {string} dataType - Type of data to load ('all', 'context', 'tasks', 'summary', 'plan', 'explorations', 'conflict', 'impl-plan', 'review', 'multi-cli', 'discussions')
 * @returns {Promise<Object>}
 */
async function getSessionDetailData(sessionPath: string, dataType: string): Promise<Record<string, unknown>> {
  const result: any = {};

  // Normalize path
  const normalizedPath = sessionPath.replace(/\\/g, '/');

  try {
    // Load context-package.json (in .process/ subfolder)
    if (dataType === 'context' || dataType === 'all') {
      // Try .process/context-package.json first (common location)
      let contextFile = join(normalizedPath, '.process', 'context-package.json');
      if (!(await fileExists(contextFile))) {
        // Fallback to session root
        contextFile = join(normalizedPath, 'context-package.json');
      }
      if (await fileExists(contextFile)) {
        try {
          result.context = JSON.parse(await readFile(contextFile, 'utf8'));
        } catch (e) {
          console.warn('Failed to parse context file:', contextFile, (e as Error).message);
          result.context = null;
        }
      }
    }

    // Load task JSONs from .task/ folder
    if (dataType === 'tasks' || dataType === 'all') {
      const taskDir = join(normalizedPath, '.task');
      result.tasks = [];
      if (await fileExists(taskDir)) {
        const files = (await readdir(taskDir)).filter(f => f.endsWith('.json') && f.startsWith('IMPL-'));
        for (const file of files) {
          try {
            const content = JSON.parse(await readFile(join(taskDir, file), 'utf8'));
            result.tasks.push({
              filename: file,
              task_id: file.replace('.json', ''),
              ...content
            });
          } catch (e) {
            console.warn('Failed to parse task file:', join(taskDir, file), (e as Error).message);
          }
        }
        // Sort by task ID
        result.tasks.sort((a: { task_id: string }, b: { task_id: string }) => a.task_id.localeCompare(b.task_id));
      }
    }

    // Load summaries from .summaries/ and fallback to plan.json
    if (dataType === 'summary' || dataType === 'all') {
      const summariesDir = join(normalizedPath, '.summaries');
      result.summaries = [];
      result.summary = null; // Single summary text from plan.json

      // 1. Try to load from .summaries/ directory
      if (await fileExists(summariesDir)) {
        const files = (await readdir(summariesDir)).filter(f => f.endsWith('.md'));
        for (const file of files) {
          try {
            const content = await readFile(join(summariesDir, file), 'utf8');
            result.summaries.push({ name: file.replace('.md', ''), content });
          } catch (e) {
            console.warn('Failed to read summary file:', join(summariesDir, file), (e as Error).message);
          }
        }
      }

      // 2. Fallback: Try to get summary from plan.json (for lite-fix-plan sessions)
      if (result.summaries.length === 0) {
        const planFile = join(normalizedPath, 'plan.json');
        if (await fileExists(planFile)) {
          try {
            const planData = JSON.parse(await readFile(planFile, 'utf8'));
            // Check plan.summary
            if (planData.summary) {
              result.summary = planData.summary;
            }
            // Check synthesis.convergence.summary
            if (!result.summary && planData.synthesis?.convergence?.summary) {
              result.summary = planData.synthesis.convergence.summary;
            }
          } catch (e) {
            console.warn('Failed to parse plan file for summary:', planFile, (e as Error).message);
          }
        }
      }
    }

    // Load plan.json (for lite tasks)
    if (dataType === 'plan' || dataType === 'all') {
      const planFile = join(normalizedPath, 'plan.json');
      if (await fileExists(planFile)) {
        try {
          result.plan = JSON.parse(await readFile(planFile, 'utf8'));
        } catch (e) {
          console.warn('Failed to parse plan file:', planFile, (e as Error).message);
          result.plan = null;
        }
      }
    }

    // Load explorations (exploration-*.json files) and diagnoses (diagnosis-*.json files) - check .process/ first, then session root
    if (dataType === 'context' || dataType === 'explorations' || dataType === 'all') {
      result.explorations = { manifest: null, data: {} };
      result.diagnoses = { manifest: null, data: {} };

      // Try .process/ first (standard workflow sessions), then session root (lite tasks)
      const searchDirs = [
        join(normalizedPath, '.process'),
        normalizedPath
      ];

      for (const searchDir of searchDirs) {
        if (!(await fileExists(searchDir))) continue;

        // Look for explorations-manifest.json
        const manifestFile = join(searchDir, 'explorations-manifest.json');
        if (await fileExists(manifestFile)) {
          try {
            result.explorations.manifest = JSON.parse(await readFile(manifestFile, 'utf8'));

            // Load each exploration file based on manifest
            const explorations = result.explorations.manifest.explorations || [];
            for (const exp of explorations) {
              const expFile = join(searchDir, exp.file);
              if (await fileExists(expFile)) {
                try {
                  result.explorations.data[exp.angle] = JSON.parse(await readFile(expFile, 'utf8'));
                } catch (e) {
                  console.warn('Failed to parse exploration file:', expFile, (e as Error).message);
                }
              }
            }
            break; // Found manifest, stop searching
          } catch (e) {
            console.warn('Failed to parse explorations manifest:', manifestFile, (e as Error).message);
            result.explorations.manifest = null;
          }
        }

        // Look for diagnoses-manifest.json
        const diagManifestFile = join(searchDir, 'diagnoses-manifest.json');
        if (await fileExists(diagManifestFile)) {
          try {
            result.diagnoses.manifest = JSON.parse(await readFile(diagManifestFile, 'utf8'));

            // Load each diagnosis file based on manifest
            const diagnoses = result.diagnoses.manifest.diagnoses || [];
            for (const diag of diagnoses) {
              const diagFile = join(searchDir, diag.file);
              if (await fileExists(diagFile)) {
                try {
                  result.diagnoses.data[diag.angle] = JSON.parse(await readFile(diagFile, 'utf8'));
                } catch (e) {
                  console.warn('Failed to parse diagnosis file:', diagFile, (e as Error).message);
                }
              }
            }
            break; // Found manifest, stop searching
          } catch (e) {
            console.warn('Failed to parse diagnoses manifest:', diagManifestFile, (e as Error).message);
            result.diagnoses.manifest = null;
          }
        }

        // Fallback: scan for exploration-*.json and diagnosis-*.json files directly
        if (!result.explorations.manifest) {
          try {
            const expFiles = (await readdir(searchDir)).filter(f => f.startsWith('exploration-') && f.endsWith('.json') && f !== 'explorations-manifest.json');
            if (expFiles.length > 0) {
              // Create synthetic manifest
              result.explorations.manifest = {
                exploration_count: expFiles.length,
                explorations: expFiles.map((f, i) => ({
                  angle: f.replace('exploration-', '').replace('.json', ''),
                  file: f,
                  index: i + 1
                }))
              };

              // Load each file
              for (const file of expFiles) {
                const angle = file.replace('exploration-', '').replace('.json', '');
                try {
                  result.explorations.data[angle] = JSON.parse(await readFile(join(searchDir, file), 'utf8'));
                } catch (e) {
                  console.warn('Failed to parse exploration file:', join(searchDir, file), (e as Error).message);
                }
              }
            }
          } catch (e) {
            console.warn('Failed to read explorations directory:', searchDir, (e as Error).message);
          }
        }

        // Fallback: scan for diagnosis-*.json files directly
        if (!result.diagnoses.manifest) {
          try {
            const diagFiles = (await readdir(searchDir)).filter(f => f.startsWith('diagnosis-') && f.endsWith('.json') && f !== 'diagnoses-manifest.json');
            if (diagFiles.length > 0) {
              // Create synthetic manifest
              result.diagnoses.manifest = {
                diagnosis_count: diagFiles.length,
                diagnoses: diagFiles.map((f, i) => ({
                  angle: f.replace('diagnosis-', '').replace('.json', ''),
                  file: f,
                  index: i + 1
                }))
              };

              // Load each file
              for (const file of diagFiles) {
                const angle = file.replace('diagnosis-', '').replace('.json', '');
                try {
                  result.diagnoses.data[angle] = JSON.parse(await readFile(join(searchDir, file), 'utf8'));
                } catch (e) {
                  console.warn('Failed to parse diagnosis file:', join(searchDir, file), (e as Error).message);
                }
              }
            }
          } catch (e) {
            console.warn('Failed to read diagnoses directory:', searchDir, (e as Error).message);
          }
        }

        // If we found either explorations or diagnoses, break out of the loop
        if (result.explorations.manifest || result.diagnoses.manifest) {
          break;
        }
      }
    }

    // Load conflict resolution decisions (conflict-resolution-decisions.json)
    if (dataType === 'context' || dataType === 'conflict' || dataType === 'all') {
      result.conflictResolution = null;

      // Try .process/ first (standard workflow sessions)
      const conflictFiles = [
        join(normalizedPath, '.process', 'conflict-resolution-decisions.json'),
        join(normalizedPath, 'conflict-resolution-decisions.json')
      ];

      for (const conflictFile of conflictFiles) {
        if (await fileExists(conflictFile)) {
          try {
            result.conflictResolution = JSON.parse(await readFile(conflictFile, 'utf8'));
            break; // Found file, stop searching
          } catch (e) {
            console.warn('Failed to parse conflict resolution file:', conflictFile, (e as Error).message);
          }
        }
      }
    }

    // Load IMPL_PLAN.md
    if (dataType === 'impl-plan' || dataType === 'all') {
      const implPlanFile = join(normalizedPath, 'IMPL_PLAN.md');
      if (await fileExists(implPlanFile)) {
        try {
          result.implPlan = await readFile(implPlanFile, 'utf8');
        } catch (e) {
          console.warn('Failed to read IMPL_PLAN.md:', implPlanFile, (e as Error).message);
          result.implPlan = null;
        }
      }
    }

    // Load multi-cli discussion rounds (rounds/*/synthesis.json)
    // Supports both NEW and OLD schema formats
    if (dataType === 'multi-cli' || dataType === 'discussions' || dataType === 'all') {
      result.multiCli = {
        sessionId: normalizedPath.split('/').pop() || '',
        type: 'multi-cli-plan',
        rounds: [] as Array<{
          roundNumber: number;
          synthesis: Record<string, unknown> | null;
          // NEW schema extracted fields
          solutions?: Array<{
            name: string;
            source_cli: string[];
            feasibility: number;
            effort: string;
            risk: string;
            summary: string;
            tasksCount: number;
            dependencies: { internal: string[]; external: string[] };
            technical_concerns: string[];
          }>;
          convergence?: {
            score: number;
            new_insights: boolean;
            recommendation: string;
          };
          cross_verification?: {
            agreements: string[];
            disagreements: string[];
            resolution: string;
          };
          clarification_questions?: string[];
        }>,
        // Aggregated data from latest synthesis
        latestSolutions: [] as Array<Record<string, unknown>>,
        latestConvergence: null as Record<string, unknown> | null,
        latestCrossVerification: null as Record<string, unknown> | null,
        clarificationQuestions: [] as string[]
      };

      const roundsDir = join(normalizedPath, 'rounds');
      if (await fileExists(roundsDir)) {
        try {
          const roundDirs = (await readdir(roundsDir))
            .filter(d => /^\d+$/.test(d)) // Only numeric directories
            .sort((a, b) => parseInt(a) - parseInt(b));

          for (const roundDir of roundDirs) {
            const synthesisFile = join(roundsDir, roundDir, 'synthesis.json');
            let synthesis: Record<string, unknown> | null = null;

            if (await fileExists(synthesisFile)) {
              try {
                synthesis = JSON.parse(await readFile(synthesisFile, 'utf8'));
              } catch (e) {
                console.warn('Failed to parse synthesis file:', synthesisFile, (e as Error).message);
              }
            }

            // Build round data with NEW schema fields extracted
            const roundData: any = {
              roundNumber: parseInt(roundDir),
              synthesis
            };

            // Extract NEW schema fields if present
            if (synthesis) {
              // Extract solutions with summary info
              if (Array.isArray(synthesis.solutions)) {
                roundData.solutions = (synthesis.solutions as Array<Record<string, any>>).map(s => ({
                  name: s.name || '',
                  source_cli: s.source_cli || [],
                  feasibility: s.feasibility ?? 0,
                  effort: s.effort || 'unknown',
                  risk: s.risk || 'unknown',
                  summary: s.summary || '',
                  tasksCount: s.implementation_plan?.tasks?.length || 0,
                  dependencies: s.dependencies || { internal: [], external: [] },
                  technical_concerns: s.technical_concerns || []
                }));
              }

              // Extract convergence
              if (synthesis.convergence && typeof synthesis.convergence === 'object') {
                const conv = synthesis.convergence as Record<string, unknown>;
                roundData.convergence = {
                  score: conv.score ?? 0,
                  new_insights: conv.new_insights ?? false,
                  recommendation: conv.recommendation || 'unknown'
                };
              }

              // Extract cross_verification
              if (synthesis.cross_verification && typeof synthesis.cross_verification === 'object') {
                const cv = synthesis.cross_verification as Record<string, unknown>;
                roundData.cross_verification = {
                  agreements: Array.isArray(cv.agreements) ? cv.agreements : [],
                  disagreements: Array.isArray(cv.disagreements) ? cv.disagreements : [],
                  resolution: (cv.resolution as string) || ''
                };
              }

              // Extract clarification_questions
              if (Array.isArray(synthesis.clarification_questions)) {
                roundData.clarification_questions = synthesis.clarification_questions;
              }
            }

            result.multiCli.rounds.push(roundData);
          }

          // Populate aggregated data from latest round
          if (result.multiCli.rounds.length > 0) {
            const latestRound = result.multiCli.rounds[result.multiCli.rounds.length - 1];
            if (latestRound.solutions) {
              result.multiCli.latestSolutions = latestRound.solutions;
            }
            if (latestRound.convergence) {
              result.multiCli.latestConvergence = latestRound.convergence;
            }
            if (latestRound.cross_verification) {
              result.multiCli.latestCrossVerification = latestRound.cross_verification;
            }
            if (latestRound.clarification_questions) {
              result.multiCli.clarificationQuestions = latestRound.clarification_questions;
            }
          }
        } catch (e) {
          console.warn('Failed to read rounds directory:', roundsDir, (e as Error).message);
        }
      }
    }

    // Load review data from .review/
    if (dataType === 'review' || dataType === 'all') {
      const reviewDir = join(normalizedPath, '.review');
      result.review = {
        state: null,
        dimensions: [],
        severityDistribution: null,
        totalFindings: 0
      };

      if (await fileExists(reviewDir)) {
        // Load review-state.json
        const stateFile = join(reviewDir, 'review-state.json');
        if (await fileExists(stateFile)) {
          try {
            const state = JSON.parse(await readFile(stateFile, 'utf8'));
            result.review.state = state;
            result.review.severityDistribution = state.severity_distribution || {};
            result.review.totalFindings = state.total_findings || 0;
            result.review.phase = state.phase || 'unknown';
            result.review.dimensionSummaries = state.dimension_summaries || {};
            result.review.crossCuttingConcerns = state.cross_cutting_concerns || [];
            result.review.criticalFiles = state.critical_files || [];
          } catch (e) {
            console.warn('Failed to parse review state file:', stateFile, (e as Error).message);
          }
        }

        // Load dimension findings
        const dimensionsDir = join(reviewDir, 'dimensions');
        if (await fileExists(dimensionsDir)) {
          const files = (await readdir(dimensionsDir)).filter(f => f.endsWith('.json'));
          for (const file of files) {
            try {
              const dimName = file.replace('.json', '');
              const data = JSON.parse(await readFile(join(dimensionsDir, file), 'utf8'));

              // Handle array structure: [ { findings: [...] } ]
              let findings = [];
              let summary = null;

              if (Array.isArray(data) && data.length > 0) {
                const dimData = data[0];
                findings = dimData.findings || [];
                summary = dimData.summary || null;
              } else if (data.findings) {
                findings = data.findings;
                summary = data.summary || null;
              }

              result.review.dimensions.push({
                name: dimName,
                findings: findings,
                summary: summary,
                count: findings.length
              });
            } catch (e) {
              console.warn('Failed to parse review dimension file:', join(dimensionsDir, file), (e as Error).message);
            }
          }
        }
      }
    }

  } catch (error: unknown) {
    console.error('Error loading session detail:', error);
    result.error = (error as Error).message;
  }

  return result;
}

/**
 * Update task status in a task JSON file
 * @param {string} sessionPath - Path to session directory
 * @param {string} taskId - Task ID (e.g., IMPL-001)
 * @param {string} newStatus - New status (pending, in_progress, completed)
 * @returns {Promise<Object>}
 */
async function updateTaskStatus(sessionPath: string, taskId: string, newStatus: string): Promise<Record<string, unknown>> {
  // Normalize path (handle both forward and back slashes)
  let normalizedPath = sessionPath.replace(/\\/g, '/');

  // Handle Windows drive letter format
  if (normalizedPath.match(/^[a-zA-Z]:\//)) {
    // Already in correct format
  } else if (normalizedPath.match(/^\/[a-zA-Z]\//)) {
    // Convert /D/path to D:/path
    normalizedPath = normalizedPath.charAt(1).toUpperCase() + ':' + normalizedPath.slice(2);
  }

  const taskDir = join(normalizedPath, '.task');

  // Check if task directory exists
  if (!existsSync(taskDir)) {
    throw new Error(`Task directory not found: ${taskDir}`);
  }

  // Try to find the task file
  let taskFile = join(taskDir, `${taskId}.json`);

  if (!existsSync(taskFile)) {
    // Try without .json if taskId already has it
    if (taskId.endsWith('.json')) {
      taskFile = join(taskDir, taskId);
    }
    if (!existsSync(taskFile)) {
      throw new Error(`Task file not found: ${taskId}.json in ${taskDir}`);
    }
  }

  try {
    const content = JSON.parse(readFileSync(taskFile, 'utf8'));
    const oldStatus = content.status || 'pending';
    content.status = newStatus;

    // Add status change timestamp
    if (!content.status_history) {
      content.status_history = [];
    }
    content.status_history.push({
      from: oldStatus,
      to: newStatus,
      changed_at: new Date().toISOString()
    });

    writeFileSync(taskFile, JSON.stringify(content, null, 2), 'utf8');

    return {
      success: true,
      taskId,
      oldStatus,
      newStatus,
      file: taskFile
    };
  } catch (error: unknown) {
    throw new Error(`Failed to update task ${taskId}: ${(error as Error).message}`);
  }
}

/**
 * Handle Session routes
 * @returns true if route was handled, false otherwise
 */
export async function handleSessionRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, handlePostRequest } = ctx;

  // API: Get session detail data (context, summaries, impl-plan, review)
  if (pathname === '/api/session-detail') {
    const sessionPath = url.searchParams.get('path');
    const dataType = url.searchParams.get('type') || 'all';

    if (!sessionPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session path is required' }));
      return true;
    }

    const detail = await getSessionDetailData(sessionPath, dataType);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(detail));
    return true;
  }

  // API: Update task status
  if (pathname === '/api/update-task-status' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      if (typeof body !== 'object' || body === null) {
        return { error: 'Invalid request body', status: 400 };
      }

      const { sessionPath, taskId, newStatus } = body as {
        sessionPath?: unknown;
        taskId?: unknown;
        newStatus?: unknown;
      };

      if (typeof sessionPath !== 'string' || typeof taskId !== 'string' || typeof newStatus !== 'string') {
        return { error: 'sessionPath, taskId, and newStatus are required', status: 400 };
      }

      return await updateTaskStatus(sessionPath, taskId, newStatus);
    });
    return true;
  }

  // API: Bulk update task status
  if (pathname === '/api/bulk-update-task-status' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      if (typeof body !== 'object' || body === null) {
        return { error: 'Invalid request body', status: 400 };
      }

      const { sessionPath, taskIds, newStatus } = body as {
        sessionPath?: unknown;
        taskIds?: unknown;
        newStatus?: unknown;
      };

      if (typeof sessionPath !== 'string' || !Array.isArray(taskIds) || typeof newStatus !== 'string') {
        return { error: 'sessionPath, taskIds, and newStatus are required', status: 400 };
      }

      const results: Array<Record<string, unknown>> = [];
      for (const taskId of taskIds) {
        if (typeof taskId !== 'string') continue;
        try {
          const result = await updateTaskStatus(sessionPath, taskId, newStatus);
          results.push(result);
        } catch (err) {
          results.push({ taskId, error: err instanceof Error ? err.message : String(err) });
        }
      }
      return { success: true, results };
    });
    return true;
  }

  return false;
}
