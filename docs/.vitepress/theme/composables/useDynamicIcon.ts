import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

/**
 * Theme color mappings for light and dark modes
 */
export const THEME_COLORS = {
  blue: {
    light: '#3B82F6',
    dark: '#60A5FA'
  },
  green: {
    light: '#22C55E',
    dark: '#34D399'
  },
  orange: {
    light: '#F59E0B',
    dark: '#FBBF24'
  },
  purple: {
    light: '#8B5CF6',
    dark: '#A78BFA'
  }
} as const

export type ThemeName = keyof typeof THEME_COLORS

/**
 * Status dot colors (always green)
 */
export const STATUS_COLORS = {
  light: '#22C55E',
  dark: '#34D399'
} as const

const STORAGE_KEY_THEME = 'ccw-theme'
const STORAGE_KEY_COLOR_MODE = 'ccw-color-mode'

/**
 * Check if running in browser environment
 */
const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined'

/**
 * Get current theme from localStorage or default
 */
export function getCurrentTheme(): ThemeName {
  if (!isBrowser) return 'blue'
  const saved = localStorage.getItem(STORAGE_KEY_THEME)
  if (saved && saved in THEME_COLORS) {
    return saved as ThemeName
  }
  return 'blue'
}

/**
 * Check if dark mode is active
 */
export function isDarkMode(): boolean {
  if (!isBrowser) return false
  const mode = localStorage.getItem(STORAGE_KEY_COLOR_MODE) || 'auto'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return mode === 'dark' || (mode === 'auto' && prefersDark)
}

/**
 * Get the appropriate theme color based on current mode
 */
export function getThemeColor(theme: ThemeName, isDark: boolean): string {
  return isDark ? THEME_COLORS[theme].dark : THEME_COLORS[theme].light
}

/**
 * Get the appropriate status color based on current mode
 */
export function getStatusColor(isDark: boolean): string {
  return isDark ? STATUS_COLORS.dark : STATUS_COLORS.light
}

/**
 * Generate favicon SVG with dynamic colors (line style)
 */
export function generateFaviconSvg(theme: ThemeName, isDark: boolean): string {
  const lineColor = getThemeColor(theme, isDark)
  const dotColor = getThemeColor(theme, isDark)  // Dot follows theme color

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <line x1="3" y1="6" x2="18" y2="6" stroke="${lineColor}" stroke-width="2" stroke-linecap="round"/>
  <line x1="3" y1="12" x2="15" y2="12" stroke="${lineColor}" stroke-width="2" stroke-linecap="round"/>
  <line x1="3" y1="18" x2="12" y2="18" stroke="${lineColor}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="19" cy="17" r="3" fill="${dotColor}"/>
</svg>`
}

/**
 * Update the favicon with current theme colors
 */
export function updateFavicon(theme: ThemeName, isDark: boolean): void {
  const svg = generateFaviconSvg(theme, isDark)
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`

  // Update existing favicon or create new one
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/svg+xml'
    document.head.appendChild(link)
  }
  link.href = dataUrl

  // Also update apple-touch-icon if exists
  const appleLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (appleLink) {
    appleLink.href = dataUrl
  }
}

/**
 * Composable for dynamic icon management
 */
export function useDynamicIcon() {
  const currentTheme = ref<ThemeName>(getCurrentTheme())
  const darkMode = ref(isDarkMode())

  let mediaQuery: MediaQueryList | null = null
  let mutationObserver: MutationObserver | null = null
  let storageHandler: ((e: StorageEvent) => void) | null = null

  /**
   * Update favicon based on current state
   */
  const updateIcon = () => {
    updateFavicon(currentTheme.value, darkMode.value)
  }

  /**
   * Check and update dark mode state
   */
  const checkDarkMode = () => {
    darkMode.value = isDarkMode()
    updateIcon()
  }

  /**
   * Check and update theme state
   */
  const checkTheme = () => {
    currentTheme.value = getCurrentTheme()
    updateIcon()
  }

  onMounted(() => {
    // Initial update
    updateIcon()

    // Listen for system color scheme changes
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', checkDarkMode)

    // Listen for storage changes (cross-tab sync)
    storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_THEME) checkTheme()
      if (e.key === STORAGE_KEY_COLOR_MODE) checkDarkMode()
    }
    window.addEventListener('storage', storageHandler)

    // Observe DOM changes for dark class and data-theme attribute
    mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement
          if (mutation.attributeName === 'class') {
            const isDark = target.classList.contains('dark')
            if (isDark !== darkMode.value) {
              darkMode.value = isDark
              updateIcon()
            }
          }
          if (mutation.attributeName === 'data-theme') {
            const theme = target.getAttribute('data-theme') as ThemeName
            if (theme && theme !== currentTheme.value && theme in THEME_COLORS) {
              currentTheme.value = theme
              updateIcon()
            }
          }
        }
      }
    })

    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    })
  })

  onBeforeUnmount(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', checkDarkMode)
    }
    if (storageHandler) {
      window.removeEventListener('storage', storageHandler)
    }
    if (mutationObserver) {
      mutationObserver.disconnect()
    }
  })

  return {
    currentTheme,
    darkMode,
    updateIcon,
    themeColors: THEME_COLORS
  }
}

export type UseDynamicIconReturn = ReturnType<typeof useDynamicIcon>
