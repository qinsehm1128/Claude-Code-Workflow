<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useData } from 'vitepress'

const { site, lang, page } = useData()

const isOpen = ref(false)
const switcherRef = ref<HTMLElement>()
const buttonRef = ref<HTMLElement>()
const dropdownPosition = ref({ top: 0, left: 0 })

// Get available locales from VitePress config
const locales = computed(() => {
  const localeConfig = site.value.locales || {}
  return Object.entries(localeConfig).map(([code, config]) => ({
    code,
    label: (config as any).label || code,
    link: (config as any).link || `/${code === 'root' ? '' : code}/`
  }))
})

// Current locale
const currentLocale = computed(() => {
  const current = locales.value.find(l => l.code === lang.value)
  return current || locales.value[0]
})

// Get alternate language link for current page
const getAltLink = (localeCode: string) => {
  // Get current path and strip any existing locale prefix
  let currentPath = page.value.relativePath

  // Strip locale prefixes (zh/, zh-CN/) from path
  currentPath = currentPath.replace(/^(zh-CN|zh)\//, '')

  // Remove .md extension for clean URL (VitePress uses .html)
  currentPath = currentPath.replace(/\.md$/, '')

  // Construct target path with locale prefix
  if (localeCode === 'root' || localeCode === '') {
    return `/${currentPath}`
  }
  return `/${localeCode}/${currentPath}`
}

const switchLanguage = (localeCode: string) => {
  const altLink = getAltLink(localeCode)
  isOpen.value = false
  window.location.href = altLink
}

// Calculate dropdown position
const updatePosition = () => {
  if (buttonRef.value) {
    const rect = buttonRef.value.getBoundingClientRect()
    const isMobile = window.innerWidth <= 768

    if (isMobile) {
      dropdownPosition.value = {
        top: rect.bottom + 8,
        left: 12
      }
    } else {
      dropdownPosition.value = {
        top: rect.bottom + 4,
        left: rect.right - 150
      }
    }
  }
}

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    updatePosition()
  }
}

// Close dropdown when clicking outside
const handleClickOutside = (e: MouseEvent) => {
  if (switcherRef.value && !switcherRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

// Handle scroll to close dropdown
const handleScroll = () => {
  if (isOpen.value) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', handleScroll, true)
  window.addEventListener('resize', updatePosition)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <div ref="switcherRef" class="language-switcher">
    <button
      ref="buttonRef"
      class="switcher-button"
      :aria-expanded="isOpen"
      aria-label="Switch language"
      @click.stop="toggleDropdown"
    >
      <span class="current-locale">{{ currentLocale?.label }}</span>
      <span class="dropdown-icon" :class="{ open: isOpen }">▼</span>
    </button>

    <Teleport to="body">
      <Transition name="fade">
        <ul
          v-if="isOpen"
          class="locale-list"
          :style="{
            top: dropdownPosition.top + 'px',
            left: dropdownPosition.left + 'px'
          }"
        >
          <li v-for="locale in locales" :key="locale.code">
            <button
              class="locale-button"
              :class="{ active: locale.code === lang }"
              @click="switchLanguage(locale.code)"
            >
              <span class="locale-label">{{ locale.label }}</span>
              <span v-if="locale.code === lang" class="check-icon">✓</span>
            </button>
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.language-switcher {
  position: relative;
  display: inline-block;
}

.switcher-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.switcher-button:hover {
  background: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand);
}

.current-locale {
  font-weight: 500;
}

.dropdown-icon {
  font-size: 10px;
  transition: transform 0.2s;
}

.dropdown-icon.open {
  transform: rotate(180deg);
}

/* Locale list - rendered at body level via Teleport */
.locale-list {
  position: fixed;
  min-width: 150px;
  max-width: calc(100vw - 24px);
  list-style: none;
  margin: 0;
  padding: 8px 0;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 9999;
}

.locale-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  text-align: left;
}

.locale-button:hover {
  background: var(--vp-c-bg-mute);
}

.locale-button.active {
  background: var(--vp-c-brand);
  color: white;
}

.locale-label {
  font-weight: 500;
}

.check-icon {
  font-size: 16px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Responsive */
@media (max-width: 768px) {
  .locale-list {
    width: calc(100vw - 24px) !important;
    max-width: 300px !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25) !important;
  }

  .switcher-button {
    padding: 8px 12px;
    font-size: 13px;
  }

  .locale-button {
    padding: 12px 16px;
  }
}
</style>
