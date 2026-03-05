<template>
  <div class="agent-orchestration">
    <div class="orchestration-title">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="title-icon">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      Agent Orchestration
    </div>

    <div class="agent-flow">
      <!-- CLI Layer -->
      <div class="flow-layer cli-layer">
        <div class="layer-label">CLI Tools</div>
        <div class="agents-row">
          <div class="agent-card cli" @mouseenter="showTooltip('cli-explore')" @mouseleave="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Explore
          </div>
          <div class="agent-card cli" @mouseenter="showTooltip('cli-plan')" @mouseleave="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>
            Plan
          </div>
          <div class="agent-card cli" @mouseenter="showTooltip('cli-exec')" @mouseleave="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Execute
          </div>
          <div class="agent-card cli" @mouseenter="showTooltip('cli-discuss')" @mouseleave="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Discuss
          </div>
        </div>
      </div>

      <!-- Flow Arrow -->
      <div class="flow-arrow">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
        </svg>
      </div>

      <!-- Development Layer -->
      <div class="flow-layer dev-layer">
        <div class="layer-label">Development</div>
        <div class="agents-row">
          <div class="agent-card dev" @mouseenter="showTooltip('code-dev')" @mouseleave="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            Code
          </div>
          <div class="agent-card dev" @mouseenter="showTooltip('tdd')" @mouseleave="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M12 3v7l-4 8h8l-4-8"/><circle cx="8" cy="20" r="1"/><circle cx="16" cy="20" r="1"/></svg>
            TDD
          </div>
          <div class="agent-card dev" @mouseenter="showTooltip('test-fix')" @mouseleave="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
            Fix
          </div>
        </div>
      </div>

      <!-- Flow Arrow -->
      <div class="flow-arrow">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
        </svg>
      </div>

      <!-- Output Layer -->
      <div class="flow-layer output-layer">
        <div class="layer-label">Output</div>
        <div class="agents-row">
          <div class="agent-card doc" @mouseenter="showTooltip('doc-gen')" @mouseleave="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></svg>
            Docs
          </div>
          <div class="agent-card ui" @mouseenter="showTooltip('ui-design')" @mouseleave="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            UI
          </div>
          <div class="agent-card universal" @mouseenter="showTooltip('universal')" @mouseleave="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            Universal
          </div>
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
  'cli-explore': 'cli-explore-agent: Codebase exploration & semantic search',
  'cli-plan': 'cli-planning-agent: Task planning & decomposition',
  'cli-exec': 'cli-execution-agent: Command execution & result handling',
  'cli-discuss': 'cli-discuss-agent: Multi-perspective discussion & consensus',
  'code-dev': 'code-developer: Code implementation & development',
  'tdd': 'tdd-developer: Test-driven development',
  'test-fix': 'test-fix-agent: Test-fix iteration loop',
  'doc-gen': 'doc-generator: Auto documentation generation',
  'ui-design': 'ui-design-agent: UI design & design tokens',
  'universal': 'universal-executor: General-purpose task executor'
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 2.5rem;
}

.title-icon {
  color: var(--vp-c-brand-1);
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
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
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
  color: var(--vp-c-text-4);
  animation: arrowBounce 2s ease-in-out infinite;
}

@keyframes arrowBounce {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50% { transform: translateY(6px); opacity: 0.8; }
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

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@media (max-width: 768px) {
  .agent-orchestration {
    padding: 2rem 1rem;
  }

  .agent-card {
    padding: 0.6rem 1rem;
    font-size: 0.8rem;
  }
}
</style>
