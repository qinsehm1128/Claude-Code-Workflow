// ========================================
// i18n Configuration
// ========================================
// Internationalization setup with react-intl

import { createIntl, createIntlCache } from '@formatjs/intl';

// Supported locales
export type Locale = 'en' | 'zh';

// Available locales with display names
export const availableLocales: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

// Browser language detection
function getBrowserLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) return 'zh';
  if (browserLang.startsWith('en')) return 'en';

  // Default to Chinese for unsupported languages
  return 'zh';
}

// Get initial locale from localStorage or browser detection
export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';

  try {
    const stored = localStorage.getItem('ccw-app-store');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.state?.locale && (parsed.state.locale === 'en' || parsed.state.locale === 'zh')) {
        return parsed.state.locale as Locale;
      }
    }
  } catch {
    // Ignore storage errors
  }

  return getBrowserLocale();
}

/**
 * Load translation messages for a locale
 * Dynamically imports the consolidated translation file
 * NOTE: This dynamic import relies on Vite's glob import feature
 * to bundle the locale index.ts files.
 */
async function loadMessages(locale: Locale): Promise<Record<string, string>> {
  try {
    // Dynamic import with .ts extension for Vite compatibility
    const messagesModule = await import(`../locales/${locale}/index.ts`);
    return messagesModule.default || {};
  } catch (error) {
    console.error(`Failed to load messages for locale "${locale}":`, error);
    return {};
  }
}

// Translation messages (will be populated by loading message files)
const messages: Record<Locale, Record<string, string>> = {
  en: {},
  zh: {},
};

/**
 * Load messages for a specific locale only (lazy loading)
 * This is the optimized init method that loads only the active locale
 */
export async function loadMessagesForLocale(locale: Locale): Promise<Record<string, string>> {
  const localeMessages = await loadMessages(locale);
  messages[locale] = localeMessages;
  updateIntl(locale);
  return localeMessages;
}

/**
 * Initialize translation messages for all locales
 * Call this during app initialization
 * NOTE: Use loadMessagesForLocale() for faster single-locale init
 */
export async function initMessages(): Promise<void> {
  // Load messages for both locales in parallel
  const [enMessages, zhMessages] = await Promise.all([
    loadMessages('en'),
    loadMessages('zh'),
  ]);

  messages.en = enMessages;
  messages.zh = zhMessages;

  // Update current intl instance with loaded messages
  const currentLocale = getInitialLocale();
  updateIntl(currentLocale);
}

// Cache for intl instances to avoid recreating on every render
const intlCache = createIntlCache();

// Current intl instance (will be updated when locale changes)
let currentIntl = createIntl(
  {
    locale: getInitialLocale(),
    messages: messages[getInitialLocale()],
  },
  intlCache
);

/**
 * Get translation messages for a locale
 * This will be used to load messages dynamically
 */
export function getMessages(locale: Locale): Record<string, string> {
  return messages[locale];
}

/**
 * Update the current intl instance with a new locale
 */
export function updateIntl(locale: Locale): void {
  currentIntl = createIntl(
    {
      locale,
      messages: messages[locale],
    },
    intlCache
  );

  // Update document lang attribute
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

/**
 * Get the current intl instance
 */
export function getIntl() {
  return currentIntl;
}

/**
 * Register messages for a locale
 * This can be used to dynamically load translation files
 */
export function registerMessages(locale: Locale, newMessages: Record<string, string>): void {
  messages[locale] = { ...messages[locale], ...newMessages };

  // Update current intl if this is the active locale
  if (currentIntl.locale === locale) {
    updateIntl(locale);
  }
}

/**
 * Format a message using the current intl instance
 */
export function formatMessage(
  id: string,
  values?: Record<string, string | number | boolean | Date | null | undefined>
): string {
  return currentIntl.formatMessage({ id }, values);
}
