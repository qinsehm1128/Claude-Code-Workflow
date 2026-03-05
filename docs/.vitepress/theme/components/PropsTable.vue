<script setup lang="ts">
interface Prop {
  name: string
  type: string
  required?: boolean
  default?: string
  description: string
}

interface Props {
  props: Prop[]
}

defineProps<Props>()
</script>

<template>
  <div class="props-table-container">
    <table class="props-table">
      <thead>
        <tr>
          <th>Prop</th>
          <th>Type</th>
          <th>Required</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(prop, index) in props" :key="index" class="prop-row">
          <td class="prop-name">
            <code>{{ prop.name }}</code>
          </td>
          <td class="prop-type">
            <code>{{ prop.type }}</code>
          </td>
          <td class="prop-required">
            <span v-if="prop.required" class="badge required">Yes</span>
            <span v-else class="badge optional">No</span>
          </td>
          <td class="prop-default">
            <code v-if="prop.default !== undefined">{{ prop.default }}</code>
            <span v-else class="empty">-</span>
          </td>
          <td class="prop-description">
            {{ prop.description }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.props-table-container {
  margin: 16px 0;
  overflow-x: auto;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
}

.props-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.props-table thead {
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
}

.props-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.props-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.props-table tr:last-child td {
  border-bottom: none;
}

.props-table tr:hover {
  background: var(--vp-c-bg-soft);
}

.prop-name code,
.prop-type code,
.prop-default code {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  padding: 2px 6px;
  background: var(--vp-code-bg);
  border-radius: 4px;
  color: var(--vp-code-color);
}

.prop-name {
  font-weight: 500;
  color: var(--vp-c-brand);
  white-space: nowrap;
}

.prop-type {
  white-space: nowrap;
}

.prop-required {
  white-space: nowrap;
  width: 80px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.badge.required {
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
}

.badge.optional {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
}

.prop-default {
  white-space: nowrap;
}

.prop-default .empty {
  color: var(--vp-c-text-3);
}

.prop-description {
  color: var(--vp-c-text-2);
  max-width: 400px;
}

/* Responsive */
@media (max-width: 768px) {
  .props-table {
    font-size: 13px;
  }

  .props-table th,
  .props-table td {
    padding: 8px 12px;
  }

  .prop-description {
    max-width: 200px;
  }
}
</style>
