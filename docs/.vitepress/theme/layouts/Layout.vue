<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { onBeforeUnmount, onMounted } from 'vue'
import { useDynamicIcon } from '../composables/useDynamicIcon'
import ThemeLogo from '../components/ThemeLogo.vue'

let mediaQuery: MediaQueryList | null = null
let systemThemeChangeHandler: (() => void) | null = null
let storageHandler: ((e: StorageEvent) => void) | null = null

function applyTheme() {
  const savedTheme = localStorage.getItem('ccw-theme') || 'blue'
  document.documentElement.setAttribute('data-theme', savedTheme)
}

function applyColorMode() {
  const mode = localStorage.getItem('ccw-color-mode') || 'auto'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'auto' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

// Initialize dynamic favicon system
useDynamicIcon()

onMounted(() => {
  applyTheme()
  applyColorMode()

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemThemeChangeHandler = () => {
    const mode = localStorage.getItem('ccw-color-mode') || 'auto'
    if (mode === 'auto') applyColorMode()
  }
  mediaQuery.addEventListener('change', systemThemeChangeHandler)

  storageHandler = (e: StorageEvent) => {
    if (e.key === 'ccw-theme') applyTheme()
    if (e.key === 'ccw-color-mode') applyColorMode()
  }
  window.addEventListener('storage', storageHandler)
})

onBeforeUnmount(() => {
  if (mediaQuery && systemThemeChangeHandler) {
    mediaQuery.removeEventListener('change', systemThemeChangeHandler)
  }
  if (storageHandler) window.removeEventListener('storage', storageHandler)
})
</script>

<template>
  <DefaultTheme.Layout>
    <!-- Custom logo in navbar that follows theme color -->
    <template #nav-bar-title-before>
      <ThemeLogo class="nav-logo" />
    </template>

    <template #home-hero-after>
      <div class="hero-extensions">
        <div class="hero-stats">
          <div class="stat-item">
            <div class="stat-value">27+</div>
            <div class="stat-label">Built-in Skills</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">10+</div>
            <div class="stat-label">Agent Types</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">4</div>
            <div class="stat-label">Workflow Levels</div>
          </div>
        </div>
      </div>
    </template>

    <template #layout-top>
      <a href="#VPContent" class="skip-link">Skip to main content</a>
    </template>

    <template #nav-bar-content-after>
      <div class="nav-extensions">
        <DocSearch />
        <DarkModeToggle />
        <ThemeSwitcher />
      </div>
    </template>
  </DefaultTheme.Layout>
</template>

<style scoped>
.hero-extensions {
  margin-top: 40px;
  text-align: center;
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 48px;
  flex-wrap: wrap;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--vp-c-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin-top: 4px;
}

.nav-extensions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  padding-left: 16px;
}

.nav-logo {
  width: 24px;
  height: 24px;
  margin-right: 8px;
  flex-shrink: 0;
}

/* Hide the default VitePress logo image since we use our custom component */
:deep(.VPNavBarTitle .logo) {
  display: none;
}

.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 8px 16px;
  background: var(--vp-c-primary);
  color: white;
  text-decoration: none;
  z-index: 9999;
  transition: top 0.3s;
}

.skip-link:focus {
  top: 0;
}

@media (max-width: 768px) {
  .hero-stats {
    gap: 24px;
  }

  .stat-value {
    font-size: 24px;
  }

  .stat-label {
    font-size: 12px;
  }

  .nav-extensions {
    gap: 8px;
    padding-left: 8px;
  }
}
</style>
