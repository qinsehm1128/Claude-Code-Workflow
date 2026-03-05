<script setup lang="ts">
// This component is integrated into ThemeSwitcher
// Kept as separate component for modularity
const emit = defineEmits<{
  (e: 'select', scheme: string): void
}>()

const schemes = [
  { id: 'blue', name: 'Blue', color: '#3b82f6' },
  { id: 'green', name: 'Green', color: '#10b981' },
  { id: 'orange', name: 'Orange', color: '#f59e0b' },
  { id: 'purple', name: 'Purple', color: '#8b5cf6' }
]

const selectScheme = (schemeId: string) => {
  emit('select', schemeId)
}
</script>

<template>
  <div class="color-scheme-selector">
    <button
      v-for="scheme in schemes"
      :key="scheme.id"
      :class="['scheme-option']"
      :style="{ '--scheme-color': scheme.color }"
      :aria-label="scheme.name"
      @click="selectScheme(scheme.id)"
    >
      <span class="scheme-indicator"></span>
      <span class="scheme-name">{{ scheme.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.color-scheme-selector {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scheme-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: var(--vp-radius-md);
  background: var(--vp-c-bg);
  cursor: pointer;
  transition: all var(--vp-transition-color);
}

.scheme-option:hover {
  border-color: var(--vp-c-primary);
  background: var(--vp-c-bg-soft);
}

.scheme-indicator {
  width: 16px;
  height: 16px;
  border-radius: var(--vp-radius-full);
  background: var(--scheme-color);
  border: 2px solid var(--vp-c-border);
}

.scheme-name {
  font-size: var(--vp-font-size-sm);
  color: var(--vp-c-text-1);
}
</style>
