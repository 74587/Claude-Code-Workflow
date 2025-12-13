// ==========================================
// GLOBAL NOTIFICATION SYSTEM - Right Sidebar
// ==========================================
// Right-side slide-out toolbar for notifications and quick actions

/**
 * Initialize global notification sidebar
 */
function initGlobalNotifications() {
  // Create sidebar if not exists
  if (!document.getElementById('notifSidebar')) {
    const sidebarHtml = `
      <div class="notif-sidebar" id="notifSidebar">
        <div class="notif-sidebar-header">
          <div class="notif-sidebar-title">
            <span class="notif-title-icon">🔔</span>
            <span>Notifications</span>
            <span class="notif-count-badge" id="notifCountBadge">0</span>
          </div>
          <button class="notif-sidebar-close" onclick="toggleNotifSidebar()" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="notif-sidebar-actions">
          <button class="notif-action-btn" onclick="markAllNotificationsRead()" title="Mark all read">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <span>Mark Read</span>
          </button>
          <button class="notif-action-btn" onclick="clearGlobalNotifications()" title="Clear all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            <span>Clear All</span>
          </button>
        </div>

        <div class="notif-sidebar-content" id="notifSidebarContent">
          <div class="notif-empty-state">
            <div class="notif-empty-icon">🔔</div>
            <div class="notif-empty-text">No notifications</div>
            <div class="notif-empty-hint">System events and task updates will appear here</div>
          </div>
        </div>
      </div>

      <div class="notif-sidebar-toggle" id="notifSidebarToggle" onclick="toggleNotifSidebar()" title="Notifications">
        <span class="toggle-icon">🔔</span>
        <span class="toggle-badge" id="notifToggleBadge"></span>
      </div>

      <div class="notif-sidebar-overlay" id="notifSidebarOverlay" onclick="toggleNotifSidebar()"></div>
    `;

    const container = document.createElement('div');
    container.id = 'notifSidebarContainer';
    container.innerHTML = sidebarHtml;
    document.body.appendChild(container);
  }

  renderGlobalNotifications();
  updateGlobalNotifBadge();
}

/**
 * Toggle notification sidebar visibility
 */
function toggleNotifSidebar() {
  isNotificationPanelVisible = !isNotificationPanelVisible;
  const sidebar = document.getElementById('notifSidebar');
  const overlay = document.getElementById('notifSidebarOverlay');
  const toggle = document.getElementById('notifSidebarToggle');

  if (sidebar && overlay && toggle) {
    if (isNotificationPanelVisible) {
      sidebar.classList.add('open');
      overlay.classList.add('show');
      toggle.classList.add('hidden');
      // Mark notifications as read when opened
      markAllNotificationsRead();
    } else {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
      toggle.classList.remove('hidden');
    }
  }
}

// Backward compatibility alias
function toggleGlobalNotifications() {
  toggleNotifSidebar();
}

/**
 * Add a global notification
 * @param {string} type - 'info', 'success', 'warning', 'error'
 * @param {string} message - Main notification message
 * @param {string|object} details - Optional details (string or object)
 * @param {string} source - Optional source identifier
 */
function addGlobalNotification(type, message, details = null, source = null) {
  // Format details if it's an object
  let formattedDetails = details;
  if (details && typeof details === 'object') {
    formattedDetails = formatNotificationJson(details);
  } else if (typeof details === 'string') {
    // Try to parse and format if it looks like JSON
    const trimmed = details.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        formattedDetails = formatNotificationJson(parsed);
      } catch (e) {
        // Not valid JSON, use as-is
        formattedDetails = details;
      }
    }
  }

  const notification = {
    id: Date.now(),
    type,
    message,
    details: formattedDetails,
    source,
    timestamp: new Date().toISOString(),
    read: false
  };

  globalNotificationQueue.unshift(notification);

  // Keep only last 100 notifications
  if (globalNotificationQueue.length > 100) {
    globalNotificationQueue = globalNotificationQueue.slice(0, 100);
  }

  // Persist to localStorage
  if (typeof saveNotificationsToStorage === 'function') {
    saveNotificationsToStorage();
  }

  renderGlobalNotifications();
  updateGlobalNotifBadge();

  // Show toast for important notifications
  if (type === 'error' || type === 'success') {
    showNotificationToast(notification);
  }
}

/**
 * Format JSON object for notification display
 * @param {Object} obj - Object to format
 * @returns {string} HTML formatted string
 */
function formatNotificationJson(obj) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '<span class="json-empty">(empty array)</span>';
    const items = obj.slice(0, 5).map((item, i) => {
      const itemStr = typeof item === 'object' ? JSON.stringify(item) : String(item);
      const truncated = itemStr.length > 60 ? itemStr.substring(0, 57) + '...' : itemStr;
      return `<div class="json-array-item"><span class="json-index">[${i}]</span> ${escapeHtml(truncated)}</div>`;
    });
    if (obj.length > 5) {
      items.push(`<div class="json-more">... +${obj.length - 5} more items</div>`);
    }
    return items.join('');
  }

  // Handle objects
  const entries = Object.entries(obj);
  if (entries.length === 0) return '<span class="json-empty">(empty object)</span>';

  const lines = entries.slice(0, 8).map(([key, val]) => {
    let valStr;
    let valClass = 'json-value';

    if (val === null) {
      valStr = 'null';
      valClass = 'json-null';
    } else if (val === undefined) {
      valStr = 'undefined';
      valClass = 'json-null';
    } else if (typeof val === 'boolean') {
      valStr = val ? 'true' : 'false';
      valClass = 'json-bool';
    } else if (typeof val === 'number') {
      valStr = String(val);
      valClass = 'json-number';
    } else if (typeof val === 'object') {
      valStr = JSON.stringify(val);
      if (valStr.length > 50) valStr = valStr.substring(0, 47) + '...';
      valClass = 'json-object';
    } else {
      valStr = String(val);
      if (valStr.length > 60) valStr = valStr.substring(0, 57) + '...';
      valClass = 'json-string';
    }

    return `<div class="json-field"><span class="json-key">${escapeHtml(key)}:</span> <span class="${valClass}">${escapeHtml(valStr)}</span></div>`;
  });

  if (entries.length > 8) {
    lines.push(`<div class="json-more">... +${entries.length - 8} more fields</div>`);
  }

  return lines.join('');
}

/**
 * Show a brief toast notification
 */
function showNotificationToast(notification) {
  const typeIcon = {
    'info': 'ℹ️',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌'
  }[notification.type] || 'ℹ️';

  // Remove existing toast
  const existing = document.querySelector('.notif-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `notif-toast type-${notification.type}`;
  toast.innerHTML = `
    <span class="toast-icon">${typeIcon}</span>
    <span class="toast-message">${escapeHtml(notification.message)}</span>
  `;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto-remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Render notification list in sidebar
 */
function renderGlobalNotifications() {
  const contentEl = document.getElementById('notifSidebarContent');
  if (!contentEl) return;

  if (globalNotificationQueue.length === 0) {
    contentEl.innerHTML = `
      <div class="notif-empty-state">
        <div class="notif-empty-icon">🔔</div>
        <div class="notif-empty-text">No notifications</div>
        <div class="notif-empty-hint">System events and task updates will appear here</div>
      </div>
    `;
    return;
  }

  contentEl.innerHTML = globalNotificationQueue.map(notif => {
    const typeIcon = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌'
    }[notif.type] || 'ℹ️';

    const time = formatNotifTime(notif.timestamp);
    const sourceLabel = notif.source ? `<span class="notif-source">${escapeHtml(notif.source)}</span>` : '';

    // Details may already be HTML formatted or plain text
    let detailsHtml = '';
    if (notif.details) {
      // Check if details is already HTML formatted (contains our json-* classes)
      if (typeof notif.details === 'string' && notif.details.includes('class="json-')) {
        detailsHtml = `<div class="notif-details-json">${notif.details}</div>`;
      } else {
        detailsHtml = `<div class="notif-details">${escapeHtml(String(notif.details))}</div>`;
      }
    }

    return `
      <div class="notif-item type-${notif.type} ${notif.read ? 'read' : ''}" data-id="${notif.id}">
        <div class="notif-item-header">
          <span class="notif-icon">${typeIcon}</span>
          <div class="notif-item-content">
            <span class="notif-message">${escapeHtml(notif.message)}</span>
            ${sourceLabel}
          </div>
        </div>
        ${detailsHtml}
        <div class="notif-meta">
          <span class="notif-time">${time}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Format notification time
 */
function formatNotifTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

/**
 * Update notification badge counts
 */
function updateGlobalNotifBadge() {
  const unreadCount = globalNotificationQueue.filter(n => !n.read).length;

  const countBadge = document.getElementById('notifCountBadge');
  const toggleBadge = document.getElementById('notifToggleBadge');

  if (countBadge) {
    countBadge.textContent = globalNotificationQueue.length;
    countBadge.style.display = globalNotificationQueue.length > 0 ? 'inline-flex' : 'none';
  }

  if (toggleBadge) {
    toggleBadge.textContent = unreadCount;
    toggleBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }
}

/**
 * Clear all notifications
 */
function clearGlobalNotifications() {
  globalNotificationQueue = [];

  if (typeof saveNotificationsToStorage === 'function') {
    saveNotificationsToStorage();
  }

  renderGlobalNotifications();
  updateGlobalNotifBadge();
}

/**
 * Mark all as read
 */
function markAllNotificationsRead() {
  globalNotificationQueue.forEach(n => n.read = true);

  if (typeof saveNotificationsToStorage === 'function') {
    saveNotificationsToStorage();
  }

  renderGlobalNotifications();
  updateGlobalNotifBadge();
}
