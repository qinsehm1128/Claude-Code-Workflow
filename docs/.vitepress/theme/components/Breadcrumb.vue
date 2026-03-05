<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { page } = useData()

interface BreadcrumbItem {
  text: string
  link?: string
}

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [
    { text: 'Home', link: '/' }
  ]

  const pathSegments = page.value.relativePath.split('/')
  const fileName = pathSegments.pop()?.replace(/\.md$/, '')

  // Build breadcrumb from path
  let currentPath = ''
  for (const segment of pathSegments) {
    currentPath += `${segment}/`
    items.push({
      text: formatTitle(segment),
      link: `/${currentPath}`
    })
  }

  // Add current page
  if (fileName && fileName !== 'index') {
    items.push({
      text: formatTitle(fileName)
    })
  }

  return items
})

const formatTitle = (str: string): string => {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
</script>

<template>
  <nav v-if="breadcrumbs.length > 1" class="breadcrumb" aria-label="Breadcrumb">
    <ol class="breadcrumb-list">
      <li v-for="(item, index) in breadcrumbs" :key="index" class="breadcrumb-item">
        <router-link v-if="item.link && index < breadcrumbs.length - 1" :to="item.link" class="breadcrumb-link">
          {{ item.text }}
        </router-link>
        <span v-else class="breadcrumb-current">{{ item.text }}</span>
        <span v-if="index < breadcrumbs.length - 1" class="breadcrumb-separator">/</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.breadcrumb {
  padding: 12px 0;
  margin-bottom: 16px;
}

.breadcrumb-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.breadcrumb-link {
  color: var(--vp-c-text-2);
  font-size: var(--vp-font-size-sm);
  text-decoration: none;
  transition: color var(--vp-transition-color);
}

.breadcrumb-link:hover {
  color: var(--vp-c-primary);
  text-decoration: underline;
}

.breadcrumb-current {
  color: var(--vp-c-text-1);
  font-size: var(--vp-font-size-sm);
  font-weight: 500;
}

.breadcrumb-separator {
  color: var(--vp-c-text-3);
  font-size: var(--vp-font-size-sm);
}

@media (max-width: 768px) {
  .breadcrumb {
    padding: 8px 0;
    margin-bottom: 12px;
  }

  .breadcrumb-link,
  .breadcrumb-current,
  .breadcrumb-separator {
    font-size: 12px;
  }

  .breadcrumb-list {
    gap: 2px;
  }
}
</style>
