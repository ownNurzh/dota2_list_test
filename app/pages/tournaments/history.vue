<script setup lang="ts">
import { players } from '~/data/players'
import { formatTournamentDate } from '~/utils/tournament-history'

const { entries, historyReady, historyError, remove } = useTournamentHistory()
const search = ref('')
const pendingRemoval = ref<string | null>(null)
const playerNames = new Map(players.map(player => [player.id, `${player.nickname} ${player.fullName}`]))
const filteredEntries = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('ru')
  return entries.value.filter(entry => !query || [
    entry.date, formatTournamentDate(entry.date), entry.champion.name,
    ...entry.champion.playerIds.map(id => playerNames.get(id) ?? id),
  ].join(' ').toLocaleLowerCase('ru').includes(query))
})

function confirmRemoval(id: string) {
  if (remove(id)) pendingRemoval.value = null
}

useSeoMeta({
  title: 'История чемпионов — DOTA қауым',
  description: 'Победители наших турниров Dota 2: дата турнира, команда и её игроки.',
})
</script>

<template>
  <div class="page-container history-page">
    <header class="history-heading">
      <div><h1 id="history-heading">История <span>чемпионов.</span></h1><p>Дата турнира, команда-победитель и те, кто забрал кубок.</p></div>
      <NuxtLink to="/tournament" class="button button-secondary"><AppIcon name="swords" :size="17" /> К турниру</NuxtLink>
    </header>

    <div class="history-toolbar">
      <label class="history-search"><AppIcon name="search" :size="17" /><input v-model="search" type="search" aria-label="Поиск по дате, команде или игроку" placeholder="Дата, команда или игрок"></label>
      <span>{{ entries.length }} в истории</span>
    </div>

    <div v-if="filteredEntries.length" class="history-list panel">
      <div class="history-columns" aria-hidden="true"><span>Дата турнира</span><span>Победитель</span><span>Игроки команды</span></div>
      <div v-for="entry in filteredEntries" :key="entry.id" class="history-entry">
        <TournamentRecordView :entry="entry">
          <template v-if="entry.source === 'local'" #actions>
            <button class="history-remove" type="button" :aria-label="`Удалить победу ${entry.champion.name} от ${formatTournamentDate(entry.date)} из истории браузера`" @click="pendingRemoval = pendingRemoval === entry.id ? null : entry.id">Удалить</button>
          </template>
        </TournamentRecordView>
        <div v-if="pendingRemoval === entry.id" class="history-confirm" role="alert">
          <p>Удалить эту запись из истории браузера?</p>
          <button type="button" @click="confirmRemoval(entry.id)">Да, удалить</button>
          <button type="button" @click="pendingRemoval = null">Отмена</button>
        </div>
      </div>
    </div>
    <div v-else class="history-empty panel">
      <AppIcon name="trophy" :size="35" />
      <h2>{{ !historyReady ? 'Открываем историю…' : search ? 'Ничего не нашли' : 'Первый кубок ждёт своего чемпиона' }}</h2>
      <p v-if="historyReady">{{ search ? 'Попробуй другую дату, команду или ник игрока.' : 'После финала сохрани победителя — он появится здесь вместе со своим составом.' }}</p>
      <NuxtLink v-if="historyReady && !search" to="/tournament" class="button button-primary">Открыть турнир</NuxtLink>
    </div>
    <p v-if="entries.some(entry => entry.source === 'local')" class="history-note">Сохранённые тобой результаты доступны в этом браузере.</p>
    <p v-if="historyError" class="history-error" role="alert">{{ historyError }}</p>
  </div>
</template>

<style scoped>
.history-page { min-width: 0; padding-block: 36px 30px; }
.history-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.history-heading h1 { font-family: var(--font-heading); font-size: clamp(24px, 3.5vw, 36px); font-weight: 550; line-height: 1.5; letter-spacing: -.04em; }
.history-heading h1 span { color: var(--lime); }
.history-heading p { margin-top: 13px; color: #a197ab; font-size: 12px; line-height: 1.9; }
.history-heading > a { flex-shrink: 0; font-size: 11px; }
.history-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 30px 0 18px; }
.history-toolbar > span { flex-shrink: 0; color: #8b7b9a; font-size: 11px; }
.history-search { display: flex; align-items: center; gap: 11px; width: min(420px, 100%); min-height: 46px; padding-inline: 15px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: #917caa; }
.history-search input { width: 100%; min-width: 0; padding-block: 13px; border: 0; background: transparent; color: #dfd7e7; font-size: 12px; }
.history-list { min-width: 0; border-radius: 12px; }
.history-columns { display: grid; grid-template-columns: 190px minmax(150px, .75fr) minmax(0, 1.4fr); gap: 24px; padding: 17px 24px; border-bottom: 1px solid var(--border); color: #92809f; font-size: 10px; }
.history-entry + .history-entry { border-top: 1px solid var(--border); }
.history-remove { min-height: 44px; padding: 0; color: #a08c9b; font-size: 10px; }
.history-remove:hover { color: #e0b1bd; }
.history-confirm { display: flex; align-items: center; flex-wrap: wrap; gap: 0 20px; padding: 0 24px 15px; color: #c4a4b1; font-size: 11px; line-height: 1.8; }
.history-confirm button { min-height: 44px; padding: 6px 0; text-decoration: underline; }
.history-empty { display: flex; align-items: center; flex-direction: column; padding: 48px 24px; border-radius: 12px; text-align: center; }
.history-empty > svg { margin-bottom: 20px; color: #b49bcc; }
.history-empty h2 { font-family: var(--font-heading); font-size: 20px; font-weight: 500; line-height: 1.6; }
.history-empty p { max-width: 450px; margin-top: 14px; color: #9f91aa; font-size: 12px; line-height: 1.9; }
.history-empty > a { margin-top: 24px; font-size: 12px; }
.history-note, .history-error { margin-top: 18px; color: #8e7f9c; font-size: 11px; line-height: 1.9; }
.history-error { color: #d9ac98; }
@media (max-width: 1000px) {
  .history-heading { align-items: flex-start; flex-direction: column; gap: 18px; }
  .history-columns { grid-template-columns: 160px minmax(120px, .75fr) minmax(0, 1.4fr); gap: 20px; padding-inline: 20px; }
}
@media (max-width: 700px) {
  .history-page { padding-top: 26px; }
  .history-toolbar { flex-wrap: wrap; gap: 12px; margin-top: 24px; }
  .history-search { width: 100%; }
  .history-search input { font-size: 16px; }
  .history-columns { display: none; }
  .history-confirm { padding-inline: 20px; }
  .history-confirm p { width: 100%; }
  .history-empty { padding: 36px 20px; }
  .history-empty h2 { font-size: 18px; }
}
</style>
