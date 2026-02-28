<template>
  <div class="hero-animation-container" :class="{ 'is-visible': isVisible }">
    <div class="glow-bg"></div>
    <svg viewBox="0 0 400 320" class="hero-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--vp-c-brand-1)" stop-opacity="0" />
          <stop offset="50%" stop-color="var(--vp-c-brand-1)" stop-opacity="0.5" />
          <stop offset="100%" stop-color="var(--vp-c-brand-1)" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Connection Lines -->
      <g class="data-paths">
        <path v-for="(path, i) in paths" :key="'path-'+i" :d="path" class="connection-path" />
        <circle v-for="(path, i) in paths" :key="'dot-'+i" r="2" class="data-pulse">
          <animateMotion :dur="2 + i * 0.4 + 's'" repeatCount="indefinite" :path="path" />
        </circle>
      </g>

      <!-- Orbit Rings -->
      <g class="orbit-rings">
        <circle cx="200" cy="160" r="130" class="orbit-ring ring-outer" />
        <circle cx="200" cy="160" r="95" class="orbit-ring ring-inner" />
      </g>

      <!-- Agent Nodes -->
      <g v-for="(agent, i) in agents" :key="'agent-'+i" class="agent-node" :style="{ '--delay': i * 0.4 + 's' }">
        <g class="agent-group" :style="{ transform: `translate(${agent.x}px, ${agent.y}px)` }">
          <circle r="8" :fill="agent.color" class="agent-circle" filter="url(#glow)" />
          <circle r="12" :stroke="agent.color" fill="none" class="agent-halo" />
          <text y="22" text-anchor="middle" class="agent-label">{{ agent.name }}</text>
        </g>
      </g>

      <!-- Central Core -->
      <g class="central-core" transform="translate(200, 160)">
        <circle r="40" class="core-bg" />
        <circle r="32" fill="var(--vp-c-brand-1)" filter="url(#glow)" class="core-inner" />
        <text y="8" text-anchor="middle" class="core-text">CCW</text>
        
        <!-- Scanning Effect -->
        <path d="M-32 0 A32 32 0 0 1 32 0" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" class="core-scanner" />
      </g>
    </svg>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const isVisible = ref(false)

onMounted(() => {
  setTimeout(() => {
    isVisible.value = true
  }, 100)
})

const agents = [
  { name: 'Analyze', x: 200, y: 35, color: '#3B82F6' },
  { name: 'Plan', x: 315, y: 110, color: '#10B981' },
  { name: 'Code', x: 285, y: 245, color: '#8B5CF6' },
  { name: 'Test', x: 115, y: 245, color: '#F59E0B' },
  { name: 'Review', x: 85, y: 110, color: '#EF4444' }
]

const paths = [
  'M200,160 L200,35',
  'M200,160 L315,110',
  'M200,160 L285,245',
  'M200,160 L115,245',
  'M200,160 L85,110',
  'M200,35 Q260,35 315,110',
  'M315,110 Q315,180 285,245',
  'M285,245 Q200,285 115,245',
  'M115,245 Q85,180 85,110',
  'M85,110 Q85,35 200,35'
]
</script>

<style scoped>
.hero-animation-container {
  width: 100%;
  max-width: 480px;
  position: relative;
  opacity: 0;
  transform: scale(0.95);
  transition: all 1s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.hero-animation-container.is-visible {
  opacity: 1;
  transform: scale(1);
}

.glow-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150px;
  height: 150px;
  background: var(--vp-c-brand-1);
  filter: blur(80px);
  opacity: 0.15;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.hero-svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.orbit-ring {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 0.5;
  opacity: 0.1;
  stroke-dasharray: 4 4;
}

.ring-outer { animation: rotate 60s linear infinite; transform-origin: 200px 160px; }
.ring-inner { animation: rotate 40s linear infinite reverse; transform-origin: 200px 160px; }

.connection-path {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 0.8;
  opacity: 0.05;
}

.data-pulse {
  fill: var(--vp-c-brand-2);
  filter: drop-shadow(0 0 4px var(--vp-c-brand-2));
}

.agent-group {
  transition: all 0.3s ease;
}

.agent-circle {
  transition: all 0.3s ease;
}

.agent-halo {
  opacity: 0.2;
  animation: agent-pulse 2s ease-in-out infinite;
  transform-origin: center;
}

.agent-label {
  font-size: 10px;
  fill: var(--vp-c-text-2);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.core-bg {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-brand-soft);
  stroke-width: 1;
}

.core-inner {
  opacity: 0.8;
}

.core-text {
  font-size: 14px;
  font-weight: 800;
  fill: white;
  letter-spacing: 0.05em;
}

.core-scanner {
  animation: rotate 3s linear infinite;
  opacity: 0.6;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes agent-pulse {
  0%, 100% { transform: scale(1); opacity: 0.2; }
  50% { transform: scale(1.3); opacity: 0.1; }
}

.agent-node {
  animation: agent-float 4s ease-in-out infinite;
  animation-delay: var(--delay);
}

@keyframes agent-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.hero-animation-container:hover .agent-circle {
  filter: blur(2px) brightness(1.5);
}
</style>