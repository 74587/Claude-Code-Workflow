// ==========================================
// THEME MANAGEMENT
// ==========================================

function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
  updateHljsTheme(saved);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
    updateHljsTheme(next);
  });
}

function updateThemeIcon(theme) {
  const darkIcon = document.querySelector('.theme-icon-dark');
  const lightIcon = document.querySelector('.theme-icon-light');
  if (darkIcon && lightIcon) {
    if (theme === 'light') {
      darkIcon.classList.remove('hidden');
      lightIcon.classList.add('hidden');
    } else {
      darkIcon.classList.add('hidden');
      lightIcon.classList.remove('hidden');
    }
  }
}

function updateHljsTheme(theme) {
  // Toggle highlight.js theme stylesheets
  const darkTheme = document.getElementById('hljs-theme-dark');
  const lightTheme = document.getElementById('hljs-theme-light');
  
  if (darkTheme && lightTheme) {
    if (theme === 'dark') {
      darkTheme.disabled = false;
      lightTheme.disabled = true;
    } else {
      darkTheme.disabled = true;
      lightTheme.disabled = false;
    }
  }
}
