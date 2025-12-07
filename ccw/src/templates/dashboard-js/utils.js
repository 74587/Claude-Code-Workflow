// ========================================
// Utility Functions
// ========================================
// General-purpose helper functions used across the application

// ========== HTML/Text Processing ==========

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML insertion
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Truncate text to specified maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLen - Maximum length (including ellipsis)
 * @returns {string} Truncated text with '...' if needed
 */
function truncateText(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen - 3) + '...' : text;
}

/**
 * Normalize line endings in content
 * Handles both literal \r\n escape sequences and actual newlines
 * @param {string} content - Content to normalize
 * @returns {string} Content with normalized line endings (LF only)
 */
function normalizeLineEndings(content) {
  if (!content) return '';
  let normalized = content;
  // If content has literal \r\n or \n as text (escaped), convert to actual newlines
  if (normalized.includes('\\r\\n')) {
    normalized = normalized.replace(/\\r\\n/g, '\n');
  } else if (normalized.includes('\\n')) {
    normalized = normalized.replace(/\\n/g, '\n');
  }
  // Normalize CRLF to LF for consistent rendering
  normalized = normalized.replace(/\r\n/g, '\n');
  return normalized;
}

// ========== Date/Time Formatting ==========

/**
 * Format ISO date string to human-readable format
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date string (YYYY/MM/DD HH:mm) or '-' if invalid
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (isNaN(date.getTime())) return '-';
    // Format: YYYY/MM/DD HH:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  } catch (e) {
    return '-';
  }
}

// ========== UI Helpers ==========

/**
 * Get color for relevance score visualization
 * @param {number} score - Relevance score (0-1)
 * @returns {string} CSS color value
 */
function getRelevanceColor(score) {
  if (score >= 0.95) return '#10b981';
  if (score >= 0.90) return '#3b82f6';
  if (score >= 0.80) return '#f59e0b';
  return '#6b7280';
}

/**
 * Get CSS class for role badge styling
 * @param {string} role - Role identifier
 * @returns {string} CSS class name
 */
function getRoleBadgeClass(role) {
  const roleMap = {
    'core-hook': 'primary',
    'api-client': 'success',
    'api-router': 'info',
    'service-layer': 'warning',
    'pydantic-schemas': 'secondary',
    'orm-model': 'secondary',
    'typescript-types': 'info'
  };
  return roleMap[role] || 'secondary';
}

/**
 * Toggle collapsible section visibility
 * @param {HTMLElement} header - Section header element
 */
function toggleSection(header) {
  const content = header.nextElementSibling;
  const icon = header.querySelector('.collapse-icon');
  const isCollapsed = content.classList.contains('collapsed');

  content.classList.toggle('collapsed');
  header.classList.toggle('expanded');
  icon.textContent = isCollapsed ? '▼' : '▶';

  // Render flowchart if expanding flow_control section
  if (isCollapsed && header.querySelector('.section-label')?.textContent === 'flow_control') {
    const taskId = content.closest('[data-task-id]')?.dataset.taskId;
    if (taskId) {
      const task = taskJsonStore[taskId];
      if (task?.flow_control) {
        setTimeout(() => renderFullFlowchart(task.flow_control), 100);
      }
    }
  }
}

/**
 * Initialize collapsible sections within a container
 * @param {HTMLElement} container - Container element to search within
 */
function initCollapsibleSections(container) {
  setTimeout(() => {
    const headers = container.querySelectorAll('.collapsible-header');
    headers.forEach(header => {
      if (!header._clickBound) {
        header._clickBound = true;
        header.addEventListener('click', function(e) {
          e.stopPropagation();
          toggleSection(this);
        });
      }
    });
  }, 100);
}
