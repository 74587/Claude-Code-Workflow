<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useData } from 'vitepress'

const { site, lang, page } = useData()

const isOpen = ref(false)
const switcherRef = ref<HTMLElement>()

// Get available locales from VitePress config
const locales = computed(() => {
  const localeConfig = site.value.locales || {}
  return Object.entries(localeConfig).map(([code, config]) => ({
    code,
    label: (config as any).label || code,
    link: (config as any).link || `/${code === 'root' ? '' : code}/`
  }))
})

// Current locale
const currentLocale = computed(() => {
  const current = locales.value.find(l => l.code === lang.value)
  return current || locales.value[0]
})

// Get alternate language link for current page
const getAltLink = (localeCode: string) => {
  if (localeCode === 'root') localeCode = ''

  // Get current page path without locale prefix
  const currentPath = page.value.relativePath
  const altPath = localeCode ? `/${localeCode}/${currentPath}` : `/${currentPath}`

  return altPath
}

const switchLanguage = (localeCode: string) => {
  const altLink = getAltLink(localeCode)
  window.location.href = altLink
}

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (switcherRef.value && !switcherRef.value.contains(e.target as Node)) {
      isOpen.value = false
    }
  }
  document.addEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="switcherRef" class="language-switcher">
    <button
      class="switcher-button"
      :aria-expanded="isOpen"
      aria-label="Switch language"
      @click="isOpen = !isOpen"
    >
      <span class="current-locale">{{ currentLocale?.label }}</span>
      <span class="dropdown-icon" :class="{ open: isOpen }">▼</span>
    </button>

    <Transition name="fade">
      <ul v-if="isOpen" class="locale-list">
        <li v-for="locale in locales" :key="locale.code">
          <button
            class="locale-button"
            :class="{ active: locale.code === lang }"
            @click="switchLanguage(locale.code)"
          >
            <span class="locale-label">{{ locale.label }}</span>
            <span v-if="locale.code === lang" class="check-icon">✓</span>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.language-switcher {
  position: relative;
  display: inline-block;
}

.switcher-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.switcher-button:hover {
  background: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand);
}

.current-locale {
  font-weight: 500;
}

.dropdown-icon {
  font-size: 10px;
  transition: transform 0.2s;
}

.dropdown-icon.open {
  transform: rotate(180deg);
}

.locale-list {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 150px;
  list-style: none;
  margin: 0;
  padding: 4px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.locale-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.locale-button:hover {
  background: var(--vp-c-bg-mute);
}

.locale-button.active {
  background: var(--vp-c-brand);
  color: white;
}

.locale-label {
  font-weight: 500;
}

.check-icon {
  font-size: 16px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Responsive */
@media (max-width: 768px) {
  .locale-list {
    right: auto;
    left: 0;
  }
}
</style>
