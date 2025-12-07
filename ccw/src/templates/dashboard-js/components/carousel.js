// ==========================================
// CAROUSEL COMPONENT
// ==========================================
// Active session carousel with detailed task info and smooth transitions

let carouselIndex = 0;
let carouselSessions = [];
let carouselInterval = null;
let carouselPaused = false;
const CAROUSEL_INTERVAL_MS = 5000; // 5 seconds

function initCarousel() {
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const pauseBtn = document.getElementById('carouselPause');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      carouselPrev();
      resetCarouselInterval();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      carouselNext();
      resetCarouselInterval();
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', toggleCarouselPause);
  }
}

function updateCarousel() {
  // Get active sessions from workflowData
  const previousSessions = carouselSessions;
  const previousIndex = carouselIndex;
  const previousSessionId = previousSessions[previousIndex]?.session_id;

  carouselSessions = workflowData.activeSessions || [];

  // Try to preserve current position
  if (previousSessionId && carouselSessions.length > 0) {
    // Find if the same session still exists
    const newIndex = carouselSessions.findIndex(s => s.session_id === previousSessionId);
    if (newIndex !== -1) {
      carouselIndex = newIndex;
    } else if (previousIndex < carouselSessions.length) {
      // Keep same index if valid
      carouselIndex = previousIndex;
    } else {
      // Reset to last valid index
      carouselIndex = Math.max(0, carouselSessions.length - 1);
    }
  } else {
    carouselIndex = 0;
  }

  renderCarouselDots();
  renderCarouselSlide('none');
  startCarouselInterval();
}

function renderCarouselDots() {
  const dotsContainer = document.getElementById('carouselDots');
  if (!dotsContainer) return;

  if (carouselSessions.length === 0) {
    dotsContainer.innerHTML = '';
    return;
  }

  dotsContainer.innerHTML = carouselSessions.map((_, index) => `
    <button class="carousel-dot w-2 h-2 rounded-full transition-all duration-200 ${index === carouselIndex ? 'bg-primary w-4' : 'bg-muted-foreground/40 hover:bg-muted-foreground/60'}"
            onclick="carouselGoToIndex(${index})" title="Session ${index + 1}"></button>
  `).join('');
}

function updateActiveDot() {
  const dots = document.querySelectorAll('.carousel-dot');
  dots.forEach((dot, index) => {
    if (index === carouselIndex) {
      dot.classList.remove('bg-muted-foreground/40', 'hover:bg-muted-foreground/60', 'w-2');
      dot.classList.add('bg-primary', 'w-4');
    } else {
      dot.classList.remove('bg-primary', 'w-4');
      dot.classList.add('bg-muted-foreground/40', 'hover:bg-muted-foreground/60', 'w-2');
    }
  });
}

function carouselGoToIndex(index) {
  if (index < 0 || index >= carouselSessions.length) return;
  const direction = index > carouselIndex ? 'left' : (index < carouselIndex ? 'right' : 'none');
  carouselIndex = index;
  renderCarouselSlide(direction);
  updateActiveDot();
  resetCarouselInterval();
}

function renderCarouselSlide(direction = 'none') {
  const container = document.getElementById('carouselContent');

  if (!container) return;

  if (carouselSessions.length === 0) {
    container.innerHTML = `
      <div class="carousel-empty flex items-center justify-center h-full text-muted-foreground">
        <div class="text-center">
          <div class="text-3xl mb-2">🎯</div>
          <p class="text-sm">No active sessions</p>
        </div>
      </div>
    `;
    return;
  }

  const session = carouselSessions[carouselIndex];
  const tasks = session.tasks || [];
  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const taskCount = session.taskCount || tasks.length;
  const progress = taskCount > 0 ? Math.round((completed / taskCount) * 100) : 0;

  // Get session type badge
  const sessionType = session.type || 'workflow';
  const typeBadgeClass = getSessionTypeBadgeClass(sessionType);

  const sessionKey = `session-${session.session_id}`.replace(/[^a-zA-Z0-9-]/g, '-');

  // Animation class based on direction
  const animClass = direction === 'left' ? 'carousel-slide-left' :
                    direction === 'right' ? 'carousel-slide-right' : 'carousel-fade-in';

  // Get recent task activity
  const recentTasks = getRecentTaskActivity(tasks);

  // Format timestamps
  const createdTime = session.created_at ? formatRelativeTime(session.created_at) : '';
  const updatedTime = session.updated_at ? formatRelativeTime(session.updated_at) : '';

  // Get more tasks for display (up to 4)
  const displayTasks = getRecentTaskActivity(tasks, 4);

  container.innerHTML = `
    <div class="carousel-slide ${animClass} h-full">
      <div class="session-card h-full p-3 cursor-pointer hover:bg-hover/30 transition-colors"
           onclick="showSessionDetailPage('${sessionKey}')">

        <!-- Two Column Layout -->
        <div class="flex gap-4 h-full">

          <!-- Left Column: Session Info -->
          <div class="flex-1 flex flex-col min-w-0">
            <!-- Session Header -->
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="px-2 py-0.5 text-xs font-medium rounded ${typeBadgeClass}">${sessionType}</span>
              ${inProgress > 0 ? `<span class="inline-flex items-center gap-1 text-xs text-warning"><span class="w-2 h-2 rounded-full bg-warning animate-pulse"></span>${inProgress} running</span>` : ''}
            </div>
            <h4 class="font-semibold text-foreground text-sm line-clamp-1 mb-2" title="${escapeHtml(session.session_id)}">${escapeHtml(session.session_id)}</h4>

            <!-- Progress -->
            <div class="mb-2">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-muted-foreground">Progress</span>
                <span class="text-foreground font-medium">${completed}/${taskCount}</span>
              </div>
              <div class="h-1.5 bg-muted rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-success' : 'bg-primary'}" style="width: ${progress}%"></div>
              </div>
            </div>

            <!-- Task Status Summary -->
            <div class="flex items-center gap-3 text-xs mb-2">
              <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-success"></span>${completed}</span>
              <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-warning ${inProgress > 0 ? 'animate-pulse' : ''}"></span>${inProgress}</span>
              <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-muted-foreground"></span>${pending}</span>
            </div>

            <!-- Footer -->
            <div class="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span>📅 ${createdTime}</span>
              ${updatedTime && updatedTime !== createdTime ? `<span>🔄 ${updatedTime}</span>` : ''}
            </div>
          </div>

          <!-- Right Column: Task List -->
          <div class="w-[45%] flex flex-col border-l border-border pl-3">
            <div class="text-xs font-medium text-muted-foreground mb-1.5">Recent Tasks</div>
            <div class="task-list flex-1 space-y-1 overflow-hidden">
              ${displayTasks.length > 0 ? displayTasks.map(task => `
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="shrink-0">${getTaskStatusEmoji(task.status)}</span>
                  <span class="truncate flex-1 ${task.status === 'in_progress' ? 'text-foreground font-medium' : 'text-muted-foreground'}">${escapeHtml(task.title || task.id || 'Task')}</span>
                </div>
              `).join('') : `
                <div class="text-xs text-muted-foreground">No tasks yet</div>
              `}
            </div>
            <!-- Progress percentage -->
            <div class="mt-auto pt-1 text-right">
              <span class="text-xl font-bold ${progress === 100 ? 'text-success' : 'text-primary'}">${progress}%</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  // Store session data for navigation
  if (!sessionDataStore[sessionKey]) {
    sessionDataStore[sessionKey] = session;
  }
}

function getSessionTypeBadgeClass(type) {
  const classes = {
    'tdd': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'review': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'test': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'docs': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'workflow': 'bg-primary-light text-primary'
  };
  return classes[type] || classes['workflow'];
}

function getRecentTaskActivity(tasks, limit = 4) {
  if (!tasks || tasks.length === 0) return [];

  // Get in_progress tasks first, then most recently updated
  const sorted = [...tasks].sort((a, b) => {
    // in_progress first
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    // Then by updated_at
    const timeA = a.updated_at || a.created_at || '';
    const timeB = b.updated_at || b.created_at || '';
    return timeB.localeCompare(timeA);
  });

  // Return top N tasks
  return sorted.slice(0, limit);
}

function getTaskStatusEmoji(status) {
  const emojis = {
    'completed': '✅',
    'in_progress': '🔄',
    'pending': '⏸️',
    'blocked': '🚫'
  };
  return emojis[status] || '📋';
}

function getTaskStatusIcon(status) {
  return status === 'in_progress' ? 'animate-spin-slow' : '';
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // Format as date for older
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return dateString;
  }
}

function carouselNext() {
  if (carouselSessions.length === 0) return;
  carouselIndex = (carouselIndex + 1) % carouselSessions.length;
  renderCarouselSlide('left');
  updateActiveDot();
}

function carouselPrev() {
  if (carouselSessions.length === 0) return;
  carouselIndex = (carouselIndex - 1 + carouselSessions.length) % carouselSessions.length;
  renderCarouselSlide('right');
  updateActiveDot();
}

function startCarouselInterval() {
  stopCarouselInterval();
  if (!carouselPaused && carouselSessions.length > 1) {
    carouselInterval = setInterval(carouselNext, CAROUSEL_INTERVAL_MS);
  }
}

function stopCarouselInterval() {
  if (carouselInterval) {
    clearInterval(carouselInterval);
    carouselInterval = null;
  }
}

function resetCarouselInterval() {
  if (!carouselPaused) {
    startCarouselInterval();
  }
}

function toggleCarouselPause() {
  carouselPaused = !carouselPaused;
  const icon = document.getElementById('carouselPauseIcon');

  if (carouselPaused) {
    stopCarouselInterval();
    // Change to play icon
    if (icon) {
      icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
  } else {
    startCarouselInterval();
    // Change to pause icon
    if (icon) {
      icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    }
  }
}

// Jump to specific session in carousel
function carouselGoTo(sessionId) {
  const index = carouselSessions.findIndex(s => s.session_id === sessionId);
  if (index !== -1) {
    carouselIndex = index;
    renderCarouselSlide('none');
    updateActiveDot();
    resetCarouselInterval();
  }
}
