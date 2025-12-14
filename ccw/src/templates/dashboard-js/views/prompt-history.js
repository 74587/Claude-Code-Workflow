// Prompt History View
// Displays prompt history and optimization insights

// ========== State ==========
var promptHistoryData = [];
var promptInsights = null;
var promptHistorySearch = '';
var promptHistoryDateFilter = null;
var promptHistoryProjectFilter = null;
var selectedPromptId = null;
var promptInsightsHistory = []; // Insights analysis history
var selectedPromptInsight = null; // Currently selected insight for detail view

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

async function loadPromptInsightsHistory() {
  try {
    var response = await fetch('/api/memory/insights?limit=20&path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load insights history');
    var data = await response.json();
    promptInsightsHistory = data.insights || [];
    return promptInsightsHistory;
  } catch (err) {
    console.error('Failed to load insights history:', err);
    promptInsightsHistory = [];
    return [];
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
  await Promise.all([loadPromptHistory(), loadPromptInsights(), loadPromptInsightsHistory()]);

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

  // Show insights history cards
  html += '<div class="insights-history-container">' +
    renderPromptInsightsHistory() +
    '</div>';

  // Show detail panel if an insight is selected
  if (selectedPromptInsight) {
    html += '<div class="insight-detail-panel" id="promptInsightDetailPanel">' +
      renderPromptInsightDetail(selectedPromptInsight) +
    '</div>';
  }

  return html;
}

function renderPromptInsightsHistory() {
  if (!promptInsightsHistory || promptInsightsHistory.length === 0) {
    return '<div class="insights-empty-state">' +
      '<i data-lucide="brain" class="w-10 h-10"></i>' +
      '<p>' + t('prompt.noInsights') + '</p>' +
      '<p class="insights-hint">' + t('prompt.noInsightsText') + '</p>' +
    '</div>';
  }

  return '<div class="insights-history-cards">' +
    promptInsightsHistory.map(function(insight) {
      var patternCount = (insight.patterns || []).length;
      var suggestionCount = (insight.suggestions || []).length;
      var severity = getPromptInsightSeverity(insight.patterns);
      var timeAgo = formatPromptTimestamp(insight.created_at);

      return '<div class="insight-history-card ' + severity + '" onclick="showPromptInsightDetail(\'' + insight.id + '\')">' +
        '<div class="insight-card-header">' +
          '<div class="insight-card-tool">' +
            '<i data-lucide="' + getPromptToolIcon(insight.tool) + '" class="w-4 h-4"></i>' +
            '<span>' + (insight.tool || 'CLI') + '</span>' +
          '</div>' +
          '<div class="insight-card-time">' + timeAgo + '</div>' +
        '</div>' +
        '<div class="insight-card-stats">' +
          '<div class="insight-stat">' +
            '<span class="insight-stat-value">' + patternCount + '</span>' +
            '<span class="insight-stat-label">' + (isZh() ? '模式' : 'Patterns') + '</span>' +
          '</div>' +
          '<div class="insight-stat">' +
            '<span class="insight-stat-value">' + suggestionCount + '</span>' +
            '<span class="insight-stat-label">' + (isZh() ? '建议' : 'Suggestions') + '</span>' +
          '</div>' +
          '<div class="insight-stat">' +
            '<span class="insight-stat-value">' + (insight.prompt_count || 0) + '</span>' +
            '<span class="insight-stat-label">' + (isZh() ? '提示' : 'Prompts') + '</span>' +
          '</div>' +
        '</div>' +
        (insight.patterns && insight.patterns.length > 0 ?
          '<div class="insight-card-preview">' +
            '<div class="pattern-preview ' + (insight.patterns[0].severity || 'low') + '">' +
              '<span class="pattern-type">' + escapeHtml(insight.patterns[0].type || 'pattern') + '</span>' +
              '<span class="pattern-desc">' + escapeHtml((insight.patterns[0].description || '').substring(0, 60)) + '...</span>' +
            '</div>' +
          '</div>' : '') +
      '</div>';
    }).join('') +
  '</div>';
}

function getPromptInsightSeverity(patterns) {
  if (!patterns || patterns.length === 0) return 'low';
  var hasHigh = patterns.some(function(p) { return p.severity === 'high'; });
  var hasMedium = patterns.some(function(p) { return p.severity === 'medium'; });
  return hasHigh ? 'high' : (hasMedium ? 'medium' : 'low');
}

function getPromptToolIcon(tool) {
  switch(tool) {
    case 'gemini': return 'sparkles';
    case 'qwen': return 'bot';
    case 'codex': return 'code-2';
    default: return 'cpu';
  }
}

function formatPromptTimestamp(timestamp) {
  if (!timestamp) return '';
  var date = new Date(timestamp);
  var now = new Date();
  var diff = now - date;
  var minutes = Math.floor(diff / 60000);
  var hours = Math.floor(diff / 3600000);
  var days = Math.floor(diff / 86400000);

  if (minutes < 1) return isZh() ? '刚刚' : 'Just now';
  if (minutes < 60) return minutes + (isZh() ? ' 分钟前' : 'm ago');
  if (hours < 24) return hours + (isZh() ? ' 小时前' : 'h ago');
  if (days < 7) return days + (isZh() ? ' 天前' : 'd ago');
  return date.toLocaleDateString();
}

async function showPromptInsightDetail(insightId) {
  try {
    var response = await fetch('/api/memory/insights/' + insightId);
    if (!response.ok) throw new Error('Failed to load insight detail');
    var data = await response.json();
    selectedPromptInsight = data.insight;
    renderPromptHistoryView();
  } catch (err) {
    console.error('Failed to load insight detail:', err);
    if (window.showToast) {
      showToast(isZh() ? '加载洞察详情失败' : 'Failed to load insight detail', 'error');
    }
  }
}

function closePromptInsightDetail() {
  selectedPromptInsight = null;
  renderPromptHistoryView();
}

function renderPromptInsightDetail(insight) {
  if (!insight) return '';

  var html = '<div class="insight-detail">' +
    '<div class="insight-detail-header">' +
      '<h4><i data-lucide="lightbulb" class="w-4 h-4"></i> ' + (isZh() ? '洞察详情' : 'Insight Detail') + '</h4>' +
      '<button class="btn-icon" onclick="closePromptInsightDetail()" title="' + t('common.close') + '">' +
        '<i data-lucide="x" class="w-4 h-4"></i>' +
      '</button>' +
    '</div>' +
    '<div class="insight-detail-meta">' +
      '<span><i data-lucide="' + getPromptToolIcon(insight.tool) + '" class="w-3 h-3"></i> ' + (insight.tool || 'CLI') + '</span>' +
      '<span><i data-lucide="clock" class="w-3 h-3"></i> ' + formatPromptTimestamp(insight.created_at) + '</span>' +
      '<span><i data-lucide="file-text" class="w-3 h-3"></i> ' + (insight.prompt_count || 0) + ' ' + (isZh() ? '个提示已分析' : 'prompts analyzed') + '</span>' +
    '</div>';

  // Patterns
  if (insight.patterns && insight.patterns.length > 0) {
    html += '<div class="insight-patterns">' +
      '<h5><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> ' + (isZh() ? '发现的模式' : 'Patterns Found') + ' (' + insight.patterns.length + ')</h5>' +
      '<div class="patterns-list">' +
      insight.patterns.map(function(p) {
        return '<div class="pattern-item ' + (p.severity || 'low') + '">' +
          '<div class="pattern-header">' +
            '<span class="pattern-type-badge">' + escapeHtml(p.type || 'pattern') + '</span>' +
            '<span class="pattern-severity">' + (p.severity || 'low') + '</span>' +
            (p.occurrences ? '<span class="pattern-occurrences">' + p.occurrences + 'x</span>' : '') +
          '</div>' +
          '<div class="pattern-description">' + escapeHtml(p.description || '') + '</div>' +
          (p.suggestion ? '<div class="pattern-suggestion"><i data-lucide="arrow-right" class="w-3 h-3"></i> ' + escapeHtml(p.suggestion) + '</div>' : '') +
        '</div>';
      }).join('') +
      '</div>' +
    '</div>';
  }

  // Suggestions
  if (insight.suggestions && insight.suggestions.length > 0) {
    html += '<div class="insight-suggestions">' +
      '<h5><i data-lucide="lightbulb" class="w-3.5 h-3.5"></i> ' + (isZh() ? '提供的建议' : 'Suggestions') + ' (' + insight.suggestions.length + ')</h5>' +
      '<div class="suggestions-list">' +
      insight.suggestions.map(function(s) {
        return '<div class="suggestion-item">' +
          '<div class="suggestion-title">' + escapeHtml(s.title || '') + '</div>' +
          '<div class="suggestion-description">' + escapeHtml(s.description || '') + '</div>' +
          (s.example ? '<div class="suggestion-example"><code>' + escapeHtml(s.example) + '</code></div>' : '') +
        '</div>';
      }).join('') +
      '</div>' +
    '</div>';
  }

  html += '<div class="insight-detail-actions">' +
    '<button class="btn btn-sm btn-danger" onclick="deletePromptInsight(\'' + insight.id + '\')">' +
      '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> ' + t('common.delete') +
    '</button>' +
  '</div>' +
  '</div>';

  return html;
}

async function deletePromptInsight(insightId) {
  if (!confirm(isZh() ? '确定要删除这条洞察记录吗？' : 'Are you sure you want to delete this insight?')) return;

  try {
    var response = await fetch('/api/memory/insights/' + insightId, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete insight');

    selectedPromptInsight = null;
    await loadPromptInsightsHistory();
    renderPromptHistoryView();

    if (window.showToast) {
      showToast(isZh() ? '洞察已删除' : 'Insight deleted', 'success');
    }
  } catch (err) {
    console.error('Failed to delete insight:', err);
    if (window.showToast) {
      showToast(isZh() ? '删除洞察失败' : 'Failed to delete insight', 'error');
    }
  }
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

    // Reload insights history to show the new analysis result
    await loadPromptInsightsHistory();

    showRefreshToast(t('toast.completed') + ' (' + tool + ')', 'success');
  } catch (err) {
    console.error('CLI insights analysis failed:', err);
    showRefreshToast(t('prompt.insightsError') + ': ' + err.message, 'error');
  } finally {
    window.insightsAnalyzing = false;
    renderPromptHistoryView();
  }
}
