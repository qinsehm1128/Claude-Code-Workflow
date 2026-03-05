<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useData, useRouter, withBase } from 'vitepress'

type LocaleKey = 'root' | 'zh'

interface SearchDoc {
  id: number
  title: string
  url: string
  excerpt?: string
}

interface SearchIndexPayload {
  version: number
  locale: LocaleKey
  index: Record<string, string>
  docs: SearchDoc[]
}

const { page } = useData()
const router = useRouter()

const localeKey = computed<LocaleKey>(() =>
  page.value.relativePath.startsWith('zh/') ? 'zh' : 'root'
)

const isOpen = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

const query = ref('')
const results = ref<SearchDoc[]>([])
const activeIndex = ref(0)

const inputRef = ref<HTMLInputElement | null>(null)
const buttonRef = ref<HTMLButtonElement | null>(null)

const modifierKey = ref('Ctrl')

const loadedIndex = shallowRef<any | null>(null)
const loadedDocsById = shallowRef<Map<number, SearchDoc> | null>(null)
const cache = new Map<LocaleKey, { index: any; docsById: Map<number, SearchDoc> }>()

const placeholder = computed(() => (localeKey.value === 'zh' ? '搜索文档' : 'Search docs'))
const cancelText = computed(() => (localeKey.value === 'zh' ? '关闭' : 'Close'))
const loadingText = computed(() => (localeKey.value === 'zh' ? '正在加载索引…' : 'Loading index…'))
const hintText = computed(() => (localeKey.value === 'zh' ? '输入关键词开始搜索' : 'Type to start searching'))
const noResultsText = computed(() => (localeKey.value === 'zh' ? '未找到结果' : 'No results'))

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName?.toLowerCase()
  if (!tag) return false
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
}

async function loadLocaleIndex(key: LocaleKey) {
  const cached = cache.get(key)
  if (cached) {
    loadedIndex.value = cached.index
    loadedDocsById.value = cached.docsById
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const res = await fetch(withBase(`/search-index.${key}.json`))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const payload = (await res.json()) as SearchIndexPayload

    if (!payload || payload.locale !== key) throw new Error('Invalid index payload')

    const [{ default: FlexSearch }, { createFlexSearchIndex }] = await Promise.all([
      import('flexsearch'),
      import('../../search/flexsearch.mjs')
    ])

    const index = createFlexSearchIndex(FlexSearch)
    await Promise.all(Object.entries(payload.index).map(([k, v]) => index.import(k, v)))

    const docsById = new Map<number, SearchDoc>()
    for (const doc of payload.docs) docsById.set(doc.id, doc)

    cache.set(key, { index, docsById })
    loadedIndex.value = index
    loadedDocsById.value = docsById
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    loadedIndex.value = null
    loadedDocsById.value = null
  } finally {
    isLoading.value = false
  }
}

async function ensureReady() {
  await loadLocaleIndex(localeKey.value)
}

let searchTimer: number | undefined
async function runSearch() {
  const q = query.value.trim()
  if (!q) {
    results.value = []
    activeIndex.value = 0
    return
  }

  await ensureReady()
  if (!loadedIndex.value || !loadedDocsById.value) {
    results.value = []
    activeIndex.value = 0
    return
  }

  const ids = loadedIndex.value.search(q, 12) as number[]
  const docsById = loadedDocsById.value
  results.value = ids
    .map((id) => docsById.get(id))
    .filter((d): d is SearchDoc => Boolean(d))
  activeIndex.value = 0
}

function navigate(url: string) {
  router.go(withBase(url))
  close()
}

async function open() {
  isOpen.value = true
  document.body.style.overflow = 'hidden'
  await ensureReady()
  await nextTick()
  inputRef.value?.focus()
}

function close() {
  isOpen.value = false
  query.value = ''
  results.value = []
  activeIndex.value = 0
  error.value = null
  document.body.style.overflow = ''
  buttonRef.value?.focus()
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (results.value.length > 0) {
      activeIndex.value = (activeIndex.value + 1) % results.value.length
    }
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (results.value.length > 0) {
      activeIndex.value =
        (activeIndex.value - 1 + results.value.length) % results.value.length
    }
    return
  }

  if (e.key === 'Enter') {
    const hit = results.value[activeIndex.value]
    if (hit) {
      e.preventDefault()
      navigate(hit.url)
    }
  }
}

let onGlobalKeydown: ((e: KeyboardEvent) => void) | null = null

onMounted(() => {
  modifierKey.value = /mac/i.test(navigator.platform) ? '⌘' : 'Ctrl'

  onGlobalKeydown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      if (!isOpen.value) open()
      return
    }

    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      if (!isOpen.value) open()
    }
  }

  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  if (onGlobalKeydown) window.removeEventListener('keydown', onGlobalKeydown)
})

watch(query, () => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    runSearch()
  }, 60)
})

watch(
  () => page.value.relativePath,
  () => {
    if (isOpen.value) close()
  }
)
</script>

<template>
  <div class="DocSearch">
    <button
      ref="buttonRef"
      type="button"
      class="DocSearch-Button"
      :aria-label="placeholder"
      @click="open"
    >
      <svg class="DocSearch-Button-Icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <span class="DocSearch-Button-Placeholder">{{ placeholder }}</span>
      <span class="DocSearch-Button-Keys" aria-hidden="true">
        <kbd class="DocSearch-Button-Key">{{ modifierKey }}</kbd>
        <kbd class="DocSearch-Button-Key">K</kbd>
      </span>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" class="DocSearch-Modal">
        <div class="DocSearch-Overlay" @click="close" />

        <div class="DocSearch-Container" role="dialog" aria-modal="true">
          <div class="DocSearch-SearchBar">
            <svg class="DocSearch-SearchIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              class="DocSearch-Input"
              type="search"
              :placeholder="placeholder"
              :aria-label="placeholder"
              @keydown="onInputKeydown"
            />
            <button type="button" class="DocSearch-Cancel" @click="close">{{ cancelText }}</button>
          </div>

          <div class="DocSearch-Body">
            <div v-if="isLoading" class="DocSearch-Status">{{ loadingText }}</div>
            <div v-else-if="error" class="DocSearch-Status DocSearch-Status--error">{{ error }}</div>
            <div v-else-if="query.trim().length === 0" class="DocSearch-Status">{{ hintText }}</div>
            <div v-else>
              <ul v-if="results.length > 0" class="DocSearch-Results">
                <li
                  v-for="(item, i) in results"
                  :key="item.id"
                  :class="['DocSearch-Result', { active: i === activeIndex }]"
                  @mousemove="activeIndex = i"
                >
                  <a
                    class="DocSearch-Result-Link"
                    :href="withBase(item.url)"
                    @click.prevent="navigate(item.url)"
                  >
                    <div class="DocSearch-Result-Title">{{ item.title }}</div>
                    <div v-if="item.excerpt" class="DocSearch-Result-Excerpt">
                      {{ item.excerpt }}
                    </div>
                  </a>
                </li>
              </ul>
              <div v-else class="DocSearch-Status">{{ noResultsText }}</div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.DocSearch {
  display: flex;
  align-items: center;
}

.DocSearch-Button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: var(--vp-radius-full);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: all var(--vp-transition-color);
}

.DocSearch-Button:hover {
  border-color: var(--vp-c-primary);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}

.DocSearch-Button-Icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.DocSearch-Button-Placeholder {
  font-size: var(--vp-font-size-sm);
  white-space: nowrap;
}

.DocSearch-Button-Keys {
  display: inline-flex;
  gap: 4px;
  margin-left: 8px;
}

.DocSearch-Button-Key {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 1;
  padding: 4px 6px;
  border-radius: var(--vp-radius-sm);
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
}

.DocSearch-Modal {
  position: fixed;
  inset: 0;
  z-index: var(--vp-z-index-modal);
}

.DocSearch-Overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.DocSearch-Container {
  position: relative;
  width: min(720px, calc(100vw - 32px));
  margin: 10vh auto 0;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--vp-radius-xl);
  box-shadow: var(--vp-shadow-xl);
  overflow: hidden;
}

.DocSearch-SearchBar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.DocSearch-SearchIcon {
  width: 18px;
  height: 18px;
  color: var(--vp-c-text-3);
  flex: 0 0 auto;
}

.DocSearch-Input {
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: var(--vp-radius-md);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
}

.DocSearch-Input:focus-visible {
  outline: 2px solid var(--vp-c-primary);
  outline-offset: 2px;
}

.DocSearch-Cancel {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: var(--vp-radius-md);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: all var(--vp-transition-color);
}

.DocSearch-Cancel:hover {
  border-color: var(--vp-c-primary);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

.DocSearch-Body {
  max-height: 60vh;
  overflow: auto;
}

.DocSearch-Status {
  padding: 18px 16px;
  color: var(--vp-c-text-2);
  font-size: var(--vp-font-size-sm);
}

.DocSearch-Status--error {
  color: #ef4444;
}

.DocSearch-Results {
  list-style: none;
  margin: 0;
  padding: 8px;
}

.DocSearch-Result {
  border-radius: var(--vp-radius-lg);
  transition: background var(--vp-transition-color);
}

.DocSearch-Result.active,
.DocSearch-Result:hover {
  background: var(--vp-c-bg-soft);
}

.DocSearch-Result-Link {
  display: block;
  padding: 12px 12px;
  text-decoration: none;
}

.DocSearch-Result-Title {
  font-weight: 600;
  color: var(--vp-c-text-1);
  font-size: 14px;
}

.DocSearch-Result-Excerpt {
  margin-top: 4px;
  color: var(--vp-c-text-3);
  font-size: 12px;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .DocSearch-Button-Placeholder,
  .DocSearch-Button-Keys {
    display: none;
  }

  .DocSearch-Button {
    width: 40px;
    justify-content: center;
    padding: 0;
  }

  .DocSearch-Container {
    margin-top: 6vh;
  }
}
</style>
