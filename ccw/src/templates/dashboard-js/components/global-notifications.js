// ==========================================
// GLOBAL NOTIFICATION SYSTEM - Right Sidebar
// ==========================================
// Right-side slide-out toolbar for notifications and quick actions
// Supports browser system notifications (cross-platform)

// Notification settings
let notifSettings = {
  systemNotifEnabled: false,
  soundEnabled: false
};

/**
 * Initialize global notification sidebar
 */
function initGlobalNotifications() {
  // Load settings from localStorage
  loadNotifSettings();
  
  // Request notification permission if enabled
  if (notifSettings.systemNotifEnabled) {
    requestNotificationPermission();
  }

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

        <div class="notif-sidebar-settings" id="notifSettings">
          <label class="notif-setting-item">
            <input type="checkbox" id="systemNotifToggle" onchange="toggleSystemNotifications(this.checked)">
            <span class="notif-setting-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              System Notifications
            </span>
          </label>
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
    
    // Initialize toggle state
    const toggle = document.getElementById('systemNotifToggle');
    if (toggle) {
      toggle.checked = notifSettings.systemNotifEnabled;
    }
  }

  renderGlobalNotifications();
  updateGlobalNotifBadge();
}

/**
 * Load notification settings from localStorage
 */
function loadNotifSettings() {
  try {
    const saved = localStorage.getItem('ccw_notif_settings');
    if (saved) {
      notifSettings = { ...notifSettings, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('[Notif] Failed to load settings:', e);
  }
}

/**
 * Save notification settings to localStorage
 */
function saveNotifSettings() {
  try {
    localStorage.setItem('ccw_notif_settings', JSON.stringify(notifSettings));
  } catch (e) {
    console.error('[Notif] Failed to save settings:', e);
  }
}

/**
 * Toggle system notifications
 */
function toggleSystemNotifications(enabled) {
  notifSettings.systemNotifEnabled = enabled;
  saveNotifSettings();
  
  if (enabled) {
    requestNotificationPermission();
  }
}

/**
 * Request browser notification permission
 */
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('[Notif] Browser does not support notifications');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
}

/**
 * Show system notification (browser notification)
 */
function showSystemNotification(notification) {
  if (!notifSettings.systemNotifEnabled) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  
  const typeIcon = {
    'info': 'ℹ️',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌'
  }[notification.type] || '🔔';
  
  const title = `${typeIcon} ${notification.message}`;
  let body = '';
  
  if (notification.source) {
    body = `[${notification.source}]`;
  }
  
  // Extract plain text from details if HTML formatted
  if (notification.details) {
    const detailText = notification.details.replace(/<[^>]*>/g, '').trim();
    if (detailText) {
      body += body ? '\n' + detailText : detailText;
    }
  }
  
  try {
    const sysNotif = new Notification(title, {
      body: body.substring(0, 200),
      icon: '/favicon.ico',
      tag: `ccw-notif-${notification.id}`,
      requireInteraction: notification.type === 'error'
    });
    
    // Click to open sidebar
    sysNotif.onclick = () => {
      window.focus();
      if (!isNotificationPanelVisible) {
        toggleNotifSidebar();
      }
      sysNotif.close();
    };
    
    // Auto close after 5s (except errors)
    if (notification.type !== 'error') {
      setTimeout(() => sysNotif.close(), 5000);
    }
  } catch (e) {
    console.error('[Notif] Failed to show system notification:', e);
  }
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
  let rawDetails = details; // Keep raw for system notification
  
  if (details && typeof details === 'object') {
    formattedDetails = formatNotificationJson(details);
    rawDetails = JSON.stringify(details, null, 2);
  } else if (typeof details === 'string') {
    // Try to parse and format if it looks like JSON
    const trimmed = details.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        formattedDetails = formatNotificationJson(parsed);
        rawDetails = JSON.stringify(parsed, null, 2);
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
    rawDetails: rawDetails,
    source,
    timestamp: new Date().toISOString(),
    read: false,
    expanded: false
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

  // Show system notification instead of toast
  showSystemNotification(notification);
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
 * Toggle notification item expansion
 */
function toggleNotifExpand(notifId) {
  const notif = globalNotificationQueue.find(n => n.id === notifId);
  if (notif) {
    notif.expanded = !notif.expanded;
    renderGlobalNotifications();
  }
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
    const hasDetails = notif.details && notif.details.length > 0;
    const expandIcon = hasDetails ? (notif.expanded ? '▼' : '▶') : '';

    // Details section - collapsed by default, show preview
    let detailsHtml = '';
    if (hasDetails) {
      if (notif.expanded) {
        // Expanded view - show full details
        if (typeof notif.details === 'string' && notif.details.includes('class="json-')) {
          detailsHtml = `<div class="notif-details-json notif-details-expanded">${notif.details}</div>`;
        } else {
          detailsHtml = `<div class="notif-details notif-details-expanded">${escapeHtml(String(notif.details))}</div>`;
        }
      } else {
        // Collapsed view - show hint
        detailsHtml = `<div class="notif-details-hint">Click to view details</div>`;
      }
    }

    return `
      <div class="notif-item type-${notif.type} ${notif.read ? 'read' : ''} ${hasDetails ? 'has-details' : ''} ${notif.expanded ? 'expanded' : ''}" 
           data-id="${notif.id}" 
           onclick="toggleNotifExpand(${notif.id})">
        <div class="notif-item-header">
          <span class="notif-icon">${typeIcon}</span>
          <div class="notif-item-content">
            <span class="notif-message">${escapeHtml(notif.message)}</span>
            ${sourceLabel}
          </div>
          ${hasDetails ? `<span class="notif-expand-icon">${expandIcon}</span>` : ''}
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
