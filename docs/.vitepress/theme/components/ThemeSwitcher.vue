<script setup lang="ts">
import { ref, onMounted } from 'vue'

const currentTheme = ref<'blue' | 'green' | 'orange' | 'purple'>('blue')

const themes = [
  { id: 'blue', name: 'Blue', color: '#3b82f6' },
  { id: 'green', name: 'Green', color: '#10b981' },
  { id: 'orange', name: 'Orange', color: '#f59e0b' },
  { id: 'purple', name: 'Purple', color: '#8b5cf6' }
]

const setTheme = (themeId: typeof currentTheme.value) => {
  currentTheme.value = themeId
  document.documentElement.setAttribute('data-theme', themeId)
  localStorage.setItem('ccw-theme', themeId)
}

onMounted(() => {
  const savedTheme = localStorage.getItem('ccw-theme') as typeof currentTheme.value
  if (savedTheme && themes.find(t => t.id === savedTheme)) {
    setTheme(savedTheme)
  }
})
</script>

<template>
  <div class="theme-switcher">
    <div class="theme-buttons">
      <button
        v-for="theme in themes"
        :key="theme.id"
        :class="['theme-button', { active: currentTheme === theme.id }]"
        :style="{ '--theme-color': theme.color }"
        :aria-label="`Switch to ${theme.name} theme`"
        :title="theme.name"
        @click="setTheme(theme.id)"
      >
        <span class="theme-dot"></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.theme-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-buttons {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--vp-c-bg-soft);
  border-radius: var(--vp-radius-full);
}

.theme-button {
  position: relative;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--vp-radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--vp-transition-color);
}

.theme-button:hover {
  background: var(--vp-c-bg-mute);
}

.theme-button.active {
  background: var(--vp-c-bg);
  box-shadow: var(--vp-shadow-sm);
}

.theme-dot {
  width: 16px;
  height: 16px;
  border-radius: var(--vp-radius-full);
  background: var(--theme-color);
  border: 2px solid transparent;
  transition: all var(--vp-transition-color);
}

.theme-button.active .theme-dot {
  border-color: var(--vp-c-text-1);
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .theme-button {
    width: 36px;
    height: 36px;
  }

  .theme-dot {
    width: 20px;
    height: 20px;
  }
}
</style>
