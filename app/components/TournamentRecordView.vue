<script setup lang="ts">
import { players } from '~/data/players'
import { getChampion, buildBracket } from '~/utils/tournament'
import { formatRole } from '~/utils/players'
import { formatTournamentDate, tournamentFormatLabel, type TournamentArchiveEntry } from '~/utils/tournament-history'

const props = defineProps<{ entry: TournamentArchiveEntry }>()
const playersById = new Map(players.map(player => [player.id, player]))
const champion = computed(() => getChampion(props.entry.state))
const matchCount = computed(() => buildBracket(props.entry.state).flatMap(round => round.matches).filter(match => match.status === 'complete').length)
</script>

<template>
  <article class="record-view">
    <header class="record-hero panel">
      <span class="eyebrow">В ИСТОРИИ НАШИХ ЛОББИ</span>
      <h1>{{ entry.title }}</h1>
      <p class="record-meta"><time :datetime="entry.date">{{ formatTournamentDate(entry.date) }}</time><span>·</span>{{ entry.state.size }} команд<span>·</span>{{ matchCount }} матчей</p>
      <p class="record-format">{{ tournamentFormatLabel(entry.state) }}</p>
      <div v-if="champion" class="record-winner"><AppIcon name="trophy" :size="31" /><div><small>ЗАБРАЛИ КУБОК</small><strong>{{ champion.name }}</strong></div></div>
    </header>

    <section class="record-rosters" aria-labelledby="record-rosters-heading">
      <div class="record-section-title"><span class="eyebrow">КТО С КЕМ ИГРАЛ</span><h2 id="record-rosters-heading">Команды и составы</h2></div>
      <div class="record-team-grid">
        <article v-for="team in entry.state.teams" :key="team.id" class="record-team panel" :class="{ 'record-team-champion': champion?.id === team.id }">
          <header><h3>{{ team.name }}</h3><AppIcon v-if="champion?.id === team.id" name="crown" :size="19" /><span>{{ team.playerIds.length }}/5</span></header>
          <ul v-if="team.playerIds.length">
            <li v-for="id in team.playerIds" :key="id">
              <NuxtLink v-if="playersById.get(id)" :to="`/players/${id}`"><span>{{ playersById.get(id)!.nickname }}</span><small>{{ formatRole(playersById.get(id)!.role) }}</small><AppIcon name="arrow-right" :size="13" /></NuxtLink>
            </li>
          </ul>
          <p v-else class="record-missing">Состав не был указан.</p>
          <p v-if="team.playerIds.length > 0 && team.playerIds.length < 5" class="record-missing">Сохранён неполный состав.</p>
        </article>
      </div>
    </section>
    <TournamentBracket :state="entry.state" readonly />
  </article>
</template>

<style scoped>
.record-hero { padding: 32px; border-radius: 16px; background: radial-gradient(ellipse at 95% 0, #c7e68a10, transparent 60%), #1c1d22; }
.record-hero > .eyebrow { font-size: 9px; color: #a6ba86; }
.record-hero h1 { margin-top: 16px; font-family: var(--font-heading); font-size: clamp(24px, 4vw, 39px); font-weight: 550; line-height: 1.45; overflow-wrap: anywhere; }
.record-meta { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 18px; color: #afa5b9; font-size: 12px; line-height: 1.8; }
.record-meta > span { color: #5c5267; }
.record-format { margin-top: 8px; color: #a69bb2; font-size: 12px; line-height: 1.8; }
.record-winner { display: flex; align-items: center; gap: 17px; margin-top: 28px; padding-top: 22px; border-top: 1px solid #ffffff0d; color: #d0eb91; }
.record-winner div { display: flex; flex-direction: column; min-width: 0; gap: 8px; }
.record-winner small { font-size: 9px; letter-spacing: 1.1px; color: #9eae87; }
.record-winner strong { font-size: 21px; overflow-wrap: anywhere; }
.record-rosters { margin-top: 32px; }
.record-section-title .eyebrow { color: #8f809e; font-size: 8px; }
.record-section-title h2 { margin-top: 10px; font-family: var(--font-heading); font-size: 20px; font-weight: 500; }
.record-team-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 15px; margin-top: 21px; }
.record-team { min-width: 0; padding: 19px; border-radius: 10px; }
.record-team-champion { border-color: #c7e68a3b; }
.record-team header { display: flex; align-items: center; gap: 9px; padding-bottom: 14px; border-bottom: 1px solid #ffffff0a; }
.record-team h3 { font-size: 14px; font-weight: 650; overflow-wrap: anywhere; }
.record-team header > svg { color: #d0eb91; }
.record-team header > span { margin-left: auto; flex-shrink: 0; font-size: 10px; color: #94829f; }
.record-team ul { list-style: none; margin: 8px 0 0; padding: 0; }
.record-team a { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; min-height: 44px; padding: 9px 0; border-bottom: 1px solid #ffffff06; font-size: 12px; }
.record-team a > span { overflow-wrap: anywhere; }
.record-team a > small { margin-left: auto; font-size: 9px; color: #9e8aaf; }
.record-team a > svg { color: #77618d; }
.record-team a:hover { color: #d0eb91; }
.record-missing { margin-top: 13px; color: #8c7d9a; font-size: 11px; line-height: 1.7; }
@media (max-width: 1000px) { .record-team-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .record-hero { padding: 24px 20px; } .record-team-grid { grid-template-columns: minmax(0, 1fr); } .record-section-title h2 { font-size: 18px; } }
</style>
