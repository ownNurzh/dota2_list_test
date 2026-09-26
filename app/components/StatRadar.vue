<script setup lang="ts">
import { statDefinitions } from '~/data/players'

const props = defineProps<{
  stats: Record<'mechanics' | 'farming' | 'teamwork' | 'gameSense' | 'versatility', number>
  nickname: string
}>()

const center = { x: 215, y: 164 }
const radius = 105
const pointAt = (index: number, distance: number) => {
  const angle = (-90 + index * 72) * Math.PI / 180
  return { x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance }
}
const polygonAt = (distance: number) => statDefinitions.map((_, index) => {
  const point = pointAt(index, distance)
  return `${point.x},${point.y}`
}).join(' ')
const points = computed(() => statDefinitions.map((stat, index) => pointAt(index, radius * props.stats[stat.key] / 100)))
const polygon = computed(() => points.value.map(point => `${point.x},${point.y}`).join(' '))
const description = computed(() => `${props.nickname}: ${statDefinitions.map(stat => `${stat.label} — ${props.stats[stat.key]} из 100`).join(', ')}`)
const labelAnchors = ['middle', 'start', 'start', 'end', 'end'] as const
</script>

<template>
  <figure class="stat-radar">
    <svg viewBox="0 0 430 320" role="img" :aria-label="description">
      <polygon v-for="step in 4" :key="step" :points="polygonAt(radius * step / 4)" class="radar-grid" />
      <line
        v-for="(stat, index) in statDefinitions" :key="stat.key"
        :x1="center.x" :y1="center.y" :x2="pointAt(index, radius).x" :y2="pointAt(index, radius).y"
        class="radar-axis"
      />
      <text x="220" y="111" class="radar-scale">50</text>
      <text x="220" y="59" class="radar-scale">100</text>
      <polygon :points="polygon" class="radar-shape" />
      <circle v-for="(point, index) in points" :key="index" :cx="point.x" :cy="point.y" r="4" class="radar-point" />
      <g v-for="(stat, index) in statDefinitions" :key="`label-${stat.key}`">
        <text
          :x="pointAt(index, radius + 23).x" :y="pointAt(index, radius + 27).y"
          :text-anchor="labelAnchors[index]" class="radar-label"
        >{{ stat.label }}</text>
        <text
          :x="pointAt(index, radius + 23).x" :y="pointAt(index, radius + 27).y + 18"
          :text-anchor="labelAnchors[index]" class="radar-value"
        >{{ stats[stat.key] }}</text>
      </g>
    </svg>
    <figcaption><span /> Профиль навыков</figcaption>
  </figure>
</template>

<style scoped>
.stat-radar { margin: 0; width: 100%; min-width: 0; }
.stat-radar svg { width: 100%; height: auto; display: block; overflow: visible; }
.radar-grid { fill: none; stroke: rgba(255, 255, 255, .08); stroke-width: 1; }
.radar-axis { stroke: rgba(255, 255, 255, .07); stroke-width: 1; }
.radar-shape { fill: rgba(158, 123, 255, .2); stroke: #ae91ff; stroke-width: 2; stroke-linejoin: round; }
.radar-point { fill: #d2ed89; stroke: #191a20; stroke-width: 2; }
.radar-label { fill: #a3a4af; font-family: Manrope, sans-serif; font-size: 10px; font-weight: 500; }
.radar-value { fill: #e7e1f6; font-family: Manrope, sans-serif; font-size: 13px; font-weight: 750; }
.radar-scale { fill: #686874; font-family: Manrope, sans-serif; font-size: 9px; }
figcaption { display: flex; justify-content: center; align-items: center; gap: 7px; color: #93939f; font-size: 11px; }
figcaption span { width: 6px; height: 6px; border-radius: 50%; background: #ae91ff; }
</style>
