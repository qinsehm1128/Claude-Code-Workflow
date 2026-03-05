<script setup lang="ts">
import { ref, onMounted } from 'vue'

type ColorMode = 'light' | 'dark' | 'auto'

const colorMode = ref<ColorMode>('auto')

const modes: { id: ColorMode; name: string; icon: string }[] = [
  { id: 'light', name: 'Light', icon: 'sun' },
  { id: 'dark', name: 'Dark', icon: 'moon' },
  { id: 'auto', name: 'Auto', icon: 'computer' }
]

const setMode = (mode: ColorMode) => {
  colorMode.value = mode
  localStorage.setItem('ccw-color-mode', mode)
  applyMode(mode)
}

const applyMode = (mode: ColorMode) => {
  const html = document.documentElement

  if (mode === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    html.classList.toggle('dark', prefersDark)
  } else {
    html.classList.toggle('dark', mode === 'dark')
  }
}

onMounted(() => {
  const savedMode = localStorage.getItem('ccw-color-mode') as ColorMode
  if (savedMode && modes.find(m => m.id === savedMode)) {
    setMode(savedMode)
  } else {
    setMode('auto')
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (colorMode.value === 'auto') {
      applyMode('auto')
    }
  })
})
</script>

<template>
  <div class="dark-mode-toggle">
    <button
      v-for="mode in modes"
      :key="mode.id"
      :class="['mode-button', { active: colorMode === mode.id }]"
      :aria-label="`Switch to ${mode.name} mode`"
      :title="mode.name"
      @click="setMode(mode.id)"
    >
      <svg v-if="mode.icon === 'sun'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
      <svg v-else-if="mode.icon === 'moon'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
      <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.dark-mode-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--vp-c-bg-soft);
  border-radius: var(--vp-radius-full);
}

.mode-button {
  position: relative;
  width: 36px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--vp-radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-text-2);
  transition: all var(--vp-transition-color);
}

.mode-button:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-mute);
}

.mode-button.active {
  background: var(--vp-c-bg);
  color: var(--vp-c-primary);
  box-shadow: var(--vp-shadow-sm);
}

.mode-button .icon {
  width: 18px;
  height: 18px;
}

@media (max-width: 768px) {
  .mode-button {
    width: 40px;
    height: 36px;
  }

  .mode-button .icon {
    width: 20px;
    height: 20px;
  }
}
</style>
