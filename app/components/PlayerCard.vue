<script setup lang="ts">
import type { Player } from '~/data/players'
import { calculateRating, formatNumber, getHeroImage } from '~/utils/players'
const props = defineProps<{ player: Player; rank: number }>()
const { isFavorite, toggleFavorite } = useFavorites()
const onHeroImageError = useHeroImageFallback()
const rating = computed(() => calculateRating(props.player.stats))
const portrait = computed(() => getHeroImage(props.player.signatureHeroes[0] || 'Phantom Assassin'))
const positions: Record<string, string> = { Carry: '01', Mid: '02', Offlane: '03', 'Soft Support': '04', 'Hard Support': '05' }
</script>

<template>
  <article class="player-card" :class="{ 'tier-one': player.tier === 'Tier 1' }">
    <div class="card-cover" :style="{ '--hero-image': `url(${portrait})` }">
      <div class="card-topline"><span class="tier-badge" :class="`tier-${player.tier.slice(-1)}`"><span />{{ player.tier }}</span><span class="card-rank">#{{ String(rank).padStart(2, '0') }}</span></div>
      <div class="card-identity">
        <img @error="onHeroImageError" class="player-avatar" :src="portrait" alt="" width="54" height="54" loading="lazy">
        <div class="player-name"><h3><NuxtLink :to="`/players/${player.id}`">{{ player.nickname }}</NuxtLink></h3><p>{{ player.fullName }}</p></div>
        <button class="favorite-button" :class="{ selected: isFavorite(player.id) }" :aria-label="`${isFavorite(player.id) ? 'Убрать из избранного' : 'В избранное'}: ${player.nickname}`" :aria-pressed="isFavorite(player.id)" @click="toggleFavorite(player.id)"><AppIcon name="star" :size="18" /></button>
      </div>
    </div>
    <div class="card-body">
      <div class="card-numbers"><div class="card-mmr"><span>MMR</span><strong>{{ formatNumber(player.mmr) }}</strong></div><div class="card-rating"><span>РЕЙТИНГ <AppIcon name="bolt" :size="11" /></span><strong>{{ rating }}<small>/ 100</small></strong></div></div>
      <div class="card-role"><AppIcon :name="player.role.includes('Support') ? 'shield' : 'swords'" :size="14" /><span>{{ player.role }}</span><small>POS {{ positions[player.role] }}</small></div>
      <div class="card-tags"><span v-for="tag in player.tags.slice(0, 2)" :key="tag" class="tag" :title="tag">{{ tag }}</span><span v-if="!player.tags.length" class="tag">Новая легенда</span></div>
      <div class="card-bottom"><div class="hero-thumbnails"><img @error="onHeroImageError" v-for="hero in player.signatureHeroes.slice(0, 3)" :key="hero" :src="getHeroImage(hero)" :alt="hero" :title="hero" width="38" height="26" loading="lazy"><span v-if="!player.signatureHeroes.length" class="muted">Герои не указаны</span></div><NuxtLink :to="`/players/${player.id}`" class="profile-link" :aria-label="`Профиль ${player.nickname}`">Профиль <AppIcon name="arrow-right" :size="15" /></NuxtLink></div>
    </div>
  </article>
</template>
