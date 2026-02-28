<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const dotColor = ref('var(--vp-c-primary)')

function updateDotColor() {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const style = getComputedStyle(root)
  const primaryColor = style.getPropertyValue('--vp-c-primary').trim()
  dotColor.value = primaryColor || 'currentColor'
}

let observer: MutationObserver | null = null

onMounted(() => {
  updateDotColor()

  // Watch for theme changes via MutationObserver
  observer = new MutationObserver(() => {
    updateDotColor()
  })

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class'],
  })
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    class="theme-logo"
    aria-label="Claude Code Workflow"
  >
    <!-- Three horizontal lines - use currentColor to inherit from text -->
    <line x1="3" y1="6" x2="18" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="3" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="3" y1="18" x2="12" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <!-- Status dot - follows theme primary color -->
    <circle cx="19" cy="17" r="3" :style="{ fill: dotColor }"/>
  </svg>
</template>

<style scoped>
.theme-logo {
  width: 24px;
  height: 24px;
  color: var(--vp-c-text-1);
}

.theme-logo circle {
  fill: var(--vp-c-primary);
  transition: fill 0.3s ease;
}
</style>
