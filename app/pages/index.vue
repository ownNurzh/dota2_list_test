<script setup lang="ts">
import { players, roles, type Role, type Tier } from '~/data/players'
import { calculateRating, filterPlayers, formatNumber, getHeroImage } from '~/utils/players'

const onHeroImageError = useHeroImageFallback()
const search = ref('')
const role = ref<Role | 'all'>('all')
const tier = ref<Tier | 'all'>('all')
const sort = ref<'rating-desc' | 'mmr-desc' | 'mmr-asc' | 'name-asc'>('rating-desc')
const view = ref<'grid' | 'list'>('grid')
const { isFavorite, toggleFavorite } = useFavorites()
const tab = useDirectoryTab()
const sortedPlayers = computed(() => filterPlayers(players, { sort: 'rating-desc' }))
const filteredPlayers = computed(() => filterPlayers(players, { search: search.value, role: role.value, tier: tier.value, sort: sort.value }).filter(player => tab.value !== 'favorites' || isFavorite(player.id)))
const hasFilters = computed(() => Boolean(search.value || role.value !== 'all' || tier.value !== 'all'))
const averageMmr = Math.round(players.reduce((sum, player) => sum + player.mmr, 0) / players.length)
const tierOneCount = players.filter(player => player.tier === 'Tier 1').length
const uniqueHeroes = new Set(players.flatMap(player => player.signatureHeroes)).size
const leaders = sortedPlayers.value.slice(0, 3)

function resetFilters() { search.value = ''; role.value = 'all'; tier.value = 'all'; sort.value = 'rating-desc' }
function rankOf(id: string) { return sortedPlayers.value.findIndex(player => player.id === id) + 1 }

watch(tab, () => { resetFilters(); if (tab.value === 'ranking') view.value = 'list'; else view.value = 'grid' })
if (tab.value === 'ranking') view.value = 'list'
useSeoMeta({ title: () => `${tab.value === 'favorites' ? 'Избранные' : tab.value === 'ranking' ? 'Рейтинг наших' : 'Наши игроки'} — DOTA қауым`, description: 'Собираемся по 30 человек, делимся на команды по пять и играем друг против друга в лобби Dota 2. Наши игроки, любимые герои и турнирная сетка.' })
</script>

<template>
  <div class="page-container directory-page">
    <section class="hero-section" aria-labelledby="hero-heading">
      <div class="hero-grid-pattern" /><div class="hero-orbit orbit-one" /><div class="hero-orbit orbit-two" />
      <div class="hero-copy"><span class="eyebrow"><AppIcon name="swords" :size="12" /> ӨЗІМІЗДІҢ ЛОББИ · DOTA 2</span><h1 id="hero-heading">Наши лобби.<br><span>Наши катки.</span></h1><p>Собираемся по 30 человек, делимся на пятёрки<br class="desktop-break"> и играем друг против друга. Все свои — до первого пика.</p><NuxtLink to="/tournament" class="button button-primary">Турнирная сетка <AppIcon name="arrow-right" :size="18" /></NuxtLink><div class="hero-bottom-caption"><span class="small-line" /> СОБРАЛИ СОСТАВЫ. СОЗДАЛИ ЛОББИ. ПОГНАЛИ.</div></div>
      <img @error="onHeroImageError" class="hero-art" src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/renders/phantom_assassin.png" alt="Phantom Assassin из Dota 2" fetchpriority="high" width="760" height="760">
      <div class="hero-character-label"><span>01 / CARRY</span><strong>PHANTOM<br>ASSASSIN</strong><span class="hero-character-line" /></div>
      <span class="hero-side-caption">OUR LOBBIES. OUR RIVALRIES.</span>
    </section>

    <section class="community-stats" aria-label="Наши игроки в цифрах">
      <div class="community-stat"><span class="stat-icon"><AppIcon name="users" :size="22" /></span><div><strong>{{ players.length }}<span> игрок</span></strong><p>Наши, все до одного</p></div></div>
      <div class="community-stat"><span class="stat-icon"><AppIcon name="chart" :size="22" /></span><div><strong>{{ formatNumber(averageMmr) }}<span> MMR</span></strong><p>Средний MMR наших игроков</p></div></div>
      <div class="community-stat"><span class="stat-icon"><AppIcon name="trophy" :size="22" /></span><div><strong>{{ tierOneCount }}<span> в Tier 1</span></strong><p>Есть кому тащить</p></div></div>
      <div class="community-stat"><span class="stat-icon"><AppIcon name="swords" :size="22" /></span><div><strong>{{ uniqueHeroes }}<span> героев</span></strong><p>Наши любимые пики</p></div></div>
    </section>

    <div class="directory-columns">
      <section id="players" class="players-section" aria-labelledby="players-heading">
        <div class="section-heading"><div><span class="eyebrow">ВСЕ СВОИ</span><h2 id="players-heading">{{ tab === 'favorites' ? 'Избранные' : tab === 'ranking' ? 'Рейтинг наших' : 'Наши игроки' }}<span>{{ filteredPlayers.length }}</span></h2></div><div class="view-switch" aria-label="Вид списка"><button :class="{ active: view === 'grid' }" aria-label="Карточки" :aria-pressed="view === 'grid'" @click="view = 'grid'"><AppIcon name="grid" :size="17" /></button><button :class="{ active: view === 'list' }" aria-label="Список" :aria-pressed="view === 'list'" @click="view = 'list'"><AppIcon name="list" :size="19" /></button></div></div>
        <div class="filters-panel"><div class="search-field"><AppIcon name="search" :size="18" /><input v-model="search" type="search" aria-label="Поиск игроков" placeholder="Ник, имя, герой или тег…"><kbd v-if="!search">⌕</kbd></div><div class="filter-select"><select v-model="tier" aria-label="Фильтр по тиру"><option value="all">Все тиры</option><option>Tier 1</option><option>Tier 2</option><option>Tier 3</option></select><AppIcon name="chevron-down" :size="15" /></div><div class="filter-select sort-select"><select v-model="sort" aria-label="Сортировка игроков"><option value="rating-desc">По рейтингу</option><option value="mmr-desc">MMR: по убыванию</option><option value="mmr-asc">MMR: по возрастанию</option><option value="name-asc">По алфавиту</option></select><AppIcon name="chevron-down" :size="15" /></div></div>
        <div class="role-filters" aria-label="Фильтр по роли"><button :class="{ active: role === 'all' }" :aria-pressed="role === 'all'" @click="role = 'all'">Все роли <span>{{ players.length }}</span></button><button v-for="(item, index) in roles" :key="item" :class="{ active: role === item }" :aria-pressed="role === item" @click="role = item"><span class="role-position">{{ index + 1 }}</span>{{ item }}</button></div>
        <div class="results-line" aria-live="polite"><span>{{ hasFilters ? 'Найдено' : tab === 'favorites' ? 'Сохранено' : 'В нашей компании' }}: <strong>{{ filteredPlayers.length }}</strong> <span class="results-total">/ {{ players.length }}</span></span><button v-if="hasFilters" @click="resetFilters"><AppIcon name="reset" :size="12" />Сбросить фильтры</button><span v-else class="score-hint"><span class="status-dot" /> Рейтинг по 5 характеристикам</span></div>

        <div v-if="filteredPlayers.length && view === 'grid'" class="players-grid"><PlayerCard v-for="player in filteredPlayers" :key="player.id" :player="player" :rank="rankOf(player.id)" /></div>
        <div v-else-if="filteredPlayers.length" class="players-table" role="table" aria-label="Список игроков"><div class="table-header" role="row"><span role="columnheader">#</span><span role="columnheader">ИГРОК</span><span role="columnheader">РОЛЬ</span><span role="columnheader">MMR</span><span role="columnheader">РЕЙТИНГ</span><span role="columnheader" class="sr-only">Избранное</span></div><div v-for="player in filteredPlayers" :key="player.id" class="table-row" role="row"><span class="table-rank" role="cell">{{ String(rankOf(player.id)).padStart(2, '0') }}</span><NuxtLink :to="`/players/${player.id}`" class="table-player" role="cell"><img @error="onHeroImageError" :src="getHeroImage(player.signatureHeroes[0] || 'Phantom Assassin')" alt="" width="42" height="42" loading="lazy"><span><strong>{{ player.nickname }}</strong><small>{{ player.fullName }} <span>· {{ player.tier }}</span></small></span></NuxtLink><span class="table-role" role="cell">{{ player.role }}</span><span class="table-mmr" role="cell">{{ formatNumber(player.mmr) }}</span><strong class="table-score" role="cell">{{ calculateRating(player.stats) }}</strong><span role="cell"><button class="favorite-button" :class="{ selected: isFavorite(player.id) }" :aria-label="`${isFavorite(player.id) ? 'Убрать из избранного' : 'В избранное'}: ${player.nickname}`" :aria-pressed="isFavorite(player.id)" @click="toggleFavorite(player.id)"><AppIcon name="star" :size="17" /></button></span></div></div>
        <div v-else class="empty-state panel"><AppIcon :name="tab === 'favorites' && !hasFilters ? 'star' : 'search'" :size="34" /><h3>{{ tab === 'favorites' && !hasFilters ? 'Кого берёшь в свою пятёрку?' : 'Никого из наших не нашли' }}</h3><p>{{ tab === 'favorites' && !hasFilters ? 'Нажми на звёздочку у своих — они будут под рукой.' : 'Может, опять поменял ник? Попробуй имя, героя или другой фильтр.' }}</p><button v-if="hasFilters" class="button button-secondary" @click="resetFilters">Сбросить фильтры</button><NuxtLink v-else to="/" class="button button-primary">Посмотреть наших <AppIcon name="arrow-right" :size="16" /></NuxtLink></div>
        <p class="directory-end"><span />{{ filteredPlayers.length ? 'Все свои. У каждого — своя фирменная катка.' : 'Наши рядом. Осталось только собраться.' }}<span /></p>
      </section>

      <aside class="directory-sidebar">
        <section class="evening-panel panel" aria-labelledby="evening-heading">
          <div class="evening-heading"><span class="evening-symbol"><AppIcon name="sparkles" :size="16" /></span><span class="eyebrow">НАШ ПРИВЫЧНЫЙ РИТУАЛ</span></div>
          <h2 id="evening-heading">Сегодня играем своими</h2>
          <ol class="evening-steps"><li><span>01</span><strong>Собрались человек 30</strong><AppIcon name="chevron-down" :size="12" /></li><li><span>02</span><strong>Разбились на пятёрки</strong><AppIcon name="chevron-down" :size="12" /></li><li><span>03</span><strong>Создали свои лобби</strong><AppIcon name="swords" :size="13" /></li></ol>
          <p>Пять на пять. В двойной сетке после поражения есть второй шанс.</p><NuxtLink to="/tournament" class="sidebar-link">Выбрать формат турнира <AppIcon name="arrow-right" :size="15" /></NuxtLink>
        </section>
        <section class="leaderboard-panel panel"><div class="sidebar-heading"><span class="sidebar-icon"><AppIcon name="trophy" :size="19" /></span><h2>Легенды наших лобби</h2><span class="tiny-pill">TOP 3</span></div><p class="sidebar-intro">Трое наших с самым высоким баллом</p><NuxtLink v-for="(player, index) in leaders" :key="player.id" :to="`/players/${player.id}`" class="leader-row"><span class="leader-position" :class="{ first: index === 0 }">{{ index === 0 ? '♛' : `0${index + 1}` }}</span><img @error="onHeroImageError" :src="getHeroImage(player.signatureHeroes[0] || 'Phantom Assassin')" alt="" width="38" height="38" loading="lazy"><span class="leader-info"><strong>{{ player.nickname }}</strong><small>{{ player.role }} · {{ formatNumber(player.mmr) }}</small></span><strong class="leader-score">{{ calculateRating(player.stats) }}</strong></NuxtLink><NuxtLink to="/?tab=ranking" class="sidebar-link">Рейтинг всех наших <AppIcon name="arrow-right" :size="15" /></NuxtLink></section>
        <section class="rating-panel panel"><div class="rating-visual"><span class="rating-ring">A<span>+</span></span><AppIcon class="rating-sparkle" name="sparkles" :size="25" /></div><span class="eyebrow">MMR — НЕ ВСЯ ИСТОРИЯ</span><h2>Скилл по-свойски.</h2><p>Кто вывозит на механике, кто читает карту, а кто прикроет спину. Пять характеристик — один балл.</p><div class="rating-mini-bars"><i style="--bar: 88%" /><i style="--bar: 69%" /><i style="--bar: 94%" /><i style="--bar: 78%" /><i style="--bar: 84%" /></div><details class="rating-explanation"><summary>Как считается рейтинг <AppIcon name="chevron-down" :size="14" /></summary><p>Механика × 25% + фарм × 20% + командная игра × 20% + понимание игры × 25% + универсальность × 10%. Результат округляется до целого.</p><p>Характеристики — условные оценки для демонстрации, а не статистика матчей. MMR не входит в формулу.</p></details></section>
        <div class="community-motto"><AppIcon name="swords" :size="22" /><p>По разные стороны реки.<br><strong>В одной компании.</strong></p><span>GL HF, ДОСТАР.</span></div>
      </aside>
    </div>
  </div>
</template>
