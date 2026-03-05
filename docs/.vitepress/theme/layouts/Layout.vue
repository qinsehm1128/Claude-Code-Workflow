<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { onBeforeUnmount, onMounted } from 'vue'
import { useDynamicIcon } from '../composables/useDynamicIcon'
import ThemeLogo from '../components/ThemeLogo.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'

let mediaQuery: MediaQueryList | null = null
let systemThemeChangeHandler: (() => void) | null = null
let storageHandler: ((e: StorageEvent) => void) | null = null

function applyTheme() {
  const savedTheme = localStorage.getItem('ccw-theme') || 'blue'
  document.documentElement.setAttribute('data-theme', savedTheme)
}

function applyColorMode() {
  const mode = localStorage.getItem('ccw-color-mode') || 'auto'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'auto' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

// Initialize dynamic favicon system
useDynamicIcon()

onMounted(() => {
  applyTheme()
  applyColorMode()

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemThemeChangeHandler = () => {
    const mode = localStorage.getItem('ccw-color-mode') || 'auto'
    if (mode === 'auto') applyColorMode()
  }
  mediaQuery.addEventListener('change', systemThemeChangeHandler)

  storageHandler = (e: StorageEvent) => {
    if (e.key === 'ccw-theme') applyTheme()
    if (e.key === 'ccw-color-mode') applyColorMode()
  }
  window.addEventListener('storage', storageHandler)
})

onBeforeUnmount(() => {
  if (mediaQuery && systemThemeChangeHandler) {
    mediaQuery.removeEventListener('change', systemThemeChangeHandler)
  }
  if (storageHandler) window.removeEventListener('storage', storageHandler)
})
</script>

<template>
  <DefaultTheme.Layout>
    <!-- Custom logo in navbar that follows theme color -->
    <template #nav-bar-title-before>
      <ThemeLogo class="nav-logo" />
    </template>

    <template #home-hero-after>
      <div class="hero-extensions">
        <div class="hero-stats">
          <div class="stat-item">
            <div class="stat-value">27+</div>
            <div class="stat-label">Built-in Skills</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">10+</div>
            <div class="stat-label">Agent Types</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">4</div>
            <div class="stat-label">Workflow Levels</div>
          </div>
        </div>
      </div>
    </template>

    <template #layout-top>
      <a href="#VPContent" class="skip-link">Skip to main content</a>
    </template>

    <template #nav-bar-content-after>
      <div class="nav-extensions">
        <DocSearch class="nav-item-always" />
        <DarkModeToggle class="nav-item-desktop" />
        <ThemeSwitcher class="nav-item-desktop" />
        <LanguageSwitcher class="nav-item-desktop" />
      </div>
    </template>
  </DefaultTheme.Layout>
</template>

<style scoped>
/* ============================================
 * Container Query Context Definitions
 * Enables component-level responsive design
 * ============================================ */

/* Set container context on layout root */
:deep(.Layout) {
  container-type: inline-size;
  container-name: layout;
}

/* Sidebar container context */
:deep(.VPSidebar) {
  container-type: inline-size;
  container-name: sidebar;
}

/* Main content container context */
:deep(.VPContent) {
  container-type: inline-size;
  container-name: content;
}

/* Document outline container context */
:deep(.VPDocOutline) {
  container-type: inline-size;
  container-name: outline;
}

/* Navigation container context */
:deep(.VPNav) {
  container-type: inline-size;
  container-name: nav;
}

/* Hero section with fluid spacing */
.hero-extensions {
  margin-top: var(--spacing-fluid-lg);
  text-align: center;
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: var(--spacing-fluid-xl);
  flex-wrap: wrap;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: clamp(1.5rem, 1.25rem + 1.25vw, 2rem);
  font-weight: 700;
  color: var(--vp-c-primary);
}

.stat-label {
  font-size: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
  color: var(--vp-c-text-2);
  margin-top: var(--spacing-fluid-xs);
}

.nav-extensions {
  display: flex;
  align-items: center;
  gap: var(--spacing-fluid-sm);
  margin-left: auto;
  padding-left: var(--spacing-fluid-sm);
}

.nav-logo {
  width: 24px;
  height: 24px;
  margin-right: 8px;
  flex-shrink: 0;
}

/* Hide the default VitePress logo image since we use our custom component */
:deep(.VPNavBarTitle .logo) {
  display: none;
}

.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 8px 16px;
  background: var(--vp-c-primary);
  color: white;
  text-decoration: none;
  z-index: 9999;
  transition: top 0.3s;
}

.skip-link:focus {
  top: 0;
}

/* Mobile overrides now handled by fluid spacing variables */
/* Container queries in mobile.css provide additional responsiveness */

/* Mobile-specific styles */
@media (max-width: 767px) {
  .hero-extensions {
    margin-top: 1rem;
    padding: 0 12px;
    max-width: 100%;
    box-sizing: border-box;
  }

  .hero-stats {
    gap: 1rem;
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .stat-label {
    font-size: 0.75rem;
  }

  .nav-extensions {
    gap: 0.25rem;
    padding-left: 0.25rem;
    overflow: visible !important;
  }

  /* Hide desktop-only nav items on mobile */
  .nav-item-desktop {
    display: none !important;
  }

  /* Keep always-visible items */
  .nav-item-always {
    display: flex !important;
  }

  /* Ensure nav bar allows dropdown overflow */
  :deep(.VPNavBar) {
    overflow: visible !important;
  }

  :deep(.VPNavBar .content) {
    overflow: visible !important;
  }

  /* Fix dropdown positioning for mobile */
  :deep(.VPNavBarMenuGroup .items) {
    position: fixed !important;
    left: 12px !important;
    right: 12px !important;
    top: 56px !important;
    max-width: none !important;
    width: auto !important;
  }
}
</style>
