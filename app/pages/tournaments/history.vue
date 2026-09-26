<script setup lang="ts">
import { players } from '~/data/players'
import { getChampion } from '~/utils/tournament'
import { formatTournamentDate, tournamentFormatLabel } from '~/utils/tournament-history'

const route = useRoute()
const { entries, historyReady, historyError, remove, download } = useTournamentHistory()
const search = ref('')
const pendingRemoval = ref<string | null>(null)
const selectedId = computed(() => typeof route.query.id === 'string' ? route.query.id : '')
const selected = computed(() => entries.value.find(entry => entry.id === selectedId.value))
const playerNames = new Map(players.map(player => [player.id, `${player.nickname} ${player.fullName}`]))
const filteredEntries = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('ru')
  return entries.value.filter(entry => !query || [entry.title, entry.date, ...entry.state.teams.flatMap(team => [team.name, ...team.playerIds.map(id => playerNames.get(id) ?? '')])].join(' ').toLocaleLowerCase('ru').includes(query))
})

function confirmRemoval(id: string) {
  if (remove(id)) pendingRemoval.value = null
}

useSeoMeta({
  title: () => selected.value ? `${selected.value.title} — история лобби` : 'История турниров — DOTA қауым',
  description: 'Наши завершённые турниры Dota 2: чемпионы, составы команд из своего круга и все результаты матчей.',
})
</script>

<template>
  <div class="page-container history-page">
    <template v-if="selected">
      <div class="history-detail-actions">
        <NuxtLink class="history-back" to="/tournaments/history"><AppIcon name="arrow-left" :size="16" /> Вся история</NuxtLink>
        <button class="button button-secondary" type="button" @click="download(selected)"><AppIcon name="chevron-down" :size="16" /> Скачать JSON</button>
      </div>
      <p class="history-source-note">{{ selected.source === 'local' ? 'Сохранено в этом браузере. Эта запись пока доступна только на этом устройстве.' : 'Общая история лобби — запись доступна всем.' }}</p>
      <TournamentRecordView :entry="selected" />
    </template>
    <div v-else-if="selectedId" class="history-empty panel">
      <AppIcon name="trophy" :size="39" />
      <h1>{{ historyReady ? 'Турнир не найден' : 'Открываем турнир…' }}</h1>
      <p v-if="historyReady">Запись могла быть сохранена в другом браузере или удалена. Общие турниры доступны в истории сайта.</p>
      <NuxtLink to="/tournaments/history" class="button button-primary">Вся история</NuxtLink>
    </div>
    <template v-else>
      <header class="history-heading">
        <div><span class="eyebrow">ЕСТЬ ЧТО ВСПОМНИТЬ</span><h1 id="history-heading">История <span>наших кубков.</span></h1><p>Кто забрал трон, с кем играли и как дошли до финала.</p></div>
        <NuxtLink to="/tournament" class="button button-primary"><AppIcon name="swords" :size="17" /> К текущему турниру</NuxtLink>
      </header>
      <div class="history-toolbar">
        <label class="history-search"><AppIcon name="search" :size="17" /><input v-model="search" type="search" aria-label="Поиск в истории турниров" placeholder="Турнир, команда или игрок"></label>
        <span>{{ entries.length }} в истории</span>
      </div>
      <div v-if="filteredEntries.length" class="history-table-wrap panel">
        <table class="history-table">
          <caption class="sr-only">Завершённые турниры, даты, чемпионы и составы</caption>
          <thead><tr><th>Турнир / дата</th><th>Чемпион</th><th>Команды</th><th>История</th><th><span class="sr-only">Действия</span></th></tr></thead>
          <tbody>
            <tr v-for="entry in filteredEntries" :key="entry.id">
              <td data-label="Турнир"><NuxtLink :to="{ path: '/tournaments/history', query: { id: entry.id } }" class="history-cup-name">{{ entry.title }}</NuxtLink><time :datetime="entry.date">{{ formatTournamentDate(entry.date) }}</time><small>{{ tournamentFormatLabel(entry.state) }}</small></td>
              <td data-label="Чемпион" class="history-champion"><AppIcon name="trophy" :size="16" /><span>{{ getChampion(entry.state)?.name }}</span></td>
              <td data-label="Команды"><strong>{{ entry.state.size }}</strong><small>{{ entry.state.teams.reduce((count, team) => count + team.playerIds.length, 0) }} игроков в составах</small></td>
              <td data-label="История"><span class="history-source" :class="entry.source">{{ entry.source === 'published' ? 'Общая' : 'В браузере' }}</span></td>
              <td class="history-row-actions">
                <NuxtLink :to="{ path: '/tournaments/history', query: { id: entry.id } }" :aria-label="`Открыть ${entry.title}`">Открыть <AppIcon name="arrow-right" :size="14" /></NuxtLink>
                <button type="button" :aria-label="`Скачать ${entry.title}`" @click="download(entry)">Скачать JSON</button>
                <button v-if="entry.source === 'local'" type="button" class="history-delete" :aria-label="`Удалить ${entry.title} из браузера`" @click="pendingRemoval = entry.id">Удалить</button>
                <div v-if="pendingRemoval === entry.id" class="history-confirm" role="alert"><p>Удалить запись из этого браузера?</p><button type="button" @click="confirmRemoval(entry.id)">Да, удалить</button><button type="button" @click="pendingRemoval = null">Отмена</button></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="history-empty panel">
        <AppIcon name="trophy" :size="39" />
        <h2>{{ !historyReady ? 'Открываем историю…' : search ? 'Ничего не нашли' : 'Первый кубок ждёт своего чемпиона' }}</h2>
        <p v-if="historyReady">{{ search ? 'Попробуй другое название турнира, команды или ник игрока.' : 'После финала сохрани турнир в историю. Здесь останутся составы, результаты и путь к кубку.' }}</p>
        <NuxtLink v-if="historyReady && !search" to="/tournament" class="button button-primary">Открыть турнир</NuxtLink>
      </div>
      <p class="history-help"><AppIcon name="info" :size="15" /> Общая история видна всем. Записи «В браузере» хранятся на этом устройстве — скачай JSON, чтобы сохранить копию или добавить турнир в общую историю сайта.</p>
    </template>
    <p v-if="historyError" class="history-error" role="alert">{{ historyError }}</p>
  </div>
</template>

<style scoped>
.history-page { padding-block: 36px 30px; min-width: 0; }
.history-heading { display: flex; align-items: center; justify-content: space-between; gap: 25px; }
.history-heading .eyebrow { color: #aa93c7; font-size: 9px; }
.history-heading h1 { margin-top: 18px; font-family: var(--font-heading); font-size: clamp(25px, 3.8vw, 39px); font-weight: 550; line-height: 1.45; letter-spacing: -.04em; }
.history-heading h1 span { color: #d0eb91; }
.history-heading p { margin-top: 16px; font-size: 12px; line-height: 1.9; color: #a197ab; }
.history-heading > a { flex-shrink: 0; font-size: 11px; }
.history-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin: 32px 0 18px; }
.history-toolbar > span { flex-shrink: 0; color: #8b7b9a; font-size: 11px; }
.history-search { display: flex; align-items: center; gap: 11px; width: min(440px, 100%); padding: 0 15px; min-height: 47px; border: 1px solid #ffffff14; border-radius: 8px; background: #191a20; color: #917caa; }
.history-search input { width: 100%; min-width: 0; padding: 13px 0; border: 0; background: transparent; color: #dfd7e7; font-size: 12px; }
.history-table-wrap { border-radius: 12px; }
.history-table { width: 100%; border-collapse: collapse; text-align: left; }
.history-table th { padding: 17px 20px; color: #92809f; font-size: 9px; letter-spacing: .7px; font-weight: 600; border-bottom: 1px solid #ffffff0b; }
.history-table td { padding: 20px; font-size: 12px; vertical-align: top; border-bottom: 1px solid #ffffff09; }
.history-table tr:last-child td { border-bottom: 0; }
.history-table td:first-child { width: 32%; }
.history-cup-name { display: block; color: #ddc9f2; font-weight: 700; font-size: 14px; overflow-wrap: anywhere; }
.history-cup-name:hover { color: #d0eb91; }
.history-table time, .history-table small { display: block; margin-top: 7px; font-size: 10px; line-height: 1.7; color: #9b8aa8; }
.history-champion { color: #cce399; }
.history-champion > svg { margin-right: 7px; }
.history-champion > span { overflow-wrap: anywhere; }
.history-source { display: inline-flex; padding: 4px 7px; border: 1px solid #aa8aff25; border-radius: 4px; color: #b49ad1; font-size: 9px; white-space: nowrap; }
.history-source.published { color: #b6c996; border-color: #c7e68a24; }
.history-row-actions > a, .history-row-actions > button { display: flex; align-items: center; gap: 7px; min-height: 36px; padding: 0; color: #c2a4e3; font-size: 10px; text-align: left; }
.history-row-actions > button { color: #96869f; }
.history-row-actions > .history-delete { color: #b48e95; }
.history-confirm { min-width: 150px; margin-top: 7px; color: #ccabb2; font-size: 11px; line-height: 1.8; }
.history-confirm button { padding: 10px 12px 10px 0; font-size: 11px; text-decoration: underline; }
.history-empty { display: flex; align-items: center; flex-direction: column; padding: 58px 25px; border-radius: 13px; text-align: center; }
.history-empty > svg { margin-bottom: 22px; color: #b49bcc; }
.history-empty h1, .history-empty h2 { font-family: var(--font-heading); font-size: 21px; font-weight: 500; line-height: 1.6; }
.history-empty p { max-width: 490px; margin-top: 16px; color: #9f91aa; font-size: 12px; line-height: 1.9; }
.history-empty > a { margin-top: 26px; font-size: 12px; }
.history-help { display: flex; align-items: flex-start; gap: 8px; margin-top: 21px; color: #8e7f9c; font-size: 11px; line-height: 1.9; }
.history-help svg { margin-top: 3px; }
.history-error { margin-top: 20px; color: #d9ac98; font-size: 12px; line-height: 1.9; }
.history-detail-actions { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 14px; }
.history-back { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; color: #a997ba; font-size: 12px; }
.history-detail-actions > button { min-height: 44px; font-size: 11px; }
.history-source-note { margin-bottom: 20px; color: #94829f; font-size: 11px; line-height: 1.8; }
@media (max-width: 980px) { .history-heading { align-items: flex-start; flex-direction: column; } .history-table th, .history-table td { padding: 15px 12px; } }
@media (max-width: 700px) {
  .history-page { padding-top: 25px; }
  .history-heading h1 { font-size: 27px; }
  .history-toolbar { flex-wrap: wrap; }
  .history-search { width: 100%; }
  .history-table thead { display: none; }
  .history-table tbody, .history-table tr, .history-table td { display: block; }
  .history-table tr { padding: 14px 18px; border-bottom: 1px solid #ffffff12; }
  .history-table tr:last-child { border-bottom: 0; }
  .history-table td { width: 100% !important; padding: 10px 0; border: 0; }
  .history-table td[data-label]::before { display: block; content: attr(data-label); margin-bottom: 7px; font-size: 9px; color: #857291; }
  .history-table td.history-row-actions { display: flex; flex-wrap: wrap; gap: 6px 18px; }
  .history-row-actions > a, .history-row-actions > button { min-height: 44px; }
  .history-confirm { width: 100%; }
  .history-empty { padding: 39px 20px; }
  .history-empty h2 { font-size: 18px; }
}
</style>
