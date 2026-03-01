<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import CodeViewer from './CodeViewer.vue'

interface Props {
  name: string              // Demo component name
  file?: string            // Optional: explicit source file
  height?: string          // Demo container height
  expandable?: boolean     // Allow expand/collapse
  showCode?: boolean       // Show code tab
  title?: string           // Custom demo title
}

const props = withDefaults(defineProps<Props>(), {
  height: 'auto',
  expandable: true,
  showCode: true,
  title: ''
})

const demoRoot = ref<HTMLElement>()
const reactRoot = ref<Root>()
const sourceCode = ref('')
const isExpanded = ref(false)
const activeTab = ref<'preview' | 'code'>('preview')
const isLoading = ref(true)
const loadError = ref('')

// Derive demo title
const demoTitle = computed(() => props.title || props.name)

onMounted(async () => {
  try {
    // Dynamically import demo component
    const demoModule = await import(`../demos/${props.name}.tsx`)
    const DemoComponent = demoModule.default || demoModule[props.name]

    if (!DemoComponent) {
      throw new Error(`Demo component "${props.name}" not found`)
    }

    // Mount React component
    if (demoRoot.value) {
      reactRoot.value = createRoot(demoRoot.value)
      reactRoot.value.render(DemoComponent)

      // Extract source code
      try {
        const rawModule = await import(`../demos/${props.name}.tsx?raw`)
        sourceCode.value = rawModule.default || rawModule
      } catch {
        sourceCode.value = '// Source code not available'
      }
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load demo'
    console.error('DemoContainer load error:', err)
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  reactRoot.value?.unmount()
})

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const switchTab = (tab: 'preview' | 'code') => {
  activeTab.value = tab
}
</script>

<template>
  <div class="demo-container" :class="{ expanded: isExpanded }">
    <!-- Demo Header -->
    <div class="demo-header">
      <span class="demo-title">{{ demoTitle }}</span>
      <div class="demo-actions">
        <button
          v-if="expandable"
          class="demo-toggle"
          :aria-expanded="isExpanded"
          @click="toggleExpanded"
        >
          {{ isExpanded ? '收起' : '展开' }}
        </button>
        <button
          v-if="showCode"
          class="tab-button"
          :class="{ active: activeTab === 'preview' }"
          :aria-selected="activeTab === 'preview'"
          @click="switchTab('preview')"
        >
          预览
        </button>
        <button
          v-if="showCode"
          class="tab-button"
          :class="{ active: activeTab === 'code' }"
          :aria-selected="activeTab === 'code'"
          @click="switchTab('code')"
        >
          代码
        </button>
      </div>
    </div>

    <!-- Demo Content -->
    <div
      class="demo-content"
      :style="{ height: isExpanded ? 'auto' : height }"
    >
      <!-- Loading State -->
      <div v-if="isLoading" class="demo-loading">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="loadError" class="demo-error">
        <span class="error-icon">⚠️</span>
        <span class="error-message">{{ loadError }}</span>
      </div>

      <!-- Preview Content -->
      <div
        v-else-if="activeTab === 'preview'"
        ref="demoRoot"
        class="demo-preview"
      />

      <!-- Code Content -->
      <CodeViewer
        v-else-if="showCode && activeTab === 'code'"
        :code="sourceCode"
        lang="tsx"
      />
    </div>
  </div>
</template>

<style scoped>
.demo-container {
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  margin: 16px 0;
  overflow: hidden;
  background: var(--vp-c-bg);
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
}

.demo-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--vp-c-text-1);
}

.demo-actions {
  display: flex;
  gap: 8px;
}

.demo-toggle,
.tab-button {
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.2s;
}

.demo-toggle:hover,
.tab-button:hover {
  background: var(--vp-c-bg-mute);
}

.tab-button.active {
  background: var(--vp-c-bg);
  color: var(--vp-c-brand);
  font-weight: 500;
}

.demo-content {
  background: var(--vp-c-bg);
  transition: height 0.3s ease;
}

.demo-preview {
  padding: 24px;
  min-height: 100px;
}

.demo-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--vp-c-text-2);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--vp-c-border);
  border-top-color: var(--vp-c-brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.demo-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--vp-c-danger-1);
  background: var(--vp-c-danger-soft);
}

.error-icon {
  font-size: 24px;
}

.error-message {
  font-size: 14px;
}

.demo-container.expanded .demo-content {
  height: auto !important;
}

/* Responsive */
@media (max-width: 768px) {
  .demo-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .demo-actions {
    width: 100%;
    justify-content: space-between;
  }

  .demo-preview {
    padding: 16px;
  }
}
</style>
