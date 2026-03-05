<script setup lang="ts">
/**
 * Skip Link Component
 * Accessibility feature allowing keyboard users to skip to main content
 */
</script>

<template>
  <a href="#VPContent" class="skip-link">
    Skip to main content
  </a>
</template>

<style scoped>
.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 8px 16px;
  background: var(--vp-c-primary);
  color: white;
  text-decoration: none;
  z-index: 9999;
  transition: top 0.3s ease;
  font-size: 14px;
  font-weight: 500;
}

.skip-link:focus {
  top: 0;
}

.skip-link:hover {
  background: var(--vp-c-primary-600);
}

@media print {
  .skip-link {
    display: none;
  }
}
</style>
