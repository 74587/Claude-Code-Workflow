// ==========================================
// VERSION CHECK COMPONENT
// ==========================================
// Checks for npm package updates and displays upgrade notification

// State
let versionCheckData = null;
let versionBannerDismissed = false;

/**
 * Initialize version check on page load
 */
async function initVersionCheck() {
  // Check version after a short delay to not block initial render
  setTimeout(async () => {
    await checkForUpdates();
  }, 2000);
}

/**
 * Check for package updates
 */
async function checkForUpdates() {
  try {
    const res = await fetch('/api/version-check');
    if (!res.ok) return;

    versionCheckData = await res.json();

    if (versionCheckData.hasUpdate && !versionBannerDismissed) {
      showUpdateBanner(versionCheckData);
      addGlobalNotification(
        'info',
        'Update Available',
        'Version ' + versionCheckData.latestVersion + ' is now available. Current: ' + versionCheckData.currentVersion,
        'system'
      );
    }
  } catch (err) {
    console.log('Version check skipped:', err.message);
  }
}

/**
 * Show update banner at top of page
 */
function showUpdateBanner(data) {
  // Remove existing banner if any
  const existing = document.getElementById('versionUpdateBanner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'versionUpdateBanner';
  banner.className = 'version-update-banner';
  banner.innerHTML = '\
    <div class="version-banner-content">\
      <span class="version-banner-icon">🚀</span>\
      <span class="version-banner-text">\
        <strong>Update Available!</strong> \
        Version <code>' + escapeHtml(data.latestVersion) + '</code> is available \
        (you have <code>' + escapeHtml(data.currentVersion) + '</code>)\
      </span>\
      <button class="version-banner-btn" onclick="copyUpdateCommand()">\
        <span>📋</span> Copy Command\
      </button>\
      <button class="version-banner-btn secondary" onclick="showUpdateModal()">\
        <span>ℹ️</span> Details\
      </button>\
      <button class="version-banner-close" onclick="dismissUpdateBanner()" title="Dismiss">\
        ×\
      </button>\
    </div>\
  ';

  // Insert at top of main content
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.insertBefore(banner, mainContent.firstChild);
  } else {
    document.body.insertBefore(banner, document.body.firstChild);
  }

  // Animate in
  requestAnimationFrame(() => banner.classList.add('show'));
}

/**
 * Dismiss update banner
 */
function dismissUpdateBanner() {
  versionBannerDismissed = true;
  const banner = document.getElementById('versionUpdateBanner');
  if (banner) {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
  }
}

/**
 * Copy update command to clipboard
 */
async function copyUpdateCommand() {
  if (!versionCheckData) return;

  try {
    await navigator.clipboard.writeText(versionCheckData.updateCommand);
    addGlobalNotification('success', 'Command copied to clipboard', versionCheckData.updateCommand, 'version-check');
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = versionCheckData.updateCommand;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    addGlobalNotification('success', 'Command copied to clipboard', null, 'version-check');
  }
}

/**
 * Show update details modal
 */
function showUpdateModal() {
  if (!versionCheckData) return;

  const content = '\
# Update Available\n\
\n\
A new version of Claude Code Workflow is available!\n\
\n\
| Property | Value |\n\
|----------|-------|\n\
| Current Version | `' + versionCheckData.currentVersion + '` |\n\
| Latest Version | `' + versionCheckData.latestVersion + '` |\n\
| Package | `' + versionCheckData.packageName + '` |\n\
\n\
## Update Command\n\
\n\
```bash\n\
' + versionCheckData.updateCommand + '\n\
```\n\
\n\
## Alternative Methods\n\
\n\
### Using ccw upgrade command\n\
```bash\n\
ccw upgrade\n\
```\n\
\n\
### Fresh install\n\
```bash\n\
npm install -g ' + versionCheckData.packageName + '@latest\n\
```\n\
\n\
---\n\
*Checked at: ' + new Date(versionCheckData.checkedAt).toLocaleString() + '*\n\
';

  showMarkdownModal(content, 'Update Available - v' + versionCheckData.latestVersion);
}

/**
 * Get current version info (for display in UI)
 */
function getVersionInfo() {
  return versionCheckData;
}
