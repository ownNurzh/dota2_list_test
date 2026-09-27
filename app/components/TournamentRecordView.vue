<script setup lang="ts">
import { players } from '~/data/players'
import { formatTournamentDate, type TournamentArchiveEntry } from '~/utils/tournament-history'

defineProps<{ entry: TournamentArchiveEntry }>()
const playersById = new Map(players.map(player => [player.id, player]))
</script>

<template>
  <article class="record-view" :aria-label="`${entry.champion.name}, ${formatTournamentDate(entry.date)}`">
    <div class="record-date"><time :datetime="entry.date">{{ formatTournamentDate(entry.date) }}</time><slot name="actions" /></div>
    <div class="record-winner"><AppIcon name="trophy" :size="19" /><h2>{{ entry.champion.name }}</h2></div>
    <div class="record-roster">
      <span class="record-label">Игроки команды</span>
      <ul v-if="entry.champion.playerIds.length">
        <li v-for="id in entry.champion.playerIds" :key="id">
          <NuxtLink v-if="playersById.get(id)" :to="`/players/${id}`">{{ playersById.get(id)!.nickname }}</NuxtLink>
          <span v-else>{{ id }}</span>
        </li>
      </ul>
      <p v-else class="record-missing">Состав не указан</p>
    </div>
  </article>
</template>

<style scoped>
.record-view { display: grid; grid-template-columns: 190px minmax(150px, .75fr) minmax(0, 1.4fr); align-items: start; gap: 24px; min-width: 0; padding: 22px 24px; }
.record-date { display: flex; align-items: flex-start; flex-direction: column; gap: 0; min-width: 0; }
.record-date time { display: block; padding-block: 12px; color: #b4a9bf; font-size: 12px; line-height: 1.7; }
.record-winner { display: flex; align-items: center; gap: 10px; min-width: 0; padding-block: 11px; color: var(--lime); }
.record-winner h2 { min-width: 0; font-size: 15px; font-weight: 750; line-height: 1.5; overflow-wrap: anywhere; }
.record-roster { min-width: 0; }
.record-label { display: none; }
.record-roster ul { display: flex; flex-wrap: wrap; gap: 4px 8px; margin: 0; padding: 0; list-style: none; }
.record-roster li { min-width: 0; max-width: 100%; }
.record-roster a, .record-roster li > span { display: inline-flex; align-items: center; min-height: 44px; max-width: 100%; padding: 8px 11px; border: 1px solid #aa8aff18; border-radius: 7px; background: #aa8aff06; color: #c5b5d7; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.record-roster a:hover { border-color: #aa8aff50; color: var(--lime); }
.record-missing { padding-block: 12px; color: #8c7d9a; font-size: 12px; line-height: 1.7; }
@media (max-width: 1000px) {
  .record-view { grid-template-columns: 160px minmax(120px, .75fr) minmax(0, 1.4fr); gap: 20px; padding-inline: 20px; }
}
@media (max-width: 700px) {
  .record-view { grid-template-columns: minmax(0, 1fr); gap: 13px; padding: 18px 20px 22px; }
  .record-date { flex-direction: row; justify-content: space-between; align-items: center; gap: 15px; }
  .record-date time { padding-block: 3px; font-size: 11px; }
  .record-winner { padding: 0; }
  .record-winner h2 { font-size: 18px; }
  .record-label { display: block; margin-bottom: 10px; color: #93839f; font-size: 10px; }
  .record-roster { margin-top: 6px; }
  .record-missing { padding: 0; }
}
</style>
