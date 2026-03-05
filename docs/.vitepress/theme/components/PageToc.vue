<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useData } from 'vitepress'

const { page } = useData()

interface TocItem {
  id: string
  text: string
  level: number
  children?: TocItem[]
}

const toc = computed<TocItem[]>(() => {
  return page.value.headers || []
})

const activeId = ref('')

const onItemClick = (id: string) => {
  activeId.value = id
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

onMounted(() => {
  // Update active heading on scroll
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeId.value = entry.target.id
        }
      })
    },
    { rootMargin: '-80px 0px -80% 0px' }
  )

  page.value.headers.forEach((header) => {
    const element = document.getElementById(header.id)
    if (element) {
      observer.observe(element)
    }
  })

  return () => observer.disconnect()
})
</script>

<template>
  <nav v-if="toc.length > 0" class="page-toc" aria-label="Page navigation">
    <div class="toc-header">On this page</div>
    <ul class="toc-list">
      <li
        v-for="item in toc"
        :key="item.id"
        :class="['toc-item', `toc-level-${item.level}`, { active: item.id === activeId }]"
      >
        <a
          :href="`#${item.id}`"
          class="toc-link"
          @click.prevent="onItemClick(item.id)"
        >
          {{ item.text }}
        </a>
        <ul v-if="item.children && item.children.length > 0" class="toc-list toc-sublist">
          <li
            v-for="child in item.children"
            :key="child.id"
            :class="['toc-item', `toc-level-${child.level}`, { active: child.id === activeId }]"
          >
            <a
              :href="`#${child.id}`"
              class="toc-link"
              @click.prevent="onItemClick(child.id)"
            >
              {{ child.text }}
            </a>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.page-toc {
  position: sticky;
  top: calc(var(--vp-nav-height) + 24px);
  max-height: calc(100vh - var(--vp-nav-height) - 48px);
  overflow-y: auto;
  padding: 16px;
  background: var(--vp-c-bg-soft);
  border-radius: var(--vp-radius-lg);
  border: 1px solid var(--vp-c-divider);
}

.toc-header {
  font-size: var(--vp-font-size-sm);
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vp-c-divider);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc-sublist {
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--vp-c-divider);
}

.toc-item {
  margin: 4px 0;
}

.toc-link {
  display: block;
  padding: 4px 8px;
  color: var(--vp-c-text-2);
  font-size: var(--vp-font-size-sm);
  text-decoration: none;
  border-left: 2px solid transparent;
  transition: all var(--vp-transition-color);
  border-radius: 0 var(--vp-radius-sm) var(--vp-radius-sm) 0;
}

.toc-link:hover {
  color: var(--vp-c-primary);
  background: var(--vp-c-bg-soft);
}

.toc-item.active > .toc-link {
  color: var(--vp-c-primary);
  border-left-color: var(--vp-c-primary);
  background: var(--vp-c-bg-mute);
  font-weight: 500;
}

.toc-level-3 .toc-link {
  font-size: 13px;
  padding-left: 16px;
}

.toc-level-4 .toc-link {
  font-size: 12px;
  padding-left: 20px;
}

/* Hide on mobile */
@media (max-width: 1024px) {
  .page-toc {
    display: none;
  }
}

/* Scrollbar styling for TOC */
.page-toc::-webkit-scrollbar {
  width: 4px;
}

.page-toc::-webkit-scrollbar-track {
  background: transparent;
}

.page-toc::-webkit-scrollbar-thumb {
  background: var(--vp-c-divider);
  border-radius: var(--vp-radius-full);
}

.page-toc::-webkit-scrollbar-thumb:hover {
  background: var(--vp-c-text-3);
}
</style>
