<template>
  <div class="agent-orchestration">
    <div class="orchestration-title">🤖 Agent Orchestration</div>
    
    <div class="agent-flow">
      <!-- CLI Layer -->
      <div class="flow-layer cli-layer">
        <div class="layer-label">CLI Tools</div>
        <div class="agents-row">
          <div class="agent-card cli" @mouseenter="showTooltip('cli-explore')" @mouseleave="hideTooltip">🔍 Explore</div>
          <div class="agent-card cli" @mouseenter="showTooltip('cli-plan')" @mouseleave="hideTooltip">📋 Plan</div>
          <div class="agent-card cli" @mouseenter="showTooltip('cli-exec')" @mouseleave="hideTooltip">⚡ Execute</div>
          <div class="agent-card cli" @mouseenter="showTooltip('cli-discuss')" @mouseleave="hideTooltip">💬 Discuss</div>
        </div>
      </div>
      
      <!-- Flow Arrow -->
      <div class="flow-arrow">▼</div>
      
      <!-- Development Layer -->
      <div class="flow-layer dev-layer">
        <div class="layer-label">Development</div>
        <div class="agents-row">
          <div class="agent-card dev" @mouseenter="showTooltip('code-dev')" @mouseleave="hideTooltip">👨‍💻 Code</div>
          <div class="agent-card dev" @mouseenter="showTooltip('tdd')" @mouseleave="hideTooltip">🧪 TDD</div>
          <div class="agent-card dev" @mouseenter="showTooltip('test-fix')" @mouseleave="hideTooltip">🔧 Fix</div>
        </div>
      </div>
      
      <!-- Flow Arrow -->
      <div class="flow-arrow">▼</div>
      
      <!-- Output Layer -->
      <div class="flow-layer output-layer">
        <div class="layer-label">Output</div>
        <div class="agents-row">
          <div class="agent-card doc" @mouseenter="showTooltip('doc-gen')" @mouseleave="hideTooltip">📄 Docs</div>
          <div class="agent-card ui" @mouseenter="showTooltip('ui-design')" @mouseleave="hideTooltip">🎨 UI</div>
          <div class="agent-card universal" @mouseenter="showTooltip('universal')" @mouseleave="hideTooltip">🌐 Universal</div>
        </div>
      </div>
    </div>
    
    <div class="tooltip" v-if="tooltip" :class="{ visible: tooltip }">
      {{ tooltipText }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const tooltip = ref(false)
const tooltipText = ref('')

const tooltips = {
  'cli-explore': 'cli-explore-agent: 代码库探索和语义搜索',
  'cli-plan': 'cli-planning-agent: 任务规划和分解',
  'cli-exec': 'cli-execution-agent: 命令执行和结果处理',
  'cli-discuss': 'cli-discuss-agent: 多视角讨论和共识达成',
  'code-dev': 'code-developer: 代码实现和开发',
  'tdd': 'tdd-developer: 测试驱动开发',
  'test-fix': 'test-fix-agent: 测试修复循环',
  'doc-gen': 'doc-generator: 文档自动生成',
  'ui-design': 'ui-design-agent: UI设计和设计令牌',
  'universal': 'universal-executor: 通用任务执行器'
}

function showTooltip(key) {
  tooltipText.value = tooltips[key] || ''
  tooltip.value = true
}

function hideTooltip() {
  tooltip.value = false
}
</script>

<style scoped>
.agent-orchestration {
  padding: 3rem 2rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 24px;
  margin: 2rem 0;
  position: relative;
  overflow: hidden;
}

.orchestration-title {
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 2.5rem;
}

.agent-flow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.flow-layer {
  width: 100%;
  max-width: 600px;
}

.layer-label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--vp-c-text-3);
  margin-bottom: 0.75rem;
  text-align: center;
}

.agents-row {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.agent-card {
  padding: 0.8rem 1.5rem;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  border: 1px solid transparent;
}

.agent-card.cli {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-color: rgba(59, 130, 246, 0.2);
}

.agent-card.dev {
  background: rgba(16, 185, 129, 0.1);
  color: #10B981;
  border-color: rgba(16, 185, 129, 0.2);
}

.agent-card.doc {
  background: rgba(139, 92, 246, 0.1);
  color: #8B5CF6;
  border-color: rgba(139, 92, 246, 0.2);
}

.agent-card.ui {
  background: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
  border-color: rgba(245, 158, 11, 0.2);
}

.agent-card.universal {
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.agent-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.flow-arrow {
  color: var(--vp-c-divider);
  font-size: 1.25rem;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50% { transform: translateY(8px); opacity: 1; }
}

.tooltip {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0;
  transition: all 0.3s;
  pointer-events: none;
  box-shadow: var(--vp-shadow-md);
  z-index: 10;
}

.tooltip.visible {
  opacity: 1;
}

@media (max-width: 640px) {
  .agent-orchestration {
    padding: 2rem 1rem;
  }
  
  .agent-card {
    padding: 0.6rem 1rem;
    font-size: 0.8rem;
  }
}
</style>
