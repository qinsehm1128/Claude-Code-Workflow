<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  code: string
  lang?: string
  showCopy?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  lang: 'tsx',
  showCopy: true
})

const copyStatus = ref<'idle' | 'copying' | 'copied'>('idle')
const copyTimeout = ref<number>()

const lineCount = computed(() => props.code.split('\n').length)
const copyButtonText = computed(() => {
  switch (copyStatus.value) {
    case 'copying': return '复制中...'
    case 'copied': return '已复制'
    default: return '复制'
  }
})

const copyCode = async () => {
  if (copyStatus.value === 'copying') return

  copyStatus.value = 'copying'
  try {
    await navigator.clipboard.writeText(props.code)
    copyStatus.value = 'copied'

    if (copyTimeout.value) {
      clearTimeout(copyTimeout.value)
    }
    copyTimeout.value = window.setTimeout(() => {
      copyStatus.value = 'idle'
    }, 2000)
  } catch {
    copyStatus.value = 'idle'
  }
}
</script>

<template>
  <div class="code-viewer">
    <div class="code-header">
      <span class="code-lang">{{ lang }}</span>
      <button
        v-if="showCopy"
        class="copy-button"
        :class="copyStatus"
        :disabled="copyStatus === 'copying'"
        @click="copyCode"
      >
        <span class="copy-icon">📋</span>
        <span class="copy-text">{{ copyButtonText }}</span>
      </button>
    </div>
    <pre class="code-content" :class="`language-${lang}`"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.code-viewer {
  background: var(--vp-code-bg);
  border-radius: 6px;
  overflow: hidden;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--vp-code-block-bg);
  border-bottom: 1px solid var(--vp-c-border);
}

.code-lang {
  font-size: 12px;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  font-weight: 500;
}

.copy-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.copy-button:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand);
}

.copy-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.copy-button.copied {
  background: var(--vp-c-brand);
  color: white;
  border-color: var(--vp-c-brand);
}

.copy-icon {
  font-size: 14px;
}

.copy-text {
  font-size: 12px;
}

.code-content {
  padding: 16px;
  margin: 0;
  overflow-x: auto;
}

.code-content code {
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-code-color);
  white-space: pre;
}

/* Responsive */
@media (max-width: 768px) {
  .code-content {
    padding: 12px;
    font-size: 13px;
  }
}
</style>
