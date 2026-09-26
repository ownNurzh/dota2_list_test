<script setup lang="ts">
import { players, statDefinitions } from '~/data/players'
import { calculateRating, formatNumber, getHeroImage } from '~/utils/players'

definePageMeta({
  validate: route => typeof route.params.id === 'string' && players.some(player => player.id === route.params.id),
})

const route = useRoute()
const onHeroImageError = useHeroImageFallback()
const player = computed(() => players.find(item => item.id === route.params.id))

if (!player.value) {
  throw createError({ statusCode: 404, statusMessage: 'Игрок не найден', fatal: true })
}

const { isFavorite, toggleFavorite } = useFavorites()
const rating = computed(() => player.value ? calculateRating(player.value.stats) : 0)
const favorite = computed(() => player.value ? isFavorite(player.value.id) : false)
const mainHero = computed(() => player.value?.signatureHeroes[0] || 'Juggernaut')
const rolePositions: Record<string, string> = {
  Carry: 'Позиция 01', Mid: 'Позиция 02', Offlane: 'Позиция 03',
  'Soft Support': 'Позиция 04', 'Hard Support': 'Позиция 05',
}
const strongestStat = computed(() => player.value
  ? [...statDefinitions].sort((a, b) => player.value!.stats[b.key] - player.value!.stats[a.key])[0]
  : undefined)
const relatedPlayers = computed(() => players
  .filter(item => item.id !== player.value?.id && item.role === player.value?.role)
  .sort((a, b) => calculateRating(b.stats) - calculateRating(a.stats))
  .slice(0, 3))

useSeoMeta({
  title: () => `${player.value?.nickname ?? 'Игрок'} — DOTA қауым`,
  description: () => `${player.value?.nickname} из нашего стака: ${player.value?.role}, ${formatNumber(player.value?.mmr ?? 0)} MMR, любимые пики и байки из пати.`,
})
</script>

<template>
  <div v-if="player" class="page-container player-page">
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
      <NuxtLink to="/"><AppIcon name="arrow-left" :size="15" /> Наш стак</NuxtLink>
      <AppIcon name="chevron-right" :size="13" />
      <span aria-current="page">{{ player.nickname }}</span>
    </nav>

    <section class="profile-hero" aria-labelledby="player-name">
      <img @error="onHeroImageError" v-if="player.signatureHeroes.length" class="profile-art" :src="getHeroImage(mainHero)" alt="" fetchpriority="high" />
      <div class="profile-art-shade" />
      <div class="profile-art-grid" />

      <div class="profile-hero-top">
        <span class="eyebrow"><AppIcon name="users" :size="12" /> ОДИН ИЗ НАШИХ / {{ player.id.toUpperCase() }}</span>
        <span v-if="player.signatureHeroes.length" class="hero-caption">{{ mainHero }} <span>/ SIGNATURE HERO</span></span>
      </div>

      <div class="profile-identity">
        <div class="identity-badges">
          <span class="tier-badge" :class="`tier-${player.tier.slice(-1)}`">{{ player.tier }}</span>
          <span class="identity-role"><AppIcon name="swords" :size="14" /> {{ player.role }}</span>
        </div>
        <h1 id="player-name">{{ player.nickname }}</h1>
        <div class="identity-subtitle">
          <img @error="onHeroImageError" v-if="player.signatureHeroes.length" :src="getHeroImage(mainHero)" :alt="mainHero" width="36" height="36" />
          <span>{{ player.fullName }}</span>
          <span class="subtitle-divider" />
          <span>{{ rolePositions[player.role] || player.role }}</span>
        </div>
      </div>

      <div class="profile-hero-bottom">
        <div class="profile-metrics">
          <div class="profile-score">
            <div class="score-icon"><AppIcon name="sparkles" :size="23" /></div>
            <div><span class="metric-label">Рейтинг игрока</span><span class="score-number">{{ rating }}<small>/ 100</small></span></div>
          </div>
          <div class="profile-mmr"><span class="metric-label">Текущий MMR</span><strong>{{ formatNumber(player.mmr) }}</strong></div>
        </div>
        <button
          class="button favorite-button" :class="{ 'is-favorite': favorite }"
          type="button" :aria-pressed="favorite" @click="toggleFavorite(player.id)"
        ><AppIcon name="star" :size="17" /><span>{{ favorite ? 'В избранном' : 'В избранное' }}</span></button>
      </div>
    </section>

    <div class="profile-layout">
      <div class="profile-main">
        <section class="panel skills-panel" aria-labelledby="skills-title">
          <div class="section-header">
            <div><span class="eyebrow section-kicker">ЧТО ПРИНОСИТ В ПАТИ</span><h2 id="skills-title">Сильные стороны</h2></div>
            <span class="scale-label">Шкала 0–100</span>
          </div>
          <div class="skills-body">
            <StatRadar :stats="player.stats" :nickname="player.nickname" />
            <div class="stat-list">
              <div v-for="stat in statDefinitions" :key="stat.key" class="stat-row">
                <div class="stat-title"><span>{{ stat.label }}</span><strong>{{ player.stats[stat.key] }}<small>/100</small></strong></div>
                <div class="stat-track" role="meter" :aria-label="stat.label" :aria-valuenow="player.stats[stat.key]" :aria-valuemin="0" :aria-valuemax="100">
                  <div :style="{ width: `${player.stats[stat.key]}%` }" :class="{ 'stat-best': stat.key === strongestStat?.key }" />
                </div>
                <p>{{ stat.description }}</p>
              </div>
            </div>
          </div>
          <div class="skills-footnote"><AppIcon name="info" :size="15" /><p>Условные оценки для нашего стака. Не статистика матчей.</p></div>
        </section>

        <section class="panel heroes-panel" aria-labelledby="heroes-title">
          <div class="section-header">
            <div><span class="eyebrow section-kicker">ЗНАКОМЫЕ ПИКИ</span><h2 id="heroes-title">Фирменные герои</h2></div>
            <span class="count-badge">{{ player.signatureHeroes.length }}</span>
          </div>
          <div v-if="player.signatureHeroes.length" class="hero-pool">
            <article v-for="(hero, index) in player.signatureHeroes" :key="hero" class="signature-hero">
              <img @error="onHeroImageError" :src="getHeroImage(hero)" :alt="hero" loading="lazy" width="256" height="144" />
              <div class="signature-shade" />
              <span class="hero-order">0{{ index + 1 }}</span>
              <div class="signature-label"><small>{{ index === 0 ? 'ОСНОВНОЙ ВЫБОР' : 'В ПУЛЕ ИГРОКА' }}</small><h3>{{ hero }}</h3></div>
            </article>
          </div>
          <div v-else class="empty-heroes"><AppIcon name="swords" :size="26" /><p>Пул героев пока не указан.</p></div>
        </section>
      </div>

      <aside class="profile-sidebar" aria-label="Информация об игроке">
        <section class="panel notes-panel">
          <div class="note-title"><AppIcon name="users" :size="18" /><h2>Байки из пати</h2></div>
          <div v-if="player.tags.length" class="player-tags"><span v-for="tag in player.tags" :key="tag" class="tag">{{ tag }}</span></div>
          <div class="community-note">
            <span class="quote-mark" aria-hidden="true">“</span>
            <blockquote v-if="player.notes" lang="kk">{{ player.notes }}</blockquote>
            <p v-else class="no-note">Свою байку ещё не записали. Будет что вспомнить после катки.</p>
            <span class="note-source">Наши заметки. Свои поймут.</span>
          </div>
        </section>

        <section class="profile-rating-panel" aria-labelledby="rating-title">
          <span class="rating-symbol"><AppIcon name="chart" :size="21" /></span>
          <h2 id="rating-title">За цифрами —<br /> стиль игры.</h2>
          <p>Общий балл объединяет пять характеристик с разным весом.</p>
          <details class="rating-details">
            <summary>Как считается рейтинг <AppIcon name="chevron-right" :size="15" /></summary>
            <div class="rating-formula">
              <p>Сумма оценок, умноженных на их вес:</p>
              <ul><li v-for="stat in statDefinitions" :key="stat.key"><span>{{ stat.label }}</span><strong>{{ Math.round(stat.weight * 100) }}%</strong></li></ul>
              <div class="formula-result"><span>Итоговый балл</span><strong>{{ rating }} / 100</strong></div>
              <p>Оценки демонстрационные и субъективные; MMR в формулу не входит.</p>
            </div>
          </details>
        </section>
      </aside>
    </div>

    <section v-if="relatedPlayers.length" class="related-section" aria-labelledby="related-title">
      <div class="section-header"><div><span class="eyebrow section-kicker">ТОЖЕ ИЗ НАШИХ</span><h2 id="related-title">На той же позиции</h2></div><NuxtLink to="/" class="all-players-link">Весь стак <AppIcon name="arrow-right" :size="17" /></NuxtLink></div>
      <div class="related-grid">
        <NuxtLink v-for="related in relatedPlayers" :key="related.id" :to="`/players/${related.id}`" class="related-player">
          <img @error="onHeroImageError" :src="getHeroImage(related.signatureHeroes[0] || 'Juggernaut')" alt="" loading="lazy" width="52" height="52" />
          <div class="related-identity"><strong>{{ related.nickname }}</strong><span>{{ related.role }} <span>·</span> {{ formatNumber(related.mmr) }} MMR</span></div>
          <span class="related-rating">{{ calculateRating(related.stats) }}</span><AppIcon name="arrow-right" :size="16" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.player-page { padding-top: 28px; padding-bottom: 66px; }
.breadcrumbs { display: flex; align-items: center; gap: 14px; min-width: 0; margin-bottom: 24px; color: #62626e; font-size: 12px; }
.breadcrumbs a { display: inline-flex; align-items: center; gap: 9px; flex-shrink: 0; color: #a4a4af; transition: color .2s; }
.breadcrumbs a:hover { color: #d2ed89; }
.breadcrumbs > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #d0cfd7; }
.profile-hero { position: relative; isolation: isolate; padding: 31px 38px 30px; overflow: hidden; border: 1px solid #ffffff12; border-radius: 18px; background: #191922; }
.profile-art { position: absolute; z-index: -3; right: 0; top: 0; width: 69%; height: 100%; object-fit: cover; object-position: center 38%; opacity: .62; transform: scale(1.015); }
.profile-art-shade { position: absolute; z-index: -2; inset: 0; background: linear-gradient(90deg, #191922 8%, #191922f2 31%, #19192245 74%, #19192218), linear-gradient(0deg, #191922e8, transparent 75%); }
.profile-art-grid { position: absolute; z-index: -1; inset: 0; background-image: radial-gradient(#ffffff15 .7px, transparent .7px); background-size: 12px 12px; opacity: .2; pointer-events: none; }
.profile-hero-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.profile-hero-top .eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9px; letter-spacing: .16em; color: #bbb2d7; }
.live-dot { width: 5px; height: 5px; border-radius: 50%; background: #d2ed89; box-shadow: 0 0 11px #d2ed8950; }
.hero-caption { color: #dcd8e5; font-size: 10px; text-shadow: 0 1px 8px #101114; }
.hero-caption span { margin-left: 8px; color: #a5a0b0; font-size: 8px; letter-spacing: .06em; }
.profile-identity { padding: 45px 0 35px; max-width: 85%; }
.identity-badges { display: flex; align-items: center; flex-wrap: wrap; gap: 11px; margin-bottom: 19px; }
.identity-badges .tier-badge { font-size: 10px; }
.identity-role { display: inline-flex; align-items: center; gap: 6px; color: #c6c3d1; font-size: 11px; }
.profile-identity h1 { margin: 0 0 20px; max-width: 100%; overflow-wrap: anywhere; font-family: Unbounded, Manrope, sans-serif; font-size: clamp(28px, 4.1vw, 58px); font-weight: 650; letter-spacing: -.045em; line-height: 1.2; text-shadow: 0 3px 30px #10111420; }
.identity-subtitle { display: flex; align-items: center; flex-wrap: wrap; gap: 11px; color: #b3afc2; font-size: 12px; }
.identity-subtitle img { display: block; width: 30px; height: 30px; border: 1px solid #ffffff20; border-radius: 9px; object-fit: cover; }
.identity-subtitle > span:first-of-type { color: #e5e2ec; }
.subtitle-divider { width: 3px; height: 3px; border-radius: 50%; background: #696475; }
.profile-hero-bottom { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding-top: 23px; border-top: 1px solid #ffffff12; }
.profile-metrics { display: flex; align-items: center; gap: 37px; }
.profile-score { display: flex; align-items: center; gap: 14px; }
.score-icon { display: grid; place-items: center; width: 49px; height: 49px; color: #d2ed89; background: #d2ed8910; border: 1px solid #d2ed8926; border-radius: 13px; }
.metric-label { display: block; margin-bottom: 5px; color: #a7a1b6; font-size: 10px; }
.score-number { display: flex; align-items: baseline; gap: 8px; color: #d2ed89; font-family: Unbounded, Manrope, sans-serif; font-size: 29px; font-weight: 550; line-height: 1.1; }
.score-number small { color: #817a92; font-family: Manrope, sans-serif; font-size: 12px; font-weight: 500; }
.profile-mmr { padding-left: 35px; border-left: 1px solid #ffffff15; }
.profile-mmr strong { color: #f1eff7; font-family: Unbounded, Manrope, sans-serif; font-size: 24px; font-weight: 500; line-height: 1.3; letter-spacing: -.03em; }
.favorite-button { display: inline-flex; width: auto; height: auto; min-height: 42px; padding: 0 17px; color: #d8d3e4; background: #22212cbb; border: 1px solid #ffffff20; white-space: nowrap; font-size: 11px; }
.favorite-button:hover, .favorite-button.is-favorite { color: #d2ed89; border-color: #d2ed8950; background: #d2ed8910; }
.favorite-button.is-favorite :deep(svg) { fill: #d2ed8920; }
.profile-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; align-items: start; gap: 24px; margin-top: 24px; }
.profile-main, .profile-sidebar { display: grid; min-width: 0; gap: 24px; }
.skills-panel, .heroes-panel { padding: 28px; border-radius: 15px; }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 15px; }
.section-kicker { display: block; margin-bottom: 10px; color: #77747f; font-size: 8px; letter-spacing: .18em; }
.section-header h2 { margin: 0; font-family: Unbounded, Manrope, sans-serif; font-size: 17px; font-weight: 500; letter-spacing: -.04em; line-height: 1.45; }
.scale-label { color: #787681; font-size: 10px; white-space: nowrap; }
.skills-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(230px, 1fr); align-items: center; gap: 21px; padding-top: 28px; }
.stat-list { display: grid; gap: 19px; }
.stat-title { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 8px; font-size: 11px; color: #d4d1dd; }
.stat-title strong { color: #eeedf5; font-size: 12px; }
.stat-title small { margin-left: 3px; color: #6b6976; font-size: 9px; font-weight: 500; }
.stat-track { height: 4px; border-radius: 10px; overflow: hidden; background: #ffffff09; }
.stat-track > div { height: 100%; border-radius: inherit; background: #a88ae9; }
.stat-track > .stat-best { background: #d2ed89; }
.stat-row p { margin: 6px 0 0; color: #807c8c; font-size: 9px; line-height: 1.5; }
.skills-footnote { display: flex; align-items: flex-start; gap: 8px; margin-top: 30px; padding-top: 18px; border-top: 1px solid #ffffff0a; color: #777380; }
.skills-footnote :deep(svg) { flex-shrink: 0; margin-top: 1px; }
.skills-footnote p { margin: 0; font-size: 10px; line-height: 1.6; }
.count-badge { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid #ffffff12; border-radius: 8px; color: #a6a2af; font-size: 11px; }
.hero-pool { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
.signature-hero { position: relative; isolation: isolate; min-height: 175px; overflow: hidden; border: 1px solid #ffffff0a; border-radius: 10px; background: #24212b; }
.signature-hero img { position: absolute; z-index: -2; display: block; width: 100%; height: 100%; object-fit: cover; object-position: 55% center; transition: transform .4s; }
.signature-hero:hover img { transform: scale(1.045); }
.signature-shade { position: absolute; z-index: -1; inset: 0; background: linear-gradient(0deg, #101114f5, #10111405 85%); }
.hero-order { position: absolute; top: 12px; left: 12px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; color: #fff; background: #10111470; backdrop-filter: blur(8px); font-size: 9px; }
.signature-label { position: absolute; left: 14px; right: 10px; bottom: 15px; }
.signature-label small { display: block; margin-bottom: 6px; color: #b9b3c3; font-size: 7px; letter-spacing: .12em; }
.signature-label h3 { margin: 0; color: #f4f4f6; font-size: 13px; font-weight: 700; line-height: 1.4; }
.empty-heroes { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 155px; margin-top: 20px; color: #716d7f; background: #ffffff02; border: 1px dashed #ffffff10; border-radius: 10px; }
.empty-heroes p { color: #9691a3; font-size: 12px; }
.notes-panel { padding: 25px; border-radius: 15px; }
.note-title { display: flex; align-items: center; gap: 9px; color: #b6a0e3; }
.note-title h2 { margin: 0; color: #ebe8f2; font-size: 13px; font-weight: 700; }
.player-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 20px; }
.player-tags .tag { font-size: 9px; max-width: 100%; overflow-wrap: anywhere; white-space: normal; overflow: visible; text-overflow: clip; }
.community-note { margin-top: 23px; padding-top: 16px; border-top: 1px solid #ffffff0d; }
.quote-mark { display: block; height: 27px; color: #a385e4; font-family: Georgia, serif; font-size: 49px; line-height: 1; }
.community-note blockquote { margin: 9px 0 18px; color: #cbc6d8; font-size: 13px; line-height: 1.85; overflow-wrap: anywhere; }
.no-note { color: #9891a7; font-size: 12px; line-height: 1.8; }
.note-source { color: #6f697d; font-size: 9px; }
.profile-rating-panel { padding: 25px; border: 1px solid #ad87ff1c; border-radius: 15px; background: radial-gradient(ellipse at 100% 0, #a77dff10, transparent 70%), #19171f; }
.rating-symbol { display: flex; align-items: center; justify-content: center; width: 37px; height: 37px; margin-bottom: 21px; border: 1px solid #ae8af229; border-radius: 10px; color: #b298ed; background: #a583de0b; }
.profile-rating-panel > h2 { margin: 0; font-family: Unbounded, Manrope, sans-serif; color: #e8e0f5; font-size: 17px; font-weight: 450; line-height: 1.7; letter-spacing: -.03em; }
.profile-rating-panel > p { margin: 13px 0 22px; color: #968ba8; font-size: 11px; line-height: 1.85; }
.rating-details { padding-top: 16px; border-top: 1px solid #ffffff0d; }
.rating-details summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; color: #bea9e5; font-size: 10px; list-style: none; }
.rating-details summary::-webkit-details-marker { display: none; }
.rating-details summary :deep(svg) { transition: transform .2s; }
.rating-details[open] summary :deep(svg) { transform: rotate(90deg); }
.rating-formula { padding-top: 7px; }
.rating-formula p { color: #91859f; font-size: 10px; line-height: 1.8; }
.rating-formula ul { display: grid; gap: 9px; margin: 15px 0; padding: 0; list-style: none; }
.rating-formula li { display: flex; justify-content: space-between; gap: 8px; color: #aaa0b9; font-size: 10px; }
.rating-formula li strong { color: #d0c0ea; font-weight: 500; }
.formula-result { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 13px; border-top: 1px solid #ffffff0d; font-size: 10px; color: #b1a4c3; }
.formula-result strong { color: #d2ed89; font-size: 12px; }
.related-section { margin-top: 43px; }
.all-players-link { display: inline-flex; align-items: center; gap: 9px; flex-shrink: 0; color: #b0a9be; font-size: 11px; transition: color .2s; }
.all-players-link:hover { color: #d2ed89; }
.related-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 23px; }
.related-player { display: flex; align-items: center; gap: 12px; padding: 18px; border: 1px solid #ffffff0c; border-radius: 12px; background: #191a20; transition: background .2s, border-color .2s; }
.related-player:hover { background: #202027; border-color: #a98bf647; }
.related-player > img { width: 43px; height: 43px; flex-shrink: 0; border-radius: 9px; object-fit: cover; }
.related-identity { display: flex; flex-direction: column; min-width: 0; gap: 6px; }
.related-identity strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e8e5ee; font-size: 11px; }
.related-identity > span { color: #837d90; font-size: 9px; }
.related-identity > span span { padding: 0 3px; }
.related-rating { margin-left: auto; padding-left: 2px; color: #d2ed89; font-family: Unbounded, Manrope, sans-serif; font-size: 16px; font-weight: 500; }
.related-player > :deep(svg) { flex-shrink: 0; color: #686170; }
@media (min-width: 1300px) { .skills-body { gap: 34px; } }
@media (max-width: 1120px) {
  .profile-layout { grid-template-columns: minmax(0, 1fr) 260px; gap: 18px; }
  .skills-panel, .heroes-panel { padding: 23px; }
  .skills-body { gap: 5px; grid-template-columns: minmax(0, 1fr) minmax(200px, 1fr); }
  .notes-panel, .profile-rating-panel { padding: 22px; }
  .signature-hero { min-height: 155px; }
  .related-player { padding: 14px; gap: 9px; }
}
@media (max-width: 940px) {
  .profile-layout { grid-template-columns: minmax(0, 1fr); }
  .profile-sidebar { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 18px; }
  .skills-body { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 35px; }
  .hero-caption { display: none; }
  .related-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .related-player:last-child:nth-child(3) { grid-column: 1 / -1; }
}
@media (max-width: 620px) {
  .player-page { padding-top: 20px; padding-bottom: 40px; }
  .breadcrumbs { margin-bottom: 18px; font-size: 11px; }
  .profile-hero { padding: 23px 22px; border-radius: 14px; }
  .profile-art { width: 100%; opacity: .37; object-position: 65% center; }
  .profile-art-shade { background: linear-gradient(90deg, #191922ee, #19192250), linear-gradient(0deg, #191922, #19192245 80%); }
  .profile-identity { max-width: 100%; padding-top: 37px; padding-bottom: 30px; }
  .profile-identity h1 { margin-bottom: 18px; font-size: clamp(25px, 7.4vw, 39px); }
  .identity-badges { margin-bottom: 17px; }
  .profile-hero-bottom { flex-direction: column; align-items: stretch; gap: 23px; padding-top: 23px; }
  .profile-metrics { justify-content: flex-start; gap: 24px; }
  .profile-score { gap: 10px; }
  .score-icon { width: 42px; height: 42px; border-radius: 11px; }
  .score-number { font-size: 26px; gap: 5px; }
  .score-number small { font-size: 10px; }
  .profile-mmr { padding-left: 23px; }
  .profile-mmr strong { font-size: 22px; }
  .metric-label { font-size: 9px; }
  .favorite-button { justify-content: center; min-height: 42px; }
  .profile-layout, .profile-main, .profile-sidebar { gap: 16px; }
  .profile-layout { margin-top: 16px; }
  .skills-panel, .heroes-panel { padding: 22px; border-radius: 14px; }
  .section-header h2 { font-size: 15px; }
  .section-kicker { margin-bottom: 8px; font-size: 7px; }
  .scale-label { font-size: 9px; }
  .skills-body { grid-template-columns: minmax(0, 1fr); gap: 25px; padding-top: 17px; }
  .skills-body :deep(.stat-radar) { max-width: 380px; margin: 0 auto; }
  .stat-list { gap: 19px; }
  .stat-title { font-size: 12px; }
  .stat-row p { font-size: 10px; }
  .skills-footnote { margin-top: 23px; }
  .profile-sidebar { grid-template-columns: minmax(0, 1fr); }
  .hero-pool { gap: 9px; margin-top: 20px; }
  .signature-hero { min-height: 145px; }
  .signature-label { left: 9px; right: 7px; bottom: 11px; }
  .signature-label small { font-size: 6px; letter-spacing: .08em; line-height: 1.5; }
  .signature-label h3 { font-size: 11px; }
  .hero-order { top: 9px; left: 9px; width: 21px; height: 21px; font-size: 8px; }
  .notes-panel, .profile-rating-panel { padding: 24px; }
  .profile-rating-panel > h2 br { display: none; }
  .rating-symbol { margin-bottom: 14px; }
  .profile-rating-panel > p { max-width: 320px; }
  .related-section { margin-top: 34px; }
  .related-section .section-header { align-items: flex-end; }
  .related-section .section-header h2 { max-width: 180px; }
  .all-players-link { font-size: 10px; gap: 5px; }
  .related-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; margin-top: 20px; }
  .related-player:last-child:nth-child(3) { grid-column: auto; }
  .related-player { padding: 16px; gap: 12px; }
  .related-identity strong { font-size: 12px; }
  .related-identity > span { font-size: 10px; }
}
@media (max-width: 360px) {
  .profile-hero { padding: 20px 17px; }
  .profile-metrics { gap: 17px; }
  .profile-mmr { padding-left: 17px; }
  .score-icon { display: none; }
  .skills-panel, .heroes-panel { padding: 19px 16px; }
  .hero-pool { grid-template-columns: minmax(0, 1fr); }
  .signature-hero { min-height: 135px; }
  .signature-hero img { object-position: center 38%; }
  .signature-label { left: 13px; }
  .signature-label h3 { font-size: 13px; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }
</style>
