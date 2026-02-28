<template>
  <div class="workflow-animation">
    <div class="workflow-container">
      <div class="workflow-node coordinator">
        <div class="node-icon">🎯</div>
        <div class="node-label">Coordinator</div>
      </div>
      
      <div class="workflow-paths">
        <svg class="path-svg" viewBox="0 0 400 200">
          <!-- Spec Path -->
          <path class="flow-path path-spec" d="M50,100 Q150,20 250,50" fill="none" stroke="#3B82F6" stroke-width="2"/>
          <circle class="flow-dot dot-spec" r="6" fill="#3B82F6">
            <animateMotion dur="3s" repeatCount="indefinite" path="M50,100 Q150,20 250,50"/>
          </circle>
          
          <!-- Impl Path -->
          <path class="flow-path path-impl" d="M50,100 Q150,100 250,100" fill="none" stroke="#10B981" stroke-width="2"/>
          <circle class="flow-dot dot-impl" r="6" fill="#10B981">
            <animateMotion dur="2.5s" repeatCount="indefinite" path="M50,100 Q150,100 250,100"/>
          </circle>
          
          <!-- Test Path -->
          <path class="flow-path path-test" d="M50,100 Q150,180 250,150" fill="none" stroke="#F59E0B" stroke-width="2"/>
          <circle class="flow-dot dot-test" r="6" fill="#F59E0B">
            <animateMotion dur="3.5s" repeatCount="indefinite" path="M50,100 Q150,180 250,150"/>
          </circle>
        </svg>
      </div>
      
      <div class="workflow-nodes">
        <div class="workflow-node analyst">
          <div class="node-icon">📊</div>
          <div class="node-label">Analyst</div>
        </div>
        <div class="workflow-node writer">
          <div class="node-icon">✍️</div>
          <div class="node-label">Writer</div>
        </div>
        <div class="workflow-node executor">
          <div class="node-icon">⚡</div>
          <div class="node-label">Executor</div>
        </div>
        <div class="workflow-node tester">
          <div class="node-icon">🧪</div>
          <div class="node-label">Tester</div>
        </div>
      </div>
    </div>
    
    <div class="workflow-legend">
      <div class="legend-item"><span class="dot spec"></span> Spec Phase</div>
      <div class="legend-item"><span class="dot impl"></span> Impl Phase</div>
      <div class="legend-item"><span class="dot test"></span> Test Phase</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  // Add animation class after mount
  document.querySelector('.workflow-animation')?.classList.add('animate')
})
</script>

<style scoped>
.workflow-animation {
  padding: 2rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 24px;
  margin: 2rem 0;
  overflow: hidden;
}

.workflow-container {
  display: flex;
  align-items: center;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 2rem;
  min-height: 200px;
}

.workflow-paths {
  flex: 1.2;
  min-width: 280px;
  max-width: 450px;
}

.path-svg {
  width: 100%;
  height: auto;
}

.flow-path {
  stroke-dasharray: 6, 6;
  opacity: 0.3;
  animation: dash 30s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: -120;
  }
}

.flow-dot {
  filter: drop-shadow(0 0 4px currentColor);
}

.workflow-nodes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  flex: 0.8;
  min-width: 200px;
}

.workflow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  box-shadow: var(--vp-shadow-sm);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.workflow-node:hover {
  transform: translateY(-4px);
  border-color: var(--vp-c-brand-1);
  box-shadow: var(--vp-shadow-md);
}

.node-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.node-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.workflow-node.coordinator {
  grid-column: span 2;
  background: linear-gradient(135deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  border: none;
  color: white;
}

.workflow-node.coordinator .node-label {
  color: white;
}

.workflow-legend {
  display: flex;
  justify-content: center;
  gap: 2.5rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot.spec { background: var(--vp-c-brand-1); }
.dot.impl { background: var(--vp-c-secondary-500); }
.dot.test { background: var(--vp-c-accent-400); }

@media (max-width: 768px) {
  .workflow-animation {
    padding: 1.5rem;
  }
  
  .workflow-container {
    flex-direction: column;
  }
  
  .workflow-nodes {
    width: 100%;
  }
}
</style>
