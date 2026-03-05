<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  code: string
}>()

const emit = defineEmits<{
  (e: 'copy'): void
}>()

const copied = ref(false)

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    emit('copy')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Also handle Ctrl+C
const handleKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key === 'c') {
    copyToClipboard()
  }
}
</script>

<template>
  <button
    class="copy-code-button"
    :class="{ copied }"
    :aria-label="copied ? 'Copied!' : 'Copy code'"
    :title="copied ? 'Copied!' : 'Copy code (Ctrl+C)'"
    @click="copyToClipboard"
    @keydown="handleKeydown"
  >
    <svg v-if="!copied" class="icon copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
    <svg v-else class="icon check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span v-if="copied" class="copy-feedback">Copied!</span>
  </button>
</template>

<style scoped>
.copy-code-button {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: var(--vp-radius-md);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: var(--vp-font-size-sm);
  cursor: pointer;
  opacity: 0;
  transition: all var(--vp-transition-color);
  z-index: 10;
}

.copy-code-button:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-primary);
}

.copy-code-button.copied {
  background: var(--vp-c-secondary-500);
  color: white;
  border-color: var(--vp-c-secondary-500);
}

.copy-code-button .icon {
  width: 16px;
  height: 16px;
}

.copy-feedback {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  padding: 4px 8px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: var(--vp-radius-md);
  font-size: 12px;
  white-space: nowrap;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Show button on code block hover */
div[class*='language-']:hover .copy-code-button,
.copy-code-button:focus {
  opacity: 1;
}

@media (max-width: 768px) {
  .copy-code-button {
    opacity: 1;
    top: 8px;
    right: 8px;
    padding: 8px;
  }

  .copy-feedback {
    display: none;
  }
}
</style>
