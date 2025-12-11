// ==========================================
// MODAL DIALOGS
// ==========================================

// Generic Modal Functions
function showModal(title, content, options = {}) {
  // Remove existing modal if any
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'generic-modal-overlay';
  overlay.innerHTML = `
    <div class="generic-modal ${options.size || ''}">
      <div class="generic-modal-header">
        <h3 class="generic-modal-title">${escapeHtml(title)}</h3>
        <button class="generic-modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="generic-modal-body">
        ${content}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => overlay.classList.add('active'));

  // Initialize Lucide icons in modal
  if (window.lucide) lucide.createIcons();

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

function closeModal() {
  const overlay = document.querySelector('.generic-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 200);
  }
}

// SVG Icons
const icons = {
  folder: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
  check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  terminal: '<svg viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>'
};

function showPathSelectedModal(dirName, dirHandle) {
  // Try to guess full path based on current project path
  const currentPath = projectPath || '';
  const basePath = currentPath.substring(0, currentPath.lastIndexOf('/')) || 'D:/projects';
  const suggestedPath = basePath + '/' + dirName;

  const modal = document.createElement('div');
  modal.className = 'path-modal-overlay';
  modal.innerHTML = `
    <div class="path-modal">
      <div class="path-modal-header">
        <span class="path-modal-icon">${icons.folder}</span>
        <h3>Folder Selected</h3>
      </div>
      <div class="path-modal-body">
        <div class="selected-folder">
          <strong>${dirName}</strong>
        </div>
        <p class="path-modal-note">
          Confirm or edit the full path:
        </p>
        <div class="path-input-group" style="margin-top: 12px;">
          <label>Full path:</label>
          <input type="text" id="fullPathInput" value="${suggestedPath}" />
          <button class="path-go-btn" id="pathGoBtn">Open</button>
        </div>
      </div>
      <div class="path-modal-footer">
        <button class="path-modal-close" id="pathCancelBtn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Add event listeners (use arrow functions to ensure proper scope)
  document.getElementById('pathGoBtn').addEventListener('click', () => {
    console.log('Open button clicked');
    goToPath();
  });
  document.getElementById('pathCancelBtn').addEventListener('click', () => closePathModal());

  // Focus input, select all text, and add enter key listener
  setTimeout(() => {
    const input = document.getElementById('fullPathInput');
    input?.focus();
    input?.select();
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') goToPath();
    });
  }, 100);
}

function showPathInputModal() {
  const modal = document.createElement('div');
  modal.className = 'path-modal-overlay';
  modal.innerHTML = `
    <div class="path-modal">
      <div class="path-modal-header">
        <span class="path-modal-icon">${icons.folder}</span>
        <h3>Open Project</h3>
      </div>
      <div class="path-modal-body">
        <div class="path-input-group" style="margin-top: 0;">
          <label>Project path:</label>
          <input type="text" id="fullPathInput" placeholder="D:/projects/my-project" />
          <button class="path-go-btn" id="pathGoBtn">Open</button>
        </div>
      </div>
      <div class="path-modal-footer">
        <button class="path-modal-close" id="pathCancelBtn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Add event listeners (use arrow functions to ensure proper scope)
  document.getElementById('pathGoBtn').addEventListener('click', () => {
    console.log('Open button clicked');
    goToPath();
  });
  document.getElementById('pathCancelBtn').addEventListener('click', () => closePathModal());

  // Focus input and add enter key listener
  setTimeout(() => {
    const input = document.getElementById('fullPathInput');
    input?.focus();
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') goToPath();
    });
  }, 100);
}

function goToPath() {
  const input = document.getElementById('fullPathInput');
  const path = input?.value?.trim();
  if (path) {
    closePathModal();
    selectPath(path);
  } else {
    // Show error - input is empty
    input.style.borderColor = 'var(--danger-color)';
    input.placeholder = 'Please enter a path';
    input.focus();
  }
}

function closePathModal() {
  const modal = document.querySelector('.path-modal-overlay');
  if (modal) {
    modal.remove();
  }
}

function copyCommand(btn, dirName) {
  const input = document.getElementById('fullPathInput');
  const path = input?.value?.trim() || `[full-path-to-${dirName}]`;
  const command = `ccw view -p "${path}"`;
  navigator.clipboard.writeText(command).then(() => {
    btn.innerHTML = icons.check + ' <span>Copied!</span>';
    setTimeout(() => { btn.innerHTML = icons.copy + ' <span>Copy</span>'; }, 2000);
  });
}

function showJsonModal(jsonId, taskId) {
  // Get JSON from memory store instead of DOM
  const rawTask = taskJsonStore[jsonId];
  if (!rawTask) return;

  const jsonContent = JSON.stringify(rawTask, null, 2);

  // Create modal
  const overlay = document.createElement('div');
  overlay.className = 'json-modal-overlay';
  overlay.innerHTML = `
    <div class="json-modal">
      <div class="json-modal-header">
        <div class="json-modal-title">
          <span class="task-id-badge">${escapeHtml(taskId)}</span>
          <span>Task JSON</span>
        </div>
        <button class="json-modal-close" onclick="closeJsonModal(this)">&times;</button>
      </div>
      <div class="json-modal-body">
        <pre class="json-modal-content">${escapeHtml(jsonContent)}</pre>
      </div>
      <div class="json-modal-footer">
        <button class="btn-copy-json" onclick="copyJsonToClipboard(this)">Copy JSON</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => overlay.classList.add('active'));

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeJsonModal(overlay.querySelector('.json-modal-close'));
  });

  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeJsonModal(overlay.querySelector('.json-modal-close'));
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

function closeJsonModal(btn) {
  const overlay = btn.closest('.json-modal-overlay');
  overlay.classList.remove('active');
  setTimeout(() => overlay.remove(), 200);
}

function copyJsonToClipboard(btn) {
  const content = btn.closest('.json-modal').querySelector('.json-modal-content').textContent;
  navigator.clipboard.writeText(content).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = original, 2000);
  });
}

function openMarkdownModal(title, content, type = 'markdown') {
  const modal = document.getElementById('markdownModal');
  const titleEl = document.getElementById('markdownModalTitle');
  const rawEl = document.getElementById('markdownRaw');
  const previewEl = document.getElementById('markdownPreview');

  // Normalize line endings
  const normalizedContent = normalizeLineEndings(content);

  titleEl.textContent = title;
  rawEl.textContent = normalizedContent;

  // Render preview based on type
  if (typeof marked !== 'undefined' && type === 'markdown') {
    previewEl.innerHTML = marked.parse(normalizedContent);
  } else if (type === 'json') {
    // For JSON, try to parse and re-stringify with formatting
    try {
      const parsed = typeof normalizedContent === 'string' ? JSON.parse(normalizedContent) : normalizedContent;
      const formatted = JSON.stringify(parsed, null, 2);
      previewEl.innerHTML = '<pre class="whitespace-pre-wrap language-json">' + escapeHtml(formatted) + '</pre>';
    } catch (e) {
      // If not valid JSON, show as-is
      previewEl.innerHTML = '<pre class="whitespace-pre-wrap">' + escapeHtml(normalizedContent) + '</pre>';
    }
  } else {
    // Fallback: simple text with line breaks
    previewEl.innerHTML = '<pre class="whitespace-pre-wrap">' + escapeHtml(normalizedContent) + '</pre>';
  }

  // Show modal and default to preview tab
  modal.classList.remove('hidden');
  switchMarkdownTab('preview');
}

function closeMarkdownModal() {
  const modal = document.getElementById('markdownModal');
  modal.classList.add('hidden');
}

function switchMarkdownTab(tab) {
  const rawEl = document.getElementById('markdownRaw');
  const previewEl = document.getElementById('markdownPreview');
  const rawTabBtn = document.getElementById('mdTabRaw');
  const previewTabBtn = document.getElementById('mdTabPreview');

  if (tab === 'raw') {
    rawEl.classList.remove('hidden');
    previewEl.classList.add('hidden');
    rawTabBtn.classList.add('active', 'bg-background', 'text-foreground');
    rawTabBtn.classList.remove('text-muted-foreground');
    previewTabBtn.classList.remove('active', 'bg-background', 'text-foreground');
    previewTabBtn.classList.add('text-muted-foreground');
  } else {
    rawEl.classList.add('hidden');
    previewEl.classList.remove('hidden');
    previewTabBtn.classList.add('active', 'bg-background', 'text-foreground');
    previewTabBtn.classList.remove('text-muted-foreground');
    rawTabBtn.classList.remove('active', 'bg-background', 'text-foreground');
    rawTabBtn.classList.add('text-muted-foreground');
  }
}
