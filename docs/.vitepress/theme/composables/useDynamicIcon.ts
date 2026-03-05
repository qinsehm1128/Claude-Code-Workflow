import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

/**
 * Theme color mappings for light and dark modes
 */
export const THEME_COLORS = {
  blue: {
    light: '#3B82F6',
    dark: '#60A5FA'
  },
  green: {
    light: '#22C55E',
    dark: '#34D399'
  },
  orange: {
    light: '#F59E0B',
    dark: '#FBBF24'
  },
  purple: {
    light: '#8B5CF6',
    dark: '#A78BFA'
  }
} as const

export type ThemeName = keyof typeof THEME_COLORS

/**
 * Status dot colors (always green)
 */
export const STATUS_COLORS = {
  light: '#22C55E',
  dark: '#34D399'
} as const

const STORAGE_KEY_THEME = 'ccw-theme'
const STORAGE_KEY_COLOR_MODE = 'ccw-color-mode'

/**
 * Check if running in browser environment
 */
const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined'

/**
 * Get current theme from localStorage or default
 */
export function getCurrentTheme(): ThemeName {
  if (!isBrowser) return 'blue'
  const saved = localStorage.getItem(STORAGE_KEY_THEME)
  if (saved && saved in THEME_COLORS) {
    return saved as ThemeName
  }
  return 'blue'
}

/**
 * Check if dark mode is active
 */
export function isDarkMode(): boolean {
  if (!isBrowser) return false
  const mode = localStorage.getItem(STORAGE_KEY_COLOR_MODE) || 'auto'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return mode === 'dark' || (mode === 'auto' && prefersDark)
}

/**
 * Get the appropriate theme color based on current mode
 */
export function getThemeColor(theme: ThemeName, isDark: boolean): string {
  return isDark ? THEME_COLORS[theme].dark : THEME_COLORS[theme].light
}

/**
 * Get the appropriate status color based on current mode
 */
export function getStatusColor(isDark: boolean): string {
  return isDark ? STATUS_COLORS.dark : STATUS_COLORS.light
}

/**
 * Generate favicon SVG with orbital design
 */
export function generateFaviconSvg(theme: ThemeName, isDark: boolean): string {
  const orbitColor = getThemeColor(theme, isDark)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 26 26" fill="none" stroke="${orbitColor}" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 12 A8 3 0 0 1 20 12" stroke-width="0.9" opacity="0.15"/>
  <path d="M16.9 19.5 A8 3 30 0 1 7.1 4.5" stroke-width="0.9" opacity="0.15"/>
  <path d="M7.1 19.5 A8 3 -30 0 1 16.9 4.5" stroke-width="0.9" opacity="0.15"/>
  <circle cx="12" cy="12" r="1.5" fill="${orbitColor}" stroke="none" opacity="0.2"/>
  <path d="M20 12 A8 3 0 0 1 4 12" stroke-width="1.3" opacity="0.75"/>
  <path d="M7.1 4.5 A8 3 30 0 1 16.9 19.5" stroke-width="1.3" opacity="0.75"/>
  <path d="M16.9 4.5 A8 3 -30 0 1 7.1 19.5" stroke-width="1.3" opacity="0.75"/>
  <circle cx="17" cy="10.5" r="1.8" fill="#D97757" stroke="none"/>
  <circle cx="8" cy="16" r="1.8" fill="#10A37F" stroke="none"/>
  <circle cx="14" cy="5.5" r="1.8" fill="#4285F4" stroke="none"/>
</svg>`
}

/**
 * Update the favicon with current theme colors
 */
export function updateFavicon(theme: ThemeName, isDark: boolean): void {
  const svg = generateFaviconSvg(theme, isDark)
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`

  // Update existing favicon or create new one
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/svg+xml'
    document.head.appendChild(link)
  }
  link.href = dataUrl

  // Also update apple-touch-icon if exists
  const appleLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (appleLink) {
    appleLink.href = dataUrl
  }
}

/**
 * Composable for dynamic icon management
 */
export function useDynamicIcon() {
  const currentTheme = ref<ThemeName>(getCurrentTheme())
  const darkMode = ref(isDarkMode())

  let mediaQuery: MediaQueryList | null = null
  let mutationObserver: MutationObserver | null = null
  let storageHandler: ((e: StorageEvent) => void) | null = null

  /**
   * Update favicon based on current state
   */
  const updateIcon = () => {
    updateFavicon(currentTheme.value, darkMode.value)
  }

  /**
   * Check and update dark mode state
   */
  const checkDarkMode = () => {
    darkMode.value = isDarkMode()
    updateIcon()
  }

  /**
   * Check and update theme state
   */
  const checkTheme = () => {
    currentTheme.value = getCurrentTheme()
    updateIcon()
  }

  onMounted(() => {
    // Initial update
    updateIcon()

    // Listen for system color scheme changes
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', checkDarkMode)

    // Listen for storage changes (cross-tab sync)
    storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_THEME) checkTheme()
      if (e.key === STORAGE_KEY_COLOR_MODE) checkDarkMode()
    }
    window.addEventListener('storage', storageHandler)

    // Observe DOM changes for dark class and data-theme attribute
    mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement
          if (mutation.attributeName === 'class') {
            const isDark = target.classList.contains('dark')
            if (isDark !== darkMode.value) {
              darkMode.value = isDark
              updateIcon()
            }
          }
          if (mutation.attributeName === 'data-theme') {
            const theme = target.getAttribute('data-theme') as ThemeName
            if (theme && theme !== currentTheme.value && theme in THEME_COLORS) {
              currentTheme.value = theme
              updateIcon()
            }
          }
        }
      }
    })

    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    })
  })

  onBeforeUnmount(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', checkDarkMode)
    }
    if (storageHandler) {
      window.removeEventListener('storage', storageHandler)
    }
    if (mutationObserver) {
      mutationObserver.disconnect()
    }
  })

  return {
    currentTheme,
    darkMode,
    updateIcon,
    themeColors: THEME_COLORS
  }
}

export type UseDynamicIconReturn = ReturnType<typeof useDynamicIcon>
