<template>
  <div class="hero-anim" :class="{ 'is-visible': isVisible }">
    <svg viewBox="0 0 360 340" class="hero-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--vp-c-brand-1)"/>
          <stop offset="100%" stop-color="#8B5CF6"/>
        </linearGradient>
        <linearGradient id="ccwBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--vp-c-brand-1)" stop-opacity="0.6"/>
          <stop offset="50%" stop-color="#8B5CF6" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="var(--vp-c-brand-1)" stop-opacity="0.6"/>
        </linearGradient>
        <filter id="ccwShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="var(--vp-c-brand-1)" flood-opacity="0.12"/>
        </filter>
        <linearGradient id="beltFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--vp-c-text-3)" stop-opacity="0"/>
          <stop offset="8%" stop-color="var(--vp-c-text-3)" stop-opacity="0.12"/>
          <stop offset="92%" stop-color="var(--vp-c-text-3)" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="var(--vp-c-text-3)" stop-opacity="0"/>
        </linearGradient>
        <clipPath id="beltClip">
          <rect x="10" y="211" width="340" height="14"/>
        </clipPath>
      </defs>

      <!-- Background mesh -->
      <g opacity="0.025">
        <line v-for="i in 6" :key="'v'+i" :x1="i*60" y1="0" :x2="i*60" y2="340" stroke="var(--vp-c-brand-1)" stroke-width="0.5"/>
        <line v-for="i in 6" :key="'h'+i" x1="0" :y1="i*57" x2="360" :y2="i*57" stroke="var(--vp-c-brand-1)" stroke-width="0.5"/>
      </g>

      <!-- === CCW Controller === -->
      <g transform="translate(180, 30)">
        <!-- Outer pulse rings -->
        <circle r="38" fill="none" stroke="url(#coreGrad)" stroke-width="0.5" opacity="0.08" class="ccw-ring1"/>
        <circle r="32" fill="none" stroke="url(#coreGrad)" stroke-width="0.4" opacity="0.12" class="ccw-ring2"/>
        <!-- Main badge -->
        <rect x="-56" y="-20" width="112" height="40" rx="12" class="ccw-bg" filter="url(#ccwShadow)"/>
        <rect x="-56" y="-20" width="112" height="40" rx="12" fill="none" stroke="url(#ccwBorder)" stroke-width="1.2"/>
        <!-- Logo icon (orbital design) -->
        <g transform="translate(-48, -13)">
          <rect width="26" height="26" rx="6" fill="var(--vp-c-brand-1)" opacity="0.12"/>
          <rect width="26" height="26" rx="6" fill="none" stroke="var(--vp-c-brand-1)" stroke-width="0.8" opacity="0.25"/>
          <svg x="1" y="1" width="24" height="24" viewBox="-1 -1 26 26" fill="none" stroke="var(--vp-c-brand-1)" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12 A8 3 0 0 1 20 12" stroke-width="0.8" opacity="0.2"/>
            <path d="M16.9 19.5 A8 3 30 0 1 7.1 4.5" stroke-width="0.8" opacity="0.2"/>
            <path d="M7.1 19.5 A8 3 -30 0 1 16.9 4.5" stroke-width="0.8" opacity="0.2"/>
            <circle cx="12" cy="12" r="1.5" fill="var(--vp-c-brand-1)" stroke="none" opacity="0.15"/>
            <path d="M20 12 A8 3 0 0 1 4 12" stroke-width="1.2" opacity="0.5"/>
            <path d="M7.1 4.5 A8 3 30 0 1 16.9 19.5" stroke-width="1.2" opacity="0.5"/>
            <path d="M16.9 4.5 A8 3 -30 0 1 7.1 19.5" stroke-width="1.2" opacity="0.5"/>
            <circle cx="17" cy="10.5" r="1.5" fill="#D97757" stroke="none" opacity="0.8"/>
            <circle cx="8" cy="16" r="1.5" fill="#10A37F" stroke="none" opacity="0.8"/>
            <circle cx="14" cy="5.5" r="1.5" fill="#4285F4" stroke="none" opacity="0.8"/>
          </svg>
        </g>
        <!-- Text — shifted right to avoid logo overlap -->
        <text x="16" y="0" text-anchor="middle" class="ccw-label">CCW</text>
        <text x="16" y="12" text-anchor="middle" class="ccw-sub">Orchestrator</text>
        <!-- Signal indicator -->
        <circle cx="50" cy="-12" r="2.5" fill="#22C55E" opacity="0.5" class="ccw-signal"/>
        <circle cx="50" cy="-12" r="1.2" fill="#22C55E" opacity="0.8"/>
      </g>

      <!-- Control lines (CCW → stations) -->
      <path d="M134,50 L134,68 L60,68 L60,90" class="ctrl-line" style="--d:0.3s"/>
      <path d="M180,50 L180,90" class="ctrl-line" style="--d:0.5s"/>
      <path d="M226,50 L226,68 L300,68 L300,90" class="ctrl-line" style="--d:0.7s"/>
      <!-- Signal pulses on control lines -->
      <circle r="1.5" fill="var(--vp-c-brand-1)" class="line-pulse">
        <animateMotion dur="2s" repeatCount="indefinite" path="M134,50 L134,68 L60,68 L60,90" begin="0.3s"/>
      </circle>
      <circle r="1.5" fill="var(--vp-c-brand-1)" class="line-pulse">
        <animateMotion dur="2s" repeatCount="indefinite" path="M180,50 L180,90" begin="0.5s"/>
      </circle>
      <circle r="1.5" fill="var(--vp-c-brand-1)" class="line-pulse">
        <animateMotion dur="2s" repeatCount="indefinite" path="M226,50 L226,68 L300,68 L300,90" begin="0.7s"/>
      </circle>
      <circle cx="60" cy="90" r="2.5" fill="#D97757" opacity="0.5"/>
      <circle cx="180" cy="90" r="2.5" fill="#10A37F" opacity="0.5"/>
      <circle cx="300" cy="90" r="2.5" fill="#4285F4" opacity="0.5"/>

      <!-- === Station: Claude (Design) === -->
      <!-- Outer <g> for SVG positioning, inner <g> for CSS animation -->
      <g transform="translate(60, 94)">
        <g class="station" style="--sd:0.3s">
          <rect x="-40" y="0" width="80" height="66" rx="12" class="station-box" style="--sc:#D97757"/>
          <circle cy="24" r="14" fill="#D97757" opacity="0.05"/>
          <!-- Official Claude (Anthropic) icon -->
          <svg x="-11" y="8" width="22" height="22" viewBox="0 0 16 16" fill="#D97757">
            <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z"/>
          </svg>
          <text y="46" text-anchor="middle" class="st-name" fill="#D97757">Claude</text>
          <text y="58" text-anchor="middle" class="st-role">Design</text>
          <line x1="0" y1="66" x2="0" y2="104" stroke="#D97757" stroke-width="1.2" opacity="0.2"/>
          <polygon points="-3,104 3,104 0,110" fill="#D97757" opacity="0.25"/>
        </g>
      </g>

      <!-- === Station: OpenAI (Build) === -->
      <g transform="translate(180, 94)">
        <g class="station" style="--sd:0.5s">
          <rect x="-40" y="0" width="80" height="66" rx="12" class="station-box" style="--sc:#10A37F"/>
          <circle cy="24" r="14" fill="#10A37F" opacity="0.05"/>
          <!-- Official OpenAI icon -->
          <svg x="-11" y="8" width="22" height="22" viewBox="0 0 16 16" fill="#10A37F">
            <path d="M14.949 6.547a3.94 3.94 0 0 0-.348-3.273 4.11 4.11 0 0 0-4.4-1.934A4.1 4.1 0 0 0 8.423.2 4.15 4.15 0 0 0 6.305.086a4.1 4.1 0 0 0-1.891.948 4.04 4.04 0 0 0-1.158 1.753 4.1 4.1 0 0 0-1.563.679A4 4 0 0 0 .554 4.72a3.99 3.99 0 0 0 .502 4.731 3.94 3.94 0 0 0 .346 3.274 4.11 4.11 0 0 0 4.402 1.933c.382.425.852.764 1.377.995.526.231 1.095.35 1.67.346 1.78.002 3.358-1.132 3.901-2.804a4.1 4.1 0 0 0 1.563-.68 4 4 0 0 0 1.14-1.253 3.99 3.99 0 0 0-.506-4.716m-6.097 8.406a3.05 3.05 0 0 1-1.945-.694l.096-.054 3.23-1.838a.53.53 0 0 0 .265-.455v-4.49l1.366.778q.02.011.025.035v3.722c-.003 1.653-1.361 2.992-3.037 2.996m-6.53-2.75a2.95 2.95 0 0 1-.36-2.01l.095.057L5.29 12.09a.53.53 0 0 0 .527 0l3.949-2.246v1.555a.05.05 0 0 1-.022.041L6.473 13.3c-1.454.826-3.311.335-4.15-1.098m-.85-6.94A3.02 3.02 0 0 1 3.07 3.949v3.785a.51.51 0 0 0 .262.451l3.93 2.237-1.366.779a.05.05 0 0 1-.048 0L2.585 9.342a2.98 2.98 0 0 1-1.113-4.094zm11.216 2.571L8.747 5.576l1.362-.776a.05.05 0 0 1 .048 0l3.265 1.86a3 3 0 0 1 1.173 1.207 2.96 2.96 0 0 1-.27 3.2 3.05 3.05 0 0 1-1.36.997V8.279a.52.52 0 0 0-.276-.445m1.36-2.015-.097-.057-3.226-1.855a.53.53 0 0 0-.53 0L6.249 6.153V4.598a.04.04 0 0 1 .019-.04L9.533 2.7a3.07 3.07 0 0 1 3.257.139c.474.325.843.778 1.066 1.303.223.526.289 1.103.191 1.664zM5.503 8.575 4.139 7.8a.05.05 0 0 1-.026-.037V4.049c0-.57.166-1.127.476-1.607s.752-.864 1.275-1.105a3.08 3.08 0 0 1 3.234.41l-.096.054-3.23 1.838a.53.53 0 0 0-.265.455zm.742-1.577 1.758-1 1.762 1v2l-1.755 1-1.762-1z"/>
          </svg>
          <text y="46" text-anchor="middle" class="st-name" fill="#10A37F">OpenAI</text>
          <text y="58" text-anchor="middle" class="st-role">Build</text>
          <line x1="0" y1="66" x2="0" y2="104" stroke="#10A37F" stroke-width="1.2" opacity="0.2"/>
          <polygon points="-3,104 3,104 0,110" fill="#10A37F" opacity="0.25"/>
        </g>
      </g>

      <!-- === Station: Gemini (Verify) === -->
      <g transform="translate(300, 94)">
        <g class="station" style="--sd:0.7s">
          <rect x="-40" y="0" width="80" height="66" rx="12" class="station-box" style="--sc:#4285F4"/>
          <circle cy="24" r="14" fill="#4285F4" opacity="0.05"/>
          <!-- Official Google Gemini icon (4-point star) -->
          <svg x="-11" y="8" width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 12a9 9 0 0 0 9-9a9 9 0 0 0 9 9a9 9 0 0 0-9 9a9 9 0 0 0-9-9" stroke="#4285F4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="#4285F4" fill-opacity="0.15"/>
          </svg>
          <text y="46" text-anchor="middle" class="st-name" fill="#4285F4">Gemini</text>
          <text y="58" text-anchor="middle" class="st-role">Verify</text>
          <line x1="0" y1="66" x2="0" y2="104" stroke="#4285F4" stroke-width="1.2" opacity="0.2"/>
          <polygon points="-3,104 3,104 0,110" fill="#4285F4" opacity="0.25"/>
        </g>
      </g>

      <!-- === Conveyor Belt === -->
      <rect x="8" y="212" width="344" height="12" rx="6" fill="url(#beltFade)"/>
      <line x1="18" y1="212" x2="342" y2="212" stroke="var(--vp-c-divider)" stroke-width="0.3" opacity="0.4"/>
      <line x1="18" y1="224" x2="342" y2="224" stroke="var(--vp-c-divider)" stroke-width="0.3" opacity="0.4"/>
      <!-- Rollers -->
      <circle v-for="i in 9" :key="'r'+i" :cx="18 + i * 36" cy="218" r="2.5" class="roller"/>
      <!-- Scrolling belt marks -->
      <g clip-path="url(#beltClip)" class="belt-scroll">
        <line v-for="i in 22" :key="'bm'+i" :x1="i * 18 - 18" y1="213" :x2="i * 18 - 18" y2="223"
              stroke="var(--vp-c-text-3)" stroke-width="0.3" opacity="0.1"/>
      </g>

      <!-- Flow direction arrows -->
      <g opacity="0.12">
        <polygon points="116,215 116,221 121,218" fill="var(--vp-c-text-2)"/>
        <polygon points="236,215 236,221 241,218" fill="var(--vp-c-text-2)"/>
        <polygon points="340,215 340,221 345,218" fill="var(--vp-c-text-2)"/>
      </g>

      <!-- === Flow Items === -->
      <g class="flow-items">
        <g v-for="(item, i) in flowItems" :key="'fi'+i">
          <rect :width="item.w" height="7" rx="2" :fill="item.color" :opacity="item.opacity">
            <animateMotion :dur="item.dur + 's'" repeatCount="indefinite"
                           path="M6,215 L354,215" :begin="item.delay + 's'"/>
          </rect>
        </g>
      </g>

      <!-- Sparks at stations -->
      <g v-for="(sp, i) in sparks" :key="'sp'+i">
        <circle :r="sp.r" :fill="sp.color" class="spark">
          <animateMotion :dur="sp.dur + 's'" repeatCount="indefinite" :path="sp.path" :begin="sp.delay + 's'"/>
        </circle>
      </g>

      <!-- I/O labels -->
      <text x="18" y="244" class="io-label">Tasks</text>
      <text x="342" y="244" text-anchor="end" class="io-label">Done</text>
      <!-- Output check -->
      <g transform="translate(350, 218)">
        <circle r="7" fill="#22C55E" opacity="0.06" class="check-pulse"/>
        <polyline points="-3,1 -1,3 3,-1" fill="none" stroke="#22C55E" stroke-width="1.3" stroke-linecap="round" opacity="0.6"/>
      </g>

      <!-- Status row -->
      <g class="status-row">
        <g v-for="(s, i) in statusDots" :key="'sd'+i" :transform="`translate(${s.x}, 274)`">
          <line x1="0" y1="-20" x2="0" y2="-14" :stroke="s.color" stroke-width="0.5" opacity="0.2"/>
          <circle r="3" :fill="s.color" opacity="0.12"/>
          <circle r="1.5" :fill="s.color" opacity="0.5" class="status-blink"/>
          <text y="14" text-anchor="middle" class="status-text">{{ s.label }}</text>
        </g>
      </g>

      <!-- Micro-particles -->
      <circle v-for="(p, i) in particles" :key="'mp'+i"
              :cx="p.x" :cy="p.y" :r="p.r"
              fill="var(--vp-c-brand-1)" :opacity="p.opacity"
              class="micro-dot" :style="{ '--fd': p.dur + 's', '--fdy': p.delay + 's' }"/>
    </svg>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const isVisible = ref(false)

onMounted(() => {
  requestAnimationFrame(() => {
    isVisible.value = true
  })
})

const flowItems = [
  { w: 12, color: 'var(--vp-c-text-3)', opacity: 0.35, dur: 7, delay: 0 },
  { w: 10, color: '#D97757', opacity: 0.55, dur: 7, delay: 1.75 },
  { w: 14, color: '#10A37F', opacity: 0.55, dur: 7, delay: 3.5 },
  { w: 10, color: '#4285F4', opacity: 0.55, dur: 7, delay: 5.25 }
]

const sparks = [
  { r: 1.5, color: '#D97757', dur: 2, delay: 0, path: 'M60,212 Q57,202 55,192' },
  { r: 1, color: '#D97757', dur: 2.5, delay: 0.5, path: 'M62,212 Q65,202 67,192' },
  { r: 1.5, color: '#10A37F', dur: 2, delay: 0.8, path: 'M180,212 Q177,202 175,192' },
  { r: 1, color: '#10A37F', dur: 2.5, delay: 1.3, path: 'M182,212 Q185,202 187,192' },
  { r: 1.5, color: '#4285F4', dur: 2, delay: 1.6, path: 'M300,212 Q297,202 295,192' },
  { r: 1, color: '#4285F4', dur: 2.5, delay: 2.1, path: 'M302,212 Q305,202 307,192' }
]

const statusDots = [
  { x: 60, color: '#D97757', label: 'Planning' },
  { x: 180, color: '#10A37F', label: 'Coding' },
  { x: 300, color: '#4285F4', label: 'Testing' }
]

const particles = Array.from({ length: 10 }, () => ({
  x: 15 + Math.random() * 330,
  y: 10 + Math.random() * 320,
  r: 0.5 + Math.random() * 1,
  opacity: 0.05 + Math.random() * 0.1,
  dur: 3 + Math.random() * 4,
  delay: Math.random() * 3
}))
</script>

<style scoped>
.hero-anim {
  width: 100%;
  opacity: 0;
  transform: scale(0.92) translateY(12px);
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.hero-anim.is-visible {
  opacity: 1;
  transform: scale(1) translateY(0);
}
.hero-svg {
  width: 100%;
  height: auto;
  display: block;
}

/* CCW */
.ccw-bg { fill: var(--vp-c-bg-soft); }
.ccw-ring1 { animation: ccwRing 4s ease-in-out infinite; }
.ccw-ring2 { animation: ccwRing 4s ease-in-out infinite 2s; }
.ccw-label { font-size: 15px; font-weight: 800; fill: var(--vp-c-brand-1); letter-spacing: 0.1em; }
.ccw-sub { font-size: 7px; fill: var(--vp-c-text-3); letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; }
.ccw-signal { animation: signalPulse 2s ease-in-out infinite; }
.line-pulse { opacity: 0.4; }

/* Control lines */
.ctrl-line { fill: none; stroke: var(--vp-c-text-4); stroke-width: 0.8; stroke-dasharray: 3 3; opacity: 0; animation: fadeIn 0.6s ease forwards; animation-delay: var(--d); }

/* Stations - animation only uses opacity, no transform conflict */
.station { opacity: 0; animation: stationAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: var(--sd); }
.station-box { fill: var(--vp-c-bg-soft); stroke: var(--sc); stroke-width: 1.2; transition: all 0.3s ease; }
.station:hover .station-box { stroke-width: 2; }
.st-name { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; }
.st-role { font-size: 7.5px; fill: var(--vp-c-text-3); letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; }

/* Belt */
.roller { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-divider); stroke-width: 0.5; }
.belt-scroll { animation: beltScroll 1.2s linear infinite; }

/* Sparks */
.spark { opacity: 0.5; filter: drop-shadow(0 0 2px currentColor); }

/* I/O */
.io-label { font-size: 8px; fill: var(--vp-c-text-3); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; opacity: 0.5; }
.check-pulse { animation: checkPulse 2.5s ease-in-out infinite; }

/* Status */
.status-blink { animation: blink 2.5s ease-in-out infinite; }
.status-text { font-size: 7.5px; fill: var(--vp-c-text-3); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; opacity: 0.5; }

/* Particles */
.micro-dot { animation: microFloat var(--fd) ease-in-out infinite; animation-delay: var(--fdy); }

/* Keyframes */
@keyframes ccwRing { 0%, 100% { opacity: 0.06; } 50% { opacity: 0.18; } }
@keyframes signalPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
@keyframes fadeIn { to { opacity: 0.25; } }
/* Only animate opacity - SVG positioning handled by parent <g> transform attribute */
@keyframes stationAppear { from { opacity: 0; } to { opacity: 1; } }
@keyframes beltScroll { from { transform: translateX(0); } to { transform: translateX(-18px); } }
@keyframes blink { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.15; } }
@keyframes checkPulse { 0%, 100% { opacity: 0.06; } 50% { opacity: 0.14; } }
@keyframes microFloat { 0%, 100% { transform: translateY(0); opacity: 0.05; } 50% { transform: translateY(-5px); opacity: 0.14; } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  .hero-anim.is-visible { opacity: 1; transform: none; }
  .station { opacity: 1; }
  .ctrl-line { opacity: 0.25; }
}
</style>
