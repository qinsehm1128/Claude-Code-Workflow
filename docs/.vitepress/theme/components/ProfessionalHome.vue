<template>
  <div class="pro-home">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-container">
        <div class="hero-content">
          <h1 class="hero-title" v-html="t.heroTitle"></h1>
          <p class="hero-subtitle">{{ t.heroSubtitle }}</p>

          <div class="hero-actions">
            <a :href="localePath + '/guide/getting-started'" class="btn-primary">
              <svg class="btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              {{ t.getStarted }}
            </a>
            <a href="https://github.com/anthropics/claude-code" class="btn-secondary" target="_blank">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
              GitHub
            </a>
          </div>
        </div>

        <div class="hero-visual">
          <HeroAnimation />
        </div>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="features-section" ref="featuresRef">
      <div class="section-container">
        <h2 class="section-title reveal-text" :class="{ visible: featuresVisible }">{{ t.featureTitle }}</h2>
        <div class="features-grid">
          <div v-for="(f, i) in t.features" :key="i" class="feature-card reveal-card" :class="{ visible: featuresVisible }" :style="{ '--card-delay': i * 0.1 + 's' }">
            <div class="feature-icon-box">
              <svg v-if="i === 0" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1"/>
              </svg>
              <svg v-else-if="i === 1" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
              <svg v-else-if="i === 2" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <h3>{{ f.title }}</h3>
            <p>{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Pipeline Visual -->
    <section class="pipeline-section" ref="pipelineRef">
      <div class="section-container">
        <div class="section-header reveal-text" :class="{ visible: pipelineVisible }">
          <h2>{{ t.pipelineTitle }}</h2>
          <p>{{ t.pipelineSubtitle }}</p>
        </div>

        <div class="pipeline-card">
          <!-- Cadence Chart -->
          <div class="cadence-chart">
            <div class="cadence-header">
              <span class="cadence-label">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {{ t.cadenceLabel }}
              </span>
              <span class="tick-count">Tick: T{{ currentTick + 1 }} / 5</span>
            </div>
            <div class="cadence-track">
              <div class="cadence-progress" :style="{ width: (currentTick / 4) * 100 + '%' }"></div>
              <div v-for="i in 5" :key="i" class="tick-node" :class="{ active: currentTick >= i-1, blocked: currentTick === 2 && i === 3 }"></div>
            </div>
          </div>

          <!-- Horizontal Pipeline -->
          <div class="pipeline-flow">
            <div v-for="(s, i) in t.pipelineStages" :key="i" class="stage-node"
                 :class="{
                    active: currentStep.stage === i,
                    done: currentStep.stage > i || currentStep.status === 'done',
                    blocked: currentStep.stage === i && currentStep.status === 'blocked'
                 }">
              <div class="stage-badge">
                <span v-if="currentStep.stage === i" class="badge-text" :class="currentStep.status">
                  <svg v-if="currentStep.status === 'blocked'" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  {{ currentStep.status === 'blocked' ? 'BLOCKED' : 'RUNNING' }}
                </span>
                <span v-else-if="currentStep.stage > i || currentStep.status === 'done'" class="badge-text done">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  DONE
                </span>
              </div>
              <div class="stage-icon" v-html="pipelineIcons[i]"></div>
              <div class="stage-info">
                <h4>{{ s.role }}</h4>
                <p>{{ s.action }}</p>
              </div>
              <div v-if="i < 2" class="connector"></div>
            </div>
          </div>

          <!-- Logic Panel -->
          <div class="logic-panel">
            <div class="control-law">
              <div class="panel-label">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {{ t.controlLawLabel }}
              </div>
              <div class="law-content font-mono">
                <div><span class="purple">Rule:</span> {{ currentStep.law.rule }}</div>
                <div><span class="cyan">Assert:</span> {{ currentStep.law.condition }}</div>
                <div class="law-result" :class="currentStep.status">{{ '=>' }} {{ currentStep.law.action }}</div>
              </div>
            </div>
            <div class="log-output">
              <div class="panel-label">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                {{ t.pipelineIOLabel }}
              </div>
              <div class="log-content font-mono" :class="currentStep.status">
                > {{ currentStep.log }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- JSON Demo -->
    <section class="json-section" ref="jsonRef">
      <div class="section-container">
        <div class="json-grid reveal-slide" :class="{ visible: jsonVisible }">
          <div class="json-text">
            <h2>{{ t.jsonTitle }}</h2>
            <p>{{ t.jsonSubtitle }}</p>
            <ul class="json-benefits">
              <li v-for="(b, i) in t.jsonBenefits" :key="i">
                <svg class="check-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {{ b }}
              </li>
            </ul>
          </div>
          <div class="json-code">
            <div class="code-header">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              workflow.json
            </div>
            <pre class="font-mono json-pre"><code v-html="highlightedWorkflowJson"></code></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- Quick Start Section -->
    <section class="quickstart-section" ref="quickstartRef">
      <div class="section-container">
        <div class="quickstart-layout reveal-slide" :class="{ visible: quickstartVisible }">
          <div class="quickstart-info">
            <h2 class="quickstart-title">{{ t.quickStartTitle }}</h2>
            <p class="quickstart-desc">{{ t.quickStartDesc }}</p>

            <div class="quickstart-steps">
              <div v-for="(step, i) in t.quickStartSteps" :key="i" class="qs-step">
                <div class="qs-step-num">{{ i + 1 }}</div>
                <div class="qs-step-content">
                  <h4>{{ step.title }}</h4>
                  <p>{{ step.desc }}</p>
                </div>
              </div>
            </div>

            <a :href="localePath + '/guide/installation'" class="btn-outline">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
              {{ t.viewFullGuide }}
            </a>
          </div>

          <div class="quickstart-terminal">
            <div class="qs-terminal-window">
              <div class="qs-terminal-header">
                <div class="dots"><span></span><span></span><span></span></div>
                <div class="qs-tab-bar">
                  <button
                    v-for="(tab, i) in t.quickStartTabs"
                    :key="i"
                    class="qs-tab"
                    :class="{ active: activeTab === i }"
                    @click="activeTab = i"
                  >
                    {{ tab.label }}
                  </button>
                </div>
              </div>
              <div class="qs-terminal-body font-mono">
                <div v-for="(line, idx) in t.quickStartTabs[activeTab].lines" :key="idx" class="qs-line" :class="line.type">
                  <span v-if="line.type === 'comment'" class="qs-comment">{{ line.text }}</span>
                  <span v-else-if="line.type === 'cmd'" class="qs-cmd"><span class="qs-prompt">$</span> {{ line.text }}</span>
                  <span v-else class="qs-output">{{ line.text }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Footer -->
    <section class="cta-section" ref="ctaRef">
      <div class="section-container">
        <div class="cta-card reveal-scale" :class="{ visible: ctaVisible }">
          <h2>{{ t.ctaTitle }}</h2>
          <p>{{ t.ctaDesc }}</p>
          <div class="cta-actions">
            <a :href="localePath + '/guide/getting-started'" class="btn-primary btn-lg">
              <svg class="btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              {{ t.getStarted }}
            </a>
            <a :href="localePath + '/cli/commands'" class="btn-ghost">
              {{ t.exploreCli }}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import HeroAnimation from './HeroAnimation.vue'

const props = defineProps({
  lang: { type: String, default: 'en' }
})

const localePath = computed(() => props.lang === 'zh' ? '/zh' : '')
const activeTab = ref(0)

// --- Scroll Reveal ---
const featuresRef = ref(null)
const pipelineRef = ref(null)
const jsonRef = ref(null)
const quickstartRef = ref(null)
const ctaRef = ref(null)

const featuresVisible = ref(false)
const pipelineVisible = ref(false)
const jsonVisible = ref(false)
const quickstartVisible = ref(false)
const ctaVisible = ref(false)

let observer = null

// --- Translations ---
const content = {
  en: {
    badge: 'v2.0 Support Precision Team Cadence',
    heroTitle: 'JSON-Driven Multi-Agent <br/> <span class="gradient-text">Collaborative Framework</span>',
    heroSubtitle: 'Industrial-grade orchestration blending 21 specialized agents and 32 core skills with precision cadence control.',
    getStarted: 'Get Started',
    featureTitle: 'The Claude Code Workflow Ecosystem',
    features: [
      { title: "21 Specialized Agents", desc: "From CLI exploration to TDD implementation and UI design token management." },
      { title: "32 Core Skills", desc: "Standalone, Team, and Workflow skills including brainstorm, spec-gen, and code-review." },
      { title: "Cadence Control", desc: "Precision global clocking coordinating complex agent handovers like an orchestra." },
      { title: "Context-First", desc: "Standardized Context Tree ensuring zero information loss across cross-model sessions." }
    ],
    pipelineTitle: 'Engineering Pipeline Mapping',
    pipelineSubtitle: 'Autonomous orchestration using control laws and global cadence to manage quality across 21 specialized roles.',
    pipelineStages: [
      { role: "Architect", action: "System Design" },
      { role: "Coders", action: "Implementation" },
      { role: "Reviewer", action: "Quality Audit" }
    ],
    cadenceLabel: 'Global Cadence',
    controlLawLabel: 'Active Control Law',
    pipelineIOLabel: 'Pipeline I/O',
    jsonTitle: 'Everything as JSON: Declarative Workflows',
    jsonSubtitle: 'Define your entire team, toolchain, and multi-stage logic in a single version-controlled configuration.',
    jsonBenefits: [
      'Orchestrate 21 specialized built-in agents',
      'Leverage 32 core skills for full lifecycle coverage',
      'Precision Tick-based synchronization (Sync/Async)'
    ],
    quickStartTitle: 'Quick Start',
    quickStartDesc: 'Up and running in under a minute.',
    quickStartSteps: [
      { title: 'Install', desc: 'One command via npm global install.' },
      { title: 'Initialize', desc: 'Scaffold config in your project root.' },
      { title: 'Run', desc: 'Launch your first multi-agent workflow.' }
    ],
    quickStartTabs: [
      {
        label: 'npm',
        lines: [
          { type: 'comment', text: '# Install CCW globally' },
          { type: 'cmd', text: 'npm install -g claude-code-workflow' },
          { type: 'output', text: 'added 1 package in 3s' },
          { type: 'comment', text: '# Initialize in your project' },
          { type: 'cmd', text: 'ccw init' },
          { type: 'output', text: '✔ Created .claude/CLAUDE.md' },
          { type: 'output', text: '✔ Created .ccw/workflows/' },
          { type: 'comment', text: '# Start a workflow' },
          { type: 'cmd', text: 'ccw workflow start --epic "feature-auth"' },
          { type: 'output', text: '⚡ Workflow started with 3 agents' }
        ]
      },
      {
        label: 'pnpm',
        lines: [
          { type: 'comment', text: '# Install CCW globally' },
          { type: 'cmd', text: 'pnpm add -g claude-code-workflow' },
          { type: 'output', text: 'Done in 2.1s' },
          { type: 'comment', text: '# Initialize in your project' },
          { type: 'cmd', text: 'ccw init' },
          { type: 'output', text: '✔ Created .claude/CLAUDE.md' },
          { type: 'output', text: '✔ Created .ccw/workflows/' },
          { type: 'comment', text: '# Start a workflow' },
          { type: 'cmd', text: 'ccw workflow start --epic "feature-auth"' },
          { type: 'output', text: '⚡ Workflow started with 3 agents' }
        ]
      }
    ],
    viewFullGuide: 'Installation Guide',
    ctaTitle: 'Ready to build with agents?',
    ctaDesc: 'Start orchestrating multi-agent workflows in your codebase today.',
    exploreCli: 'Explore CLI Reference'
  },
  zh: {
    badge: 'v2.0 现已支持精准团队节拍控制',
    heroTitle: 'JSON 驱动的多智能体 <br/> <span class="gradient-text">协同开发框架</span>',
    heroSubtitle: '融合 21 个专业代理与 32 项核心技能，通过精准节拍控制实现工业级自动化工作流处理。',
    getStarted: '快速开始',
    featureTitle: 'Claude Code Workflow 全局生态概览',
    features: [
      { title: "21 个专业代理", desc: "涵盖 CLI 探索、TDD 实现、UI 设计令牌管理等全流程智能体。" },
      { title: "32 项核心技能", desc: "独立技能、团队技能与工作流技能，覆盖头脑风暴、规格生成、代码审查等场景。" },
      { title: "节拍控制", desc: "全局精准时钟调度，像指挥交响乐团一样协调复杂的代理切换。" },
      { title: "上下文优先", desc: "标准化上下文树，确保跨模型会话间的信息零损耗传递。" }
    ],
    pipelineTitle: '工程流水线映射',
    pipelineSubtitle: '基于控制律与全局节拍器，跨 21 个专业角色实现端到端质量把控。',
    pipelineStages: [
      { role: "架构师", action: "系统设计" },
      { role: "开发者", action: "代码实现" },
      { role: "审查员", action: "质量审计" }
    ],
    cadenceLabel: '全局节拍',
    controlLawLabel: '活动控制律',
    pipelineIOLabel: '流水线 I/O',
    jsonTitle: '万物皆 JSON：声明式工作流编排',
    jsonSubtitle: '只需编写一份 workflow.json，即可定义整个团队的角色、工具链和多段式执行逻辑。',
    jsonBenefits: [
      '编排 21 个内置专业智能体',
      '调用 32 项覆盖全生命周期的核心技能',
      '基于 Tick 的精准同步/异步协作机制'
    ],
    quickStartTitle: '快速开始',
    quickStartDesc: '不到一分钟即可启动。',
    quickStartSteps: [
      { title: '安装', desc: '一条 npm 命令全局安装。' },
      { title: '初始化', desc: '在项目根目录生成配置脚手架。' },
      { title: '运行', desc: '启动你的第一个多智能体工作流。' }
    ],
    quickStartTabs: [
      {
        label: 'npm',
        lines: [
          { type: 'comment', text: '# 全局安装 CCW' },
          { type: 'cmd', text: 'npm install -g claude-code-workflow' },
          { type: 'output', text: 'added 1 package in 3s' },
          { type: 'comment', text: '# 在项目中初始化' },
          { type: 'cmd', text: 'ccw init' },
          { type: 'output', text: '✔ 已创建 .claude/CLAUDE.md' },
          { type: 'output', text: '✔ 已创建 .ccw/workflows/' },
          { type: 'comment', text: '# 启动工作流' },
          { type: 'cmd', text: 'ccw workflow start --epic "feature-auth"' },
          { type: 'output', text: '⚡ 已启动 3 个代理的工作流' }
        ]
      },
      {
        label: 'pnpm',
        lines: [
          { type: 'comment', text: '# 全局安装 CCW' },
          { type: 'cmd', text: 'pnpm add -g claude-code-workflow' },
          { type: 'output', text: 'Done in 2.1s' },
          { type: 'comment', text: '# 在项目中初始化' },
          { type: 'cmd', text: 'ccw init' },
          { type: 'output', text: '✔ 已创建 .claude/CLAUDE.md' },
          { type: 'output', text: '✔ 已创建 .ccw/workflows/' },
          { type: 'comment', text: '# 启动工作流' },
          { type: 'cmd', text: 'ccw workflow start --epic "feature-auth"' },
          { type: 'output', text: '⚡ 已启动 3 个代理的工作流' }
        ]
      }
    ],
    viewFullGuide: '完整安装指南',
    ctaTitle: '准备好用智能体构建了吗？',
    ctaDesc: '今天就开始在你的代码库中编排多智能体工作流。',
    exploreCli: '浏览 CLI 参考'
  }
}

const t = computed(() => content[props.lang] || content.en)

// Pipeline stage SVG icons (shared across locales)
const pipelineIcons = [
  '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>',
  '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
]

// --- Terminal Animation ---
const terminalStep = ref(0)
const terminalLines = [
  { text: "$ ccw run ./cadence-config.json", color: "emerald" },
  { text: "[System] Initializing multi-agent team context...", color: "slate" },
  { text: "➔ [Tick 1] Start Architect Phase (Gemini CLI)", color: "indigo" },
  { text: "   ✔ Arch document generated.", color: "slate" },
  { text: "➔ [Tick 2] Start Parallel Dev Phase (Qwen CLI x 2)", color: "cyan" },
  { text: "   ✔ Frontend components ready (Agent A)", color: "slate" },
  { text: "   ✔ Backend API ready (Agent B)", color: "slate" },
  { text: "➔ [Tick 3] Start Review & Fix (Codex CLI)", color: "purple" },
  { text: "   ✔ Potential overflow fixed automatically.", color: "slate" },
  { text: "✨ Workflow successful! Elapsed: 45s", color: "emerald bold" }
]

// --- Pipeline Animation ---
const currentTick = ref(0)
const sequence = [
  { tick: 0, stage: 0, status: 'running', log: 'Arch(Gemini): Generating architecture context...', law: { rule: 'Integrity Check', condition: 'ContextTree.depth > 0', action: 'PASS' } },
  { tick: 1, stage: 1, status: 'running', log: 'Coders(Qwen): Parallel coding started...', law: { rule: 'AST Validation', condition: 'AST.isValid == true', action: 'PENDING' } },
  { tick: 2, stage: 1, status: 'blocked', log: 'Coders(Qwen): [BLOCKED] API mismatch detected!', law: { rule: 'Consistency Law', condition: 'Frontend == Backend', action: 'BLOCKED -> RETRY' } },
  { tick: 3, stage: 2, status: 'running', log: 'Reviewer(Codex): Audit and test coverage check...', law: { rule: 'Quality Gate', condition: 'Coverage >= 90%', action: 'PASS' } },
  { tick: 4, stage: 3, status: 'done', log: 'System: Assets ready for deployment.', law: { rule: 'Deploy Law', condition: 'Stages == DONE', action: 'WEBHOOK_TRIGGERED' } }
]
const currentStep = computed(() => sequence[currentTick.value])

// JSON with syntax highlighting and tooltips
const jsonTooltips = {
  'project': '项目名称，用于标识工作流实例',
  'cadence': '节拍模式：strict-sync(严格同步) | async(异步) | hybrid(混合)',
  'team': '团队成员配置，每个角色映射到特定 CLI 工具',
  'arch': '架构师角色：负责系统设计和文档生成',
  'coder': '开发者角色：负责代码实现',
  'audit': '审计员角色：负责质量检查和代码审查',
  'cli': 'CLI 工具：gemini | qwen | codex | claude',
  'stages': '执行阶段定义，按顺序执行',
  'id': '阶段唯一标识符',
  'agent': '执行该阶段的团队成员角色'
}

const highlightedWorkflowJson = computed(() => {
  const lines = [
    { text: '{', type: 'bracket' },
    { text: '  "project": "next-gen-api",', key: 'project', type: 'string' },
    { text: '  "cadence": "strict-sync",', key: 'cadence', type: 'string' },
    { text: '  "team": {', key: 'team', type: 'object' },
    { text: '    "arch": { "cli": "gemini" },', key: 'arch', type: 'object' },
    { text: '    "coder": { "cli": "qwen" },', key: 'coder', type: 'object' },
    { text: '    "audit": { "cli": "codex" }', key: 'audit', type: 'object' },
    { text: '  },', type: 'bracket' },
    { text: '  "stages": [', key: 'stages', type: 'array' },
    { text: '    { "id": "design", "agent": "arch" },', type: 'object' },
    { text: '    { "id": "impl", "agent": "coder" }', type: 'object' },
    { text: '  ]', type: 'bracket' },
    { text: '}', type: 'bracket' }
  ]

  return lines.map(line => {
    if (line.key && jsonTooltips[line.key]) {
      const tooltip = jsonTooltips[line.key]
      const highlighted = line.text
        .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
        .replace(/: "([^"]+)"/g, ': <span class="json-string">"$1"</span>')
        .replace(/: \[/g, ': <span class="json-bracket">[</span>')
        .replace(/\]/g, '<span class="json-bracket">]</span>')
        .replace(/: \{/g, ': <span class="json-bracket">{</span>')
        .replace(/\}/g, '<span class="json-bracket">}</span>')
      return `<span class="json-line" title="${tooltip}">${highlighted}</span>`
    }
    const highlighted = line.text
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/: "([^"]+)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/\[/g, '<span class="json-bracket">[</span>')
      .replace(/\]/g, '<span class="json-bracket">]</span>')
      .replace(/\{/g, '<span class="json-bracket">{</span>')
      .replace(/\}/g, '<span class="json-bracket">}</span>')
    return `<span class="json-line">${highlighted}</span>`
  }).join('\n')
})

let terminalInterval, pipelineInterval

onMounted(() => {
  terminalInterval = setInterval(() => {
    terminalStep.value = (terminalStep.value + 1) % (terminalLines.length + 1)
  }, 1200)

  pipelineInterval = setInterval(() => {
    currentTick.value = (currentTick.value + 1) % sequence.length
  }, 3000)

  // Scroll reveal observer
  const sectionMap = new Map([
    [featuresRef.value, featuresVisible],
    [pipelineRef.value, pipelineVisible],
    [jsonRef.value, jsonVisible],
    [quickstartRef.value, quickstartVisible],
    [ctaRef.value, ctaVisible]
  ])

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const visRef = sectionMap.get(entry.target)
        if (visRef) visRef.value = true
      }
    })
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' })

  sectionMap.forEach((_, el) => {
    if (el) observer.observe(el)
  })
})

onUnmounted(() => {
  clearInterval(terminalInterval)
  clearInterval(pipelineInterval)
  if (observer) observer.disconnect()
})
</script>

<style scoped>
.pro-home {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  width: 100%;
}

.section-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  width: 100%;
  box-sizing: border-box;
}

/* ============================================
 * Hero
 * ============================================ */
.hero-section {
  width: 100%;
  padding: 5rem 0 4rem;
  background:
    radial-gradient(ellipse 120% 80% at 65% 30%, var(--vp-c-brand-soft) 0%, transparent 70%),
    radial-gradient(ellipse 60% 50% at 90% 60%, color-mix(in srgb, var(--vp-c-brand-soft) 40%, transparent) 0%, transparent 100%);
  display: flex;
  justify-content: center;
}

.hero-container {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: center;
  padding: 0 2rem;
  width: 100%;
  box-sizing: border-box;
}

.hero-visual {
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 20%, transparent);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  margin-right: 0.5rem;
  animation: pulse 2s infinite;
}

.hero-title {
  font-size: 2.75rem;
  line-height: 1.15;
  font-weight: 800;
  margin-bottom: 1.25rem;
  color: var(--vp-c-text-1);
}

.hero-subtitle {
  font-size: 1.1rem;
  color: var(--vp-c-text-2);
  margin-bottom: 2.5rem;
  max-width: 550px;
  line-height: 1.7;
}

.hero-actions { display: flex; gap: 1rem; }

.btn-primary {
  padding: 0.75rem 1.75rem;
  background: var(--vp-c-brand-1);
  color: white !important;
  border-radius: 10px;
  font-weight: 700;
  transition: all 0.2s ease;
  text-decoration: none !important;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}
.btn-icon { flex-shrink: 0; }
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--vp-c-brand-1) 35%, transparent);
}
.btn-lg { padding: 0.875rem 2rem; font-size: 1.05rem; }

.btn-secondary {
  padding: 0.75rem 1.75rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1) !important;
  border-radius: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none !important;
  transition: all 0.2s ease;
  cursor: pointer;
}
.btn-secondary:hover { border-color: var(--vp-c-text-3); }

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  color: var(--vp-c-text-1) !important;
  text-decoration: none !important;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  cursor: pointer;
}
.btn-outline:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1) !important; }

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 1.5rem;
  color: var(--vp-c-text-2) !important;
  text-decoration: none !important;
  font-weight: 600;
  transition: all 0.2s ease;
  cursor: pointer;
}
.btn-ghost:hover { color: var(--vp-c-brand-1) !important; }

/* ============================================
 * Terminal
 * ============================================ */
.terminal-window {
  background: #0f172a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  box-shadow: 0 20px 40px -10px rgba(0,0,0,0.5);
  overflow: hidden;
}
.terminal-header {
  background: #1e293b;
  padding: 0.6rem 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.dots { display: flex; gap: 5px; }
.dots span { width: 8px; height: 8px; border-radius: 50%; }
.dots span:nth-child(1) { background: #ff5f56; }
.dots span:nth-child(2) { background: #ffbd2e; }
.dots span:nth-child(3) { background: #27c93f; }
.terminal-header .title { font-size: 0.7rem; color: #94a3b8; }
.terminal-body {
  padding: 1.25rem;
  height: 260px;
  font-size: 0.85rem;
  line-height: 1.4;
}
.terminal-body .emerald { color: #10b981; }
.terminal-body .indigo { color: #818cf8; }
.terminal-body .cyan { color: #22d3ee; }
.terminal-body .purple { color: #c084fc; }
.terminal-body .slate { color: #94a3b8; }
.terminal-body .bold { font-weight: bold; }

/* ============================================
 * Features
 * ============================================ */
.features-section {
  width: 100%;
  padding: 5rem 0;
  border-top: 1px solid var(--vp-c-divider);
  display: flex;
  justify-content: center;
}
.section-title {
  text-align: center;
  font-size: 2.25rem;
  margin-bottom: 3rem;
  color: var(--vp-c-text-1);
  font-weight: 700;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
  max-width: 100%;
  box-sizing: border-box;
}
.feature-card {
  padding: 1.75rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  transition: all 0.2s ease;
  cursor: default;
  box-sizing: border-box;
  min-width: 0;
}
.feature-card:hover {
  transform: translateY(-4px);
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 12px 24px -8px color-mix(in srgb, var(--vp-c-brand-1) 15%, transparent);
}
.feature-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--vp-c-brand-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
  color: var(--vp-c-brand-1);
}
.feature-card h3 {
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--vp-c-text-1);
}
.feature-card p {
  color: var(--vp-c-text-2);
  line-height: 1.6;
  font-size: 0.875rem;
}

/* ============================================
 * Pipeline
 * ============================================ */
.pipeline-section {
  width: 100%;
  padding: 5rem 0;
  background: var(--vp-c-bg-alt);
  display: flex;
  justify-content: center;
}
.section-header { text-align: center; margin-bottom: 3rem; }
.section-header h2 { font-size: 2.25rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--vp-c-text-1); }
.section-header p { color: var(--vp-c-text-2); font-size: 1.05rem; }

.pipeline-card {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: var(--vp-shadow-2);
  box-sizing: border-box;
  max-width: 100%;
}
.cadence-header { display: flex; justify-content: space-between; align-items: center; }
.cadence-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.tick-count { font-size: 0.75rem; color: var(--vp-c-text-3); font-family: var(--vp-font-family-mono); }
.cadence-track {
  height: 3px;
  background: var(--vp-c-divider);
  position: relative;
  margin: 1.5rem 0 3rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cadence-progress {
  position: absolute;
  height: 100%;
  background: var(--vp-c-brand-1);
  transition: width 0.7s ease;
}
.tick-node {
  width: 10px; height: 10px;
  background: var(--vp-c-bg);
  border: 2px solid var(--vp-c-divider);
  border-radius: 50%;
  z-index: 2;
}
.tick-node.active { border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-1); }
.tick-node.blocked { background: #ef4444; border-color: #ef4444; }
.pipeline-flow { 
  display: flex; 
  justify-content: space-between; 
  margin-bottom: 3rem; 
  max-width: 100%;
  box-sizing: border-box;
  flex-wrap: wrap;
}
.stage-node { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; opacity: 0.4; transition: all 0.5s; }
.stage-node.active, .stage-node.done { opacity: 1; }
.stage-badge { min-height: 24px; margin-bottom: 0.5rem; }
.badge-text {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.badge-text.blocked { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.badge-text.done { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.stage-icon {
  width: 56px; height: 56px;
  background: var(--vp-c-bg-soft);
  border: 2px solid var(--vp-c-divider);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.active .stage-icon { border-color: var(--vp-c-brand-1); box-shadow: 0 0 15px var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.blocked .stage-icon { border-color: #ef4444; color: #ef4444; animation: shake 0.5s; }
.stage-info h4 { font-size: 1rem; font-weight: 700; margin-top: 1rem; color: var(--vp-c-text-1); }
.stage-info p { font-size: 0.8rem; color: var(--vp-c-text-2); }
.logic-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.panel-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  margin-bottom: 0.75rem;
}
.law-content, .log-content { background: var(--vp-c-bg-soft); padding: 1.25rem; border-radius: 12px; min-height: 80px; font-size: 0.85rem; }
.law-result { margin-top: 0.75rem; font-weight: bold; }
.law-result.blocked { color: #f87171; }
.log-content.blocked { color: #f87171; }

/* ============================================
 * JSON Section
 * ============================================ */
.json-section {
  width: 100%;
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--vp-c-divider);
}
.json-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 3rem;
  align-items: center;
  padding: 5rem 2rem;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}
.json-text h2 { font-size: 2.25rem; font-weight: 700; margin-bottom: 1.25rem; color: var(--vp-c-text-1); line-height: 1.2; }
.json-text p { font-size: 1.05rem; color: var(--vp-c-text-2); margin-bottom: 2rem; line-height: 1.7; }
.json-benefits { list-style: none; padding: 0; margin: 0; }
.json-benefits li {
  margin-bottom: 0.85rem;
  color: var(--vp-c-text-1);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
}
.check-icon { color: var(--vp-c-brand-1); flex-shrink: 0; }
.json-code {
  background: #0f172a;
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid rgba(255,255,255,0.08);
  overflow: hidden;
}
.json-pre {
  margin: 0;
  color: #e2e8f0;
  font-size: 0.875rem;
  line-height: 1.7;
  white-space: pre;
  overflow-x: auto;
}
.json-line {
  display: block;
  cursor: default;
  transition: background 0.2s ease;
  padding: 2px 8px;
  margin: 0 -8px;
  border-radius: 4px;
}
.json-line[title]:hover {
  background: rgba(99, 102, 241, 0.15);
  position: relative;
}
.json-line[title]:hover::after {
  content: attr(title);
  position: absolute;
  left: calc(100% + 16px);
  top: 50%;
  transform: translateY(-50%);
  background: #1e293b;
  color: #e2e8f0;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  white-space: nowrap;
  max-width: 280px;
  white-space: normal;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  z-index: 10;
  pointer-events: none;
}
.json-key { color: #7dd3fc; font-weight: 500; }
.json-string { color: #a5f3fc; }
.json-bracket { color: #94a3b8; }
.json-number { color: #fbbf24; }
.code-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.75rem;
}

/* ============================================
 * Quick Start Section
 * ============================================ */
.quickstart-section {
  width: 100%;
  padding: 5rem 0;
  background: var(--vp-c-bg-alt);
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--vp-c-divider);
}

.quickstart-layout {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: 3rem;
  align-items: start;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.quickstart-title {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 0.75rem;
}

.quickstart-desc {
  font-size: 1.05rem;
  color: var(--vp-c-text-2);
  margin-bottom: 2.5rem;
  line-height: 1.7;
}

.quickstart-steps {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.qs-step {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.qs-step-num {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 10px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.85rem;
}

.qs-step-content h4 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 0.15rem;
}

.qs-step-content p {
  font-size: 0.875rem;
  color: var(--vp-c-text-3);
  line-height: 1.5;
}

/* Quick Start Terminal */
.qs-terminal-window {
  background: #0f172a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 32px -8px rgba(0,0,0,0.4);
}

.qs-terminal-header {
  background: #1e293b;
  padding: 0.5rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.qs-tab-bar {
  display: flex;
  gap: 0;
  margin-left: 0.5rem;
}

.qs-tab {
  padding: 0.3rem 0.75rem;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  font-family: inherit;
  min-height: auto;
  min-width: auto;
}

.qs-tab:hover { color: #94a3b8; }
.qs-tab.active {
  color: #e2e8f0;
  border-bottom-color: var(--vp-c-brand-1);
}

.qs-terminal-body {
  padding: 1.25rem;
  min-height: 280px;
  font-size: 0.8rem;
  line-height: 1.7;
}

.qs-line { margin-bottom: 0.15rem; }
.qs-comment { color: #475569; }
.qs-cmd { color: #e2e8f0; }
.qs-prompt { color: #22c55e; margin-right: 0.5rem; }
.qs-output { color: #94a3b8; }

/* ============================================
 * CTA Footer
 * ============================================ */
.cta-section {
  width: 100%;
  padding: 5rem 0;
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--vp-c-divider);
}

.cta-card {
  text-align: center;
  padding: 3.5rem 2rem;
  max-width: 800px;
  margin: 0 auto;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 24px;
  position: relative;
  overflow: hidden;
}

.cta-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 0%, var(--vp-c-brand-soft) 0%, transparent 60%);
  pointer-events: none;
}

.cta-card h2 {
  font-size: 2rem;
  font-weight: 800;
  color: var(--vp-c-text-1);
  margin-bottom: 0.75rem;
  position: relative;
}

.cta-card p {
  font-size: 1.05rem;
  color: var(--vp-c-text-2);
  margin-bottom: 2rem;
  position: relative;
}

.cta-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

/* ============================================
 * Terminal cursor blink
 * ============================================ */
.cursor-blink {
  color: #10b981;
  font-weight: bold;
  animation: cursorBlink 1s step-end infinite;
}

.term-line {
  animation: termLineReveal 0.3s ease-out both;
  animation-delay: calc(var(--line-idx, 0) * 0.05s);
}

/* ============================================
 * Scroll Reveal Animations
 * ============================================ */
.reveal-text {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal-text.visible {
  opacity: 1;
  transform: translateY(0);
}

.reveal-card {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--card-delay, 0s);
}
.reveal-card.visible {
  opacity: 1;
  transform: translateY(0);
}

.reveal-slide {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal-slide.visible {
  opacity: 1;
  transform: translateY(0);
}

.reveal-scale {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal-scale.visible {
  opacity: 1;
  transform: scale(1) translateY(0);
}

/* ============================================
 * Gradient text shimmer
 * ============================================ */
.gradient-text {
  background: linear-gradient(135deg, var(--vp-c-brand-1), #8B5CF6, var(--vp-c-brand-2));
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShimmer 6s ease infinite;
}

/* ============================================
 * Animations
 * ============================================ */
@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes termLineReveal {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes gradientShimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .reveal-text, .reveal-card, .reveal-slide, .reveal-scale {
    opacity: 1 !important;
    transform: none !important;
  }
}

/* ============================================
 * Responsive (Standardized Breakpoints)
 * Mobile: < 768px | Tablet: 768px-1024px | Desktop: > 1024px
 * WCAG 2.1 AA: Touch targets min 44x44px
 * ============================================ */

/* Tablet (768px - 1024px) */
@media (max-width: var(--bp-md)) {
  .features-grid { 
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  .hero-container { 
    gap: 1.5rem;
    padding: 0 1.5rem;
  }
  .hero-title { font-size: 2.25rem; }
  .section-container { 
    padding: 0 1.5rem;
    max-width: 100%;
  }
  .pipeline-flow {
    gap: 1rem;
  }
}

/* Mobile (< 768px) */
@media (max-width: var(--bp-sm)) {
  /* Hero Section - add extra padding-top to clear fixed nav (56px) */
  .hero-section {
    padding: 4.5rem 0 2rem;
    background:
      radial-gradient(ellipse 150% 100% at 50% 20%, var(--vp-c-brand-soft) 0%, transparent 60%),
      var(--vp-c-bg);
  }
  .hero-container {
    grid-template-columns: 1fr;
    text-align: center;
    padding: 0 12px;
    gap: 2rem;
    max-width: 100%;
    box-sizing: border-box;
  }
  .hero-content { order: 1; }
  .hero-visual { order: 2; }
  .hero-title {
    font-size: 1.875rem;
    line-height: 1.2;
    margin-bottom: 1rem;
  }
  .hero-subtitle {
    font-size: 1rem;
    margin-left: auto;
    margin-right: auto;
    margin-bottom: 1.75rem;
    max-width: 100%;
  }
  .hero-actions {
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .btn-primary,
  .btn-secondary {
    min-height: 44px;
    min-width: 44px;
    padding: 0.75rem 1.25rem;
    font-size: 0.9rem;
  }
  .hero-visual { min-height: 200px; }

  /* Section Container */
  .section-container {
    padding: 0 12px;
    max-width: 100%;
    box-sizing: border-box;
  }

  /* Features Grid */
  .features-section { padding: 3rem 0; }
  .section-title {
    font-size: 1.5rem;
    margin-bottom: 2rem;
  }
  .features-grid {
    grid-template-columns: 1fr;
    max-width: 100%;
    margin: 0 auto;
    gap: 1rem;
  }
  .feature-card {
    text-align: center;
    padding: 1.5rem;
    min-height: auto;
  }
  .feature-icon-box {
    width: 48px;
    height: 48px;
    margin: 0 auto 1rem;
  }
  .feature-card h3 { font-size: 1.05rem; }
  .feature-card p { font-size: 0.9rem; }

  /* Pipeline Section */
  .pipeline-section { padding: 3rem 0; }
  .section-header h2 { font-size: 1.5rem; }
  .section-header p { font-size: 0.9rem; }
  .pipeline-card {
    padding: 1.25rem;
    max-width: 100%;
    box-sizing: border-box;
  }
  .pipeline-flow {
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .stage-node { flex-direction: row; justify-content: flex-start; gap: 1rem; }
  .stage-icon { width: 44px; height: 44px; min-width: 44px; }
  .stage-info { text-align: left; }
  .stage-info h4 { margin-top: 0; font-size: 0.9rem; }
  .stage-info p { font-size: 0.8rem; }
  .logic-panel { grid-template-columns: 1fr; gap: 1rem; }
  .law-content, .log-content { padding: 1rem; font-size: 0.8rem; min-height: 60px; }

  /* JSON Section */
  .json-section { padding: 0; }
  .json-grid {
    grid-template-columns: 1fr;
    text-align: center;
    padding: 3rem 12px;
    gap: 2rem;
    max-width: 100%;
    box-sizing: border-box;
  }
  .json-text h2 { font-size: 1.5rem; }
  .json-text p { font-size: 0.95rem; }
  .json-benefits { text-align: left; }
  .json-benefits li { font-size: 0.9rem; }
  .json-code {
    padding: 1rem;
    max-width: 100%;
    box-sizing: border-box;
    overflow-x: auto;
  }
  .json-pre { font-size: 0.75rem; }

  /* Quick Start */
  .quickstart-section { padding: 3rem 0; }
  .quickstart-layout {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 2rem;
  }
  .quickstart-info { order: 2; }
  .quickstart-terminal { order: 1; }
  .qs-step {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.75rem;
  }
  .qs-step-num { width: 44px; height: 44px; min-width: 44px; }
  .qs-terminal-body { min-height: 200px; padding: 1rem; }
  .qs-terminal-header { padding: 0.4rem 0.6rem; }
  .qs-tab { min-height: 36px; padding: 0.25rem 0.5rem; }

  /* CTA Section */
  .cta-section { padding: 3rem 0; }
  .cta-card {
    padding: 2rem 1rem;
    margin: 0 12px;
    max-width: calc(100% - 24px);
    box-sizing: border-box;
  }
  .cta-card h2 { font-size: 1.5rem; }
  .cta-card p { font-size: 0.95rem; margin-bottom: 1.5rem; }
  .cta-actions {
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }
  .cta-actions .btn-primary,
  .cta-actions .btn-outline,
  .cta-actions .btn-secondary {
    width: 100%;
    justify-content: center;
    min-height: 48px;
  }
}

/* Small Mobile (< 480px) */
@media (max-width: var(--bp-xs)) {
  .hero-title { font-size: 1.5rem; }
  .hero-actions { flex-direction: column; width: 100%; }
  .hero-actions .btn-primary,
  .hero-actions .btn-secondary {
    width: 100%;
    justify-content: center;
  }
  .section-title { font-size: 1.25rem; }
  .pipeline-flow { gap: 0.75rem; }
  .stage-icon { width: 40px; height: 40px; border-radius: 10px; }
  .json-text h2 { font-size: 1.25rem; }
  .cta-card { padding: 1.5rem 1rem; }
  .cta-card h2 { font-size: 1.25rem; }
}
</style>
