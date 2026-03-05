<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { createRoot } from 'react-dom/client'
import React from 'react'
import type { Root } from 'react-dom/client'
import CodeViewer from './CodeViewer.vue'

interface Props {
  id: string               // Demo unique ID
  name: string             // Demo component name
  file?: string            // Optional: explicit source file
  hasInlineCode?: boolean  // Whether inline code is provided
  inlineCode?: string      // Base64 encoded inline code (for display)
  virtualModule?: string   // Virtual module path for inline demos
  height?: string          // Demo container height
  expandable?: boolean     // Allow expand/collapse
  showCode?: boolean       // Show code tab
  title?: string           // Custom demo title
}

const props = withDefaults(defineProps<Props>(), {
  hasInlineCode: false,
  inlineCode: '',
  virtualModule: '',
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
    // Handle inline code mode with virtual module
    if (props.hasInlineCode && props.virtualModule) {
      // Decode base64 for source code display
      if (props.inlineCode) {
        sourceCode.value = atob(props.inlineCode)
      }

      // Dynamically import the virtual module
      // @vite-ignore is needed for dynamic imports with variable paths
      const inlineDemoModule = await import(/* @vite-ignore */ props.virtualModule)
      const DemoComponent = inlineDemoModule.default

      if (!DemoComponent) {
        throw new Error(`Inline demo component "${props.name}" not found in virtual module`)
      }

      // Mount React component properly
      if (demoRoot.value) {
        reactRoot.value = createRoot(demoRoot.value)
        reactRoot.value.render(React.createElement(DemoComponent))
      }
    } else if (props.hasInlineCode && props.inlineCode) {
      // Fallback: inline code without virtual module (display only, no execution)
      const decodedCode = atob(props.inlineCode)
      sourceCode.value = decodedCode

      if (demoRoot.value) {
        // Show a message that preview is not available
        const noticeEl = document.createElement('div')
        noticeEl.className = 'inline-demo-notice'
        noticeEl.innerHTML = `
          <p><strong>Preview not available</strong></p>
          <p>Inline demo "${props.name}" requires virtual module support.</p>
          <p>Check the "Code" tab to see the source.</p>
        `
        demoRoot.value.appendChild(noticeEl)
      }
    } else {
      // Dynamically import demo component from file
      const demoModule = await import(`../../demos/${props.name}.tsx`)
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
          const rawModule = await import(`../../demos/${props.name}.tsx?raw`)
          sourceCode.value = rawModule.default || rawModule
        } catch {
          sourceCode.value = '// Source code not available'
        }
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

/* Inline demo notice (fallback mode) */
:deep(.inline-demo-notice) {
  padding: 20px;
  background: var(--vp-c-warning-soft);
  border-radius: 4px;
  text-align: center;
}

:deep(.inline-demo-notice p) {
  margin: 8px 0;
  color: var(--vp-c-text-2);
}

:deep(.inline-demo-notice strong) {
  color: var(--vp-c-warning-1);
}

/* Inline demo preview styles */
:deep(.inline-demo-preview) {
  padding: 16px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
}

:deep(.inline-demo-preview button) {
  margin: 4px;
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  cursor: pointer;
}

:deep(.inline-demo-preview button:hover) {
  background: var(--vp-c-bg-soft);
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
