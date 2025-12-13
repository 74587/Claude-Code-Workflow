// Prompt History View
// Displays prompt history and optimization insights

// ========== State ==========
var promptHistoryData = [];
var promptInsights = null;
var promptHistorySearch = '';
var promptHistoryDateFilter = null;
var promptHistoryProjectFilter = null;
var selectedPromptId = null;

// ========== Data Loading ==========
async function loadPromptHistory() {
  try {
    // Use native Claude history.jsonl as primary source
    var response = await fetch('/api/memory/native-history?path=' + encodeURIComponent(projectPath) + '&limit=200');
    if (!response.ok) throw new Error('Failed to load prompt history');
    var data = await response.json();
    promptHistoryData = data.prompts || [];
    console.log('[PromptHistory] Loaded', promptHistoryData.length, 'prompts from native history');
    return promptHistoryData;
  } catch (err) {
    console.error('Failed to load prompt history:', err);
    promptHistoryData = [];
    return [];
  }
}

async function loadPromptInsights() {
  try {
    var response = await fetch('/api/memory/insights?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load insights');
    var data = await response.json();
    promptInsights = data.insights || null;
    return promptInsights;
  } catch (err) {
    console.error('Failed to load insights:', err);
    promptInsights = null;
    return null;
  }
}

// ========== Rendering ==========
async function renderPromptHistoryView() {
  var container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search
  var statsGrid = document.getElementById('statsGrid');
  var searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Load data
  await Promise.all([loadPromptHistory(), loadPromptInsights()]);

  // Calculate stats
  var totalPrompts = promptHistoryData.length;
  var intentDistribution = calculateIntentDistribution(promptHistoryData);
  var avgLength = calculateAverageLength(promptHistoryData);
  var qualityDistribution = calculateQualityDistribution(promptHistoryData);

  container.innerHTML = '<div class="prompt-history-view">' +
    '<div class="prompt-history-header">' +
      renderStatsSection(totalPrompts, intentDistribution, avgLength, qualityDistribution) +
    '</div>' +
    '<div class="prompt-history-content">' +
      '<div class="prompt-history-left">' +
        renderPromptTimeline() +
      '</div>' +
      '<div class="prompt-history-right">' +
        renderInsightsPanel() +
      '</div>' +
    '</div>' +
  '</div>';

  if (window.lucide) lucide.createIcons();
}

function renderStatsSection(totalPrompts, intentDist, avgLength, qualityDist) {
  var topIntent = intentDist.length > 0 ? intentDist[0].intent : 'N/A';
  var topIntentCount = intentDist.length > 0 ? intentDist[0].count : 0;
  var intentLabel = t('prompt.intent.' + topIntent) || topIntent;

  return '<div class="prompt-stats-grid">' +
    '<div class="prompt-stat-card">' +
      '<div class="stat-icon"><i data-lucide="message-square" class="w-5 h-5"></i></div>' +
      '<div class="stat-content">' +
        '<div class="stat-value">' + totalPrompts + '</div>' +
        '<div class="stat-label">' + (isZh() ? '总提示词' : 'Total Prompts') + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="prompt-stat-card">' +
      '<div class="stat-icon"><i data-lucide="target" class="w-5 h-5"></i></div>' +
      '<div class="stat-content">' +
        '<div class="stat-value">' + intentLabel + '</div>' +
        '<div class="stat-label">' + (isZh() ? '主要意图' : 'Top Intent') + ' (' + topIntentCount + ')</div>' +
      '</div>' +
    '</div>' +
    '<div class="prompt-stat-card">' +
      '<div class="stat-icon"><i data-lucide="align-left" class="w-5 h-5"></i></div>' +
      '<div class="stat-content">' +
        '<div class="stat-value">' + avgLength + '</div>' +
        '<div class="stat-label">' + (isZh() ? '平均长度' : 'Avg Length') + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="prompt-stat-card">' +
      '<div class="stat-icon"><i data-lucide="bar-chart-2" class="w-5 h-5"></i></div>' +
      '<div class="stat-content">' +
        '<div class="stat-value">' + renderQualityBadge(qualityDist.average) + '</div>' +
        '<div class="stat-label">' + t('prompt.quality') + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function renderPromptTimeline() {
  var filteredPrompts = filterPrompts(promptHistoryData);
  var groupedBySession = groupPromptsBySession(filteredPrompts);

  var html = '<div class="prompt-timeline-header">' +
    '<h3><i data-lucide="clock" class="w-4 h-4"></i> ' + t('prompt.timeline') + '</h3>' +
    '<div class="prompt-timeline-filters">' +
      '<div class="prompt-search-wrapper">' +
        '<i data-lucide="search" class="w-4 h-4"></i>' +
        '<input type="text" class="prompt-search-input" placeholder="' + t('prompt.searchPlaceholder') + '" ' +
          'value="' + escapeHtml(promptHistorySearch) + '" ' +
          'oninput="searchPrompts(this.value)">' +
      '</div>' +
      '<button class="btn-icon" onclick="refreshPromptHistory()" title="' + t('common.refresh') + '">' +
        '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
      '</button>' +
    '</div>' +
  '</div>';

  if (filteredPrompts.length === 0) {
    html += '<div class="prompt-empty-state">' +
      '<i data-lucide="message-circle-off" class="w-12 h-12"></i>' +
      '<h3>' + t('prompt.noPromptsFound') + '</h3>' +
      '<p>' + t('prompt.noPromptsText') + '</p>' +
    '</div>';
  } else {
    html += '<div class="prompt-timeline-list">';
    for (var sessionId in groupedBySession) {
      html += renderSessionGroup(sessionId, groupedBySession[sessionId]);
    }
    html += '</div>';
  }

  return html;
}

function renderSessionGroup(sessionId, prompts) {
  var sessionDate = new Date(prompts[0].timestamp).toLocaleDateString();
  var shortSessionId = sessionId.substring(0, 8);

  var html = '<div class="prompt-session-group">' +
    '<div class="prompt-session-header">' +
      '<span class="prompt-session-id">' +
        '<i data-lucide="layers" class="w-3.5 h-3.5"></i> ' +
        shortSessionId +
      '</span>' +
      '<span class="prompt-session-date">' + sessionDate + '</span>' +
      '<span class="prompt-session-count">' + prompts.length + ' prompt' + (prompts.length > 1 ? 's' : '') + '</span>' +
    '</div>' +
    '<div class="prompt-session-items">';

  for (var i = 0; i < prompts.length; i++) {
    html += renderPromptItem(prompts[i]);
  }

  html += '</div></div>';
  return html;
}

function renderPromptItem(prompt) {
  var isExpanded = selectedPromptId === prompt.id;
  var timeAgo = getTimeAgo(new Date(prompt.timestamp));
  var preview = prompt.text.substring(0, 120) + (prompt.text.length > 120 ? '...' : '');
  var qualityClass = getQualityClass(prompt.quality_score);

  var html = '<div class="prompt-item' + (isExpanded ? ' prompt-item-expanded' : '') + '" ' +
    'onclick="togglePromptExpand(\'' + prompt.id + '\')">' +
    '<div class="prompt-item-header">' +
      '<span class="prompt-intent-tag">' + (prompt.intent || 'unknown') + '</span>' +
      '<span class="prompt-quality-badge ' + qualityClass + '">' +
        '<i data-lucide="sparkles" class="w-3 h-3"></i> ' + (prompt.quality_score || 0) +
      '</span>' +
      '<span class="prompt-time">' + timeAgo + '</span>' +
    '</div>' +
    '<div class="prompt-item-preview">' + escapeHtml(preview) + '</div>';

  if (isExpanded) {
    html += '<div class="prompt-item-full">' +
      '<div class="prompt-full-text">' + escapeHtml(prompt.text) + '</div>' +
      '<div class="prompt-item-meta">' +
        '<span><i data-lucide="type" class="w-3 h-3"></i> ' + prompt.text.length + ' chars</span>' +
        (prompt.project ? '<span><i data-lucide="folder" class="w-3 h-3"></i> ' + escapeHtml(prompt.project) + '</span>' : '') +
      '</div>' +
      '<div class="prompt-item-actions-full">' +
        '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); copyPrompt(\'' + prompt.id + '\')">' +
          '<i data-lucide="copy" class="w-3.5 h-3.5"></i> ' + t('common.copy') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  html += '</div>';
  return html;
}

function renderInsightsPanel() {
  var html = '<div class="insights-panel-header">' +
    '<h3><i data-lucide="lightbulb" class="w-4 h-4"></i> ' + t('prompt.insights') + '</h3>' +
    '<div class="insights-actions">' +
      '<select id="insightsTool" class="insights-tool-select">' +
        '<option value="gemini">Gemini</option>' +
        '<option value="qwen">Qwen</option>' +
      '</select>' +
      '<button class="btn btn-sm btn-primary" onclick="triggerCliInsightsAnalysis()" id="analyzeBtn">' +
        '<i data-lucide="sparkles" class="w-3.5 h-3.5"></i> ' + t('prompt.analyze') +
      '</button>' +
    '</div>' +
  '</div>';

  // Show loading state
  if (window.insightsAnalyzing) {
    html += '<div class="insights-loading">' +
      '<div class="loading-spinner"><i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i></div>' +
      '<p>' + t('prompt.loadingInsights') + '</p>' +
    '</div>';
    return html;
  }

  if (!promptInsights || !promptInsights.patterns || promptInsights.patterns.length === 0) {
    html += '<div class="insights-empty-state">' +
      '<i data-lucide="brain" class="w-10 h-10"></i>' +
      '<p>' + t('prompt.noInsights') + '</p>' +
      '<p class="insights-hint">' + t('prompt.noInsightsText') + '</p>' +
    '</div>';
  } else {
    html += '<div class="insights-list">';

    // Render detected patterns
    if (promptInsights.patterns && promptInsights.patterns.length > 0) {
      html += '<div class="insights-section">' +
        '<h4><i data-lucide="alert-circle" class="w-4 h-4"></i> Detected Patterns</h4>';
      for (var i = 0; i < promptInsights.patterns.length; i++) {
        html += renderPatternCard(promptInsights.patterns[i]);
      }
      html += '</div>';
    }

    // Render suggestions
    if (promptInsights.suggestions && promptInsights.suggestions.length > 0) {
      html += '<div class="insights-section">' +
        '<h4><i data-lucide="zap" class="w-4 h-4"></i> Optimization Suggestions</h4>';
      for (var j = 0; j < promptInsights.suggestions.length; j++) {
        html += renderSuggestionCard(promptInsights.suggestions[j]);
      }
      html += '</div>';
    }

    // Render similar successful prompts
    if (promptInsights.similar_prompts && promptInsights.similar_prompts.length > 0) {
      html += '<div class="insights-section">' +
        '<h4><i data-lucide="stars" class="w-4 h-4"></i> Similar Successful Prompts</h4>';
      for (var k = 0; k < promptInsights.similar_prompts.length; k++) {
        html += renderSimilarPromptCard(promptInsights.similar_prompts[k]);
      }
      html += '</div>';
    }

    html += '</div>';
  }

  return html;
}

function renderPatternCard(pattern) {
  var iconMap = {
    'vague': 'help-circle',
    'correction': 'rotate-ccw',
    'repetitive': 'repeat',
    'incomplete': 'alert-triangle'
  };
  var icon = iconMap[pattern.type] || 'info';
  var severityClass = pattern.severity || 'medium';

  return '<div class="pattern-card pattern-' + severityClass + '">' +
    '<div class="pattern-header">' +
      '<i data-lucide="' + icon + '" class="w-4 h-4"></i>' +
      '<span class="pattern-type">' + (pattern.type || 'Unknown') + '</span>' +
      '<span class="pattern-count">' + (pattern.occurrences || 0) + 'x</span>' +
    '</div>' +
    '<div class="pattern-description">' + escapeHtml(pattern.description || '') + '</div>' +
    '<div class="pattern-suggestion">' +
      '<i data-lucide="arrow-right" class="w-3 h-3"></i> ' +
      escapeHtml(pattern.suggestion || '') +
    '</div>' +
  '</div>';
}

function renderSuggestionCard(suggestion) {
  return '<div class="suggestion-card">' +
    '<div class="suggestion-title">' +
      '<i data-lucide="sparkle" class="w-3.5 h-3.5"></i> ' +
      escapeHtml(suggestion.title || 'Suggestion') +
    '</div>' +
    '<div class="suggestion-description">' + escapeHtml(suggestion.description || '') + '</div>' +
    (suggestion.example ?
      '<div class="suggestion-example">' +
        '<div class="suggestion-example-label">Example:</div>' +
        '<code>' + escapeHtml(suggestion.example) + '</code>' +
      '</div>' : '') +
  '</div>';
}

function renderSimilarPromptCard(prompt) {
  var similarity = Math.round((prompt.similarity || 0) * 100);
  var preview = prompt.text.substring(0, 80) + (prompt.text.length > 80 ? '...' : '');

  return '<div class="similar-prompt-card" onclick="showPromptDetail(\'' + prompt.id + '\')">' +
    '<div class="similar-prompt-header">' +
      '<span class="similar-prompt-similarity">' + similarity + '% match</span>' +
      '<span class="similar-prompt-intent">' + (prompt.intent || 'unknown') + '</span>' +
    '</div>' +
    '<div class="similar-prompt-preview">' + escapeHtml(preview) + '</div>' +
    '<div class="similar-prompt-meta">' +
      '<span class="similar-prompt-quality">' +
        '<i data-lucide="star" class="w-3 h-3"></i> ' + (prompt.quality_score || 0) +
      '</span>' +
    '</div>' +
  '</div>';
}

function renderProjectOptions() {
  var projects = getUniqueProjects(promptHistoryData);
  var html = '';
  for (var i = 0; i < projects.length; i++) {
    var selected = projects[i] === promptHistoryProjectFilter ? 'selected' : '';
    html += '<option value="' + escapeHtml(projects[i]) + '" ' + selected + '>' +
      escapeHtml(projects[i]) + '</option>';
  }
  return html;
}

function renderQualityBadge(score) {
  if (score >= 80) return '<span class="quality-badge high">' + score + '</span>';
  if (score >= 60) return '<span class="quality-badge medium">' + score + '</span>';
  return '<span class="quality-badge low">' + score + '</span>';
}

// ========== Helper Functions ==========
function calculateIntentDistribution(prompts) {
  var distribution = {};
  for (var i = 0; i < prompts.length; i++) {
    var intent = prompts[i].intent || 'unknown';
    distribution[intent] = (distribution[intent] || 0) + 1;
  }

  var result = [];
  for (var key in distribution) {
    result.push({ intent: key, count: distribution[key] });
  }
  result.sort(function(a, b) { return b.count - a.count; });
  return result;
}

function calculateAverageLength(prompts) {
  if (prompts.length === 0) return 0;
  var total = 0;
  for (var i = 0; i < prompts.length; i++) {
    total += (prompts[i].text || '').length;
  }
  return Math.round(total / prompts.length);
}

function calculateQualityDistribution(prompts) {
  if (prompts.length === 0) return { average: 0, distribution: {} };

  var total = 0;
  var distribution = { high: 0, medium: 0, low: 0 };

  for (var i = 0; i < prompts.length; i++) {
    var score = prompts[i].quality_score || 0;
    total += score;

    if (score >= 80) distribution.high++;
    else if (score >= 60) distribution.medium++;
    else distribution.low++;
  }

  return {
    average: Math.round(total / prompts.length),
    distribution: distribution
  };
}

function getQualityClass(score) {
  if (score >= 80) return 'quality-high';
  if (score >= 60) return 'quality-medium';
  return 'quality-low';
}

function filterPrompts(prompts) {
  return prompts.filter(function(prompt) {
    var matchesSearch = !promptHistorySearch ||
      prompt.text.toLowerCase().includes(promptHistorySearch.toLowerCase());
    var matchesProject = !promptHistoryProjectFilter ||
      prompt.project === promptHistoryProjectFilter;
    var matchesDate = !promptHistoryDateFilter ||
      isSameDay(new Date(prompt.timestamp), promptHistoryDateFilter);

    return matchesSearch && matchesProject && matchesDate;
  });
}

function groupPromptsBySession(prompts) {
  var grouped = {};
  for (var i = 0; i < prompts.length; i++) {
    var sessionId = prompts[i].session_id || 'unknown';
    if (!grouped[sessionId]) grouped[sessionId] = [];
    grouped[sessionId].push(prompts[i]);
  }
  return grouped;
}

function getUniqueProjects(prompts) {
  var projects = {};
  for (var i = 0; i < prompts.length; i++) {
    if (prompts[i].project) projects[prompts[i].project] = true;
  }
  return Object.keys(projects).sort();
}

function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

// ========== Actions ==========
function searchPrompts(query) {
  promptHistorySearch = query;
  renderPromptHistoryView();
}

function filterByProject(project) {
  promptHistoryProjectFilter = project || null;
  renderPromptHistoryView();
}

function togglePromptExpand(promptId) {
  if (selectedPromptId === promptId) {
    selectedPromptId = null;
  } else {
    selectedPromptId = promptId;
  }
  renderPromptHistoryView();
}

function copyPrompt(promptId) {
  var prompt = promptHistoryData.find(function(p) { return p.id === promptId; });
  if (!prompt) return;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(prompt.text).then(function() {
      showRefreshToast('Prompt copied to clipboard', 'success');
    }).catch(function() {
      showRefreshToast('Failed to copy prompt', 'error');
    });
  }
}


function showPromptDetail(promptId) {
  togglePromptExpand(promptId);
}

async function refreshPromptHistory() {
  await Promise.all([loadPromptHistory(), loadPromptInsights()]);
  renderPromptHistoryView();
  showRefreshToast('Prompt history refreshed', 'success');
}

// ========== CLI-based Insights Analysis ==========
async function triggerCliInsightsAnalysis() {
  if (promptHistoryData.length === 0) {
    showRefreshToast(t('prompt.noPromptsFound'), 'error');
    return;
  }

  var toolSelect = document.getElementById('insightsTool');
  var tool = toolSelect ? toolSelect.value : 'gemini';
  var analyzeBtn = document.getElementById('analyzeBtn');

  // Show loading state
  window.insightsAnalyzing = true;
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> ' + t('prompt.analyzing');
  }
  renderPromptHistoryView();

  try {
    var response = await fetch('/api/memory/insights/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: projectPath,
        tool: tool,
        lang: getLang(), // Send current language preference
        prompts: promptHistoryData.slice(0, 50) // Send top 50 prompts for analysis
      })
    });

    var data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // Update insights with CLI analysis results
    if (data.insights) {
      promptInsights = data.insights;
      console.log('[PromptHistory] Insights parsed:', promptInsights);
    }

    showRefreshToast(t('toast.completed') + ' (' + tool + ')', 'success');
  } catch (err) {
    console.error('CLI insights analysis failed:', err);
    showRefreshToast(t('prompt.insightsError') + ': ' + err.message, 'error');
  } finally {
    window.insightsAnalyzing = false;
    renderPromptHistoryView();
  }
}
