<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="-1 -1 26 26"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="theme-logo"
    aria-label="Claude Code Workflow"
  >
    <!-- Back orbit halves -->
    <path d="M4 12 A8 3 0 0 1 20 12" stroke-width="0.9" opacity="0.15"/>
    <path d="M16.9 19.5 A8 3 30 0 1 7.1 4.5" stroke-width="0.9" opacity="0.15"/>
    <path d="M7.1 19.5 A8 3 -30 0 1 16.9 4.5" stroke-width="0.9" opacity="0.15"/>
    <!-- Core breathing pulse -->
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" opacity="0.1">
      <animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0.06;0.18;0.06"/>
    </circle>
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" opacity="0.25">
      <animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0.15;0.4;0.15"/>
    </circle>
    <!-- Front orbit halves -->
    <path d="M20 12 A8 3 0 0 1 4 12" stroke-width="1.3" opacity="0.75"/>
    <path d="M7.1 4.5 A8 3 30 0 1 16.9 19.5" stroke-width="1.3" opacity="0.75"/>
    <path d="M16.9 4.5 A8 3 -30 0 1 7.1 19.5" stroke-width="1.3" opacity="0.75"/>
    <!-- Claude agent -->
    <g>
      <animateMotion dur="8s" repeatCount="indefinite" path="M20,12 A8,3,0,0,0,4,12 A8,3,0,0,0,20,12"/>
      <animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0.95;0.95;0.3;0.3;0.95" keyTimes="0;0.35;0.5;0.65;1"/>
      <circle r="1.5" fill="#D97757" stroke="none" opacity="0.9"/>
    </g>
    <!-- OpenAI agent -->
    <g>
      <animateMotion dur="10s" repeatCount="indefinite" begin="-3s" path="M7.1,4.5 A8,3,30,0,1,16.9,19.5 A8,3,30,0,1,7.1,4.5"/>
      <animate attributeName="opacity" dur="10s" repeatCount="indefinite" begin="-3s" values="0.95;0.95;0.3;0.3;0.95" keyTimes="0;0.35;0.5;0.65;1"/>
      <circle r="1.5" fill="#10A37F" stroke="none" opacity="0.9"/>
    </g>
    <!-- Gemini agent -->
    <g>
      <animateMotion dur="12s" repeatCount="indefinite" begin="-5s" path="M16.9,4.5 A8,3,-30,0,1,7.1,19.5 A8,3,-30,0,1,16.9,4.5"/>
      <animate attributeName="opacity" dur="12s" repeatCount="indefinite" begin="-5s" values="0.95;0.95;0.3;0.3;0.95" keyTimes="0;0.35;0.5;0.65;1"/>
      <circle r="1.5" fill="#4285F4" stroke="none" opacity="0.9"/>
    </g>
  </svg>
</template>

<style scoped>
.theme-logo {
  width: 24px;
  height: 24px;
  color: var(--vp-c-text-1);
}
</style>
