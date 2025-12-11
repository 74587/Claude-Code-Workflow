// ==========================================
// GLOBAL NOTIFICATION SYSTEM
// ==========================================
// Floating notification panel accessible from any view

/**
 * Initialize global notification panel
 */
function initGlobalNotifications() {
  // Create FAB and panel if not exists
  if (!document.getElementById('globalNotificationFab')) {
    const fabHtml = `
      <div class="global-notif-fab" id="globalNotificationFab" onclick="toggleGlobalNotifications()" title="Notifications">
        <span class="fab-icon">🔔</span>
        <span class="fab-badge" id="globalNotifBadge">0</span>
      </div>
      
      <div class="global-notif-panel" id="globalNotificationPanel">
        <div class="global-notif-header">
          <span class="global-notif-title">🔔 Notifications</span>
          <button class="global-notif-close" onclick="toggleGlobalNotifications()">×</button>
        </div>
        <div class="global-notif-actions">
          <button class="notif-action-btn" onclick="clearGlobalNotifications()">
            <span>🗑️</span> Clear All
          </button>
        </div>
        <div class="global-notif-list" id="globalNotificationList">
          <div class="global-notif-empty">
            <span>No notifications</span>
            <p>System events and task updates will appear here</p>
          </div>
        </div>
      </div>
    `;
    
    const container = document.createElement('div');
    container.id = 'globalNotificationContainer';
    container.innerHTML = fabHtml;
    document.body.appendChild(container);
  }
  
  renderGlobalNotifications();
}

/**
 * Toggle notification panel visibility
 */
function toggleGlobalNotifications() {
  isNotificationPanelVisible = !isNotificationPanelVisible;
  const panel = document.getElementById('globalNotificationPanel');
  const fab = document.getElementById('globalNotificationFab');
  
  if (panel && fab) {
    if (isNotificationPanelVisible) {
      panel.classList.add('show');
      fab.classList.add('active');
    } else {
      panel.classList.remove('show');
      fab.classList.remove('active');
    }
  }
}

/**
 * Add a global notification
 * @param {string} type - 'info', 'success', 'warning', 'error'
 * @param {string} message - Main notification message
 * @param {string} details - Optional details
 * @param {string} source - Optional source identifier (e.g., 'explorer', 'mcp')
 */
function addGlobalNotification(type, message, details = null, source = null) {
  const notification = {
    id: Date.now(),
    type,
    message,
    details,
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
 * Render notification list
 */
function renderGlobalNotifications() {
  const listEl = document.getElementById('globalNotificationList');
  if (!listEl) return;
  
  if (globalNotificationQueue.length === 0) {
    listEl.innerHTML = `
      <div class="global-notif-empty">
        <span>No notifications</span>
        <p>System events and task updates will appear here</p>
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = globalNotificationQueue.map(notif => {
    const typeIcon = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌'
    }[notif.type] || 'ℹ️';
    
    const time = formatNotifTime(notif.timestamp);
    const sourceLabel = notif.source ? `<span class="notif-source">${notif.source}</span>` : '';
    
    return `
      <div class="global-notif-item type-${notif.type} ${notif.read ? 'read' : ''}" data-id="${notif.id}">
        <div class="notif-item-header">
          <span class="notif-icon">${typeIcon}</span>
          <span class="notif-message">${escapeHtml(notif.message)}</span>
          ${sourceLabel}
        </div>
        ${notif.details ? `<div class="notif-details">${escapeHtml(notif.details)}</div>` : ''}
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
 * Update notification badge
 */
function updateGlobalNotifBadge() {
  const badge = document.getElementById('globalNotifBadge');
  if (badge) {
    const unreadCount = globalNotificationQueue.filter(n => !n.read).length;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }
}

/**
 * Clear all notifications
 */
function clearGlobalNotifications() {
  globalNotificationQueue = [];

  // Clear from localStorage
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

  // Save to localStorage
  if (typeof saveNotificationsToStorage === 'function') {
    saveNotificationsToStorage();
  }

  renderGlobalNotifications();
  updateGlobalNotifBadge();
}

