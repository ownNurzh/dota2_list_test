<script setup lang="ts">
import type { Match, TournamentFormat, TournamentSize } from '~/utils/tournament'

const {
  state,
  ready,
  storageAvailable,
  rounds,
  champion,
  totalMatches,
  hasResults,
  chooseWinner,
  rename,
  setRoster,
  archive,
  archiveError,
  archivedId,
  resize,
  changeFormat,
  shuffle,
  reset,
} = useTournament()

const teamCounts: TournamentSize[] = [4, 6, 8]
const modes: { value: TournamentFormat; name: string; description: string; icon: string }[] = [
  { value: 'single', name: 'Одиночное выбывание', description: 'В плей-офф: одно поражение — вылет.', icon: 'swords' },
  { value: 'double', name: 'Двойное выбывание', description: 'В плей-офф: после первого поражения — в нижнюю сетку.', icon: 'shield' },
]
type PendingAction = { type: 'resize'; size: TournamentSize }
  | { type: 'format'; format: TournamentFormat }
  | { type: 'shuffle' }
  | { type: 'reset' }
const pendingAction = ref<PendingAction | null>(null)
const announcement = ref('')
const setupOpen = ref(true)
const archiveDate = ref('')
onMounted(() => {
  setupOpen.value = !hasResults.value
  const today = new Date()
  archiveDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
})
const matchesById = computed(() => new Map(rounds.value.flatMap(round => round.matches).map(match => [match.id, match])))
const hasFinalReset = computed(() => matchesById.value.has('gf-reset'))
const expectedMatches = computed(() => state.value.format === 'double' && !champion.value && !hasFinalReset.value
  ? `${totalMatches.value}–${totalMatches.value + 1}`
  : String(totalMatches.value))
const pendingTitle = computed(() => {
  if (pendingAction.value?.type === 'resize') return `Перейти на ${pendingAction.value.size} ${pendingAction.value.size === 4 ? 'команды' : 'команд'}?`
  if (pendingAction.value?.type === 'format') return pendingAction.value.format === 'double' ? 'Добавить нижнюю сетку?' : 'Перейти на одиночное выбывание?'
  if (pendingAction.value?.type === 'shuffle') return 'Перемешать посев?'
  return 'Начать заново?'
})
const pendingDescription = computed(() => {
  if (pendingAction.value?.type === 'resize') return 'Текущая сетка будет заменена. Все выбранные победители сбросятся.'
  if (pendingAction.value?.type === 'format') return 'Результаты всех матчей сбросятся. Названия и порядок команд сохранятся.'
  if (pendingAction.value?.type === 'shuffle') return 'Команды получат новую случайную расстановку. Все выбранные победители сбросятся.'
  return 'Очистим результаты всех матчей. Названия и порядок команд останутся.'
})

function teamName(id: string | null) {
  return state.value.teams.find(team => team.id === id)?.name ?? ''
}

function matchReference(id: string) {
  if (id === 'gf-m0') return 'ГФ'
  if (id === 'gf-reset') return 'ГФ2'
  const parts = /^([rlg])(\d+)-m(\d+)$/.exec(id)
  return parts ? `${parts[1] === 'r' ? 'В' : parts[1] === 'l' ? 'Н' : 'Г'}${Number(parts[2]) + 1}.${Number(parts[3]) + 1}` : id
}

function canChoose(match: Match) {
  return ready.value && (match.status === 'ready' || match.status === 'complete')
}

function selectWinner(matchId: string, id: string | null) {
  const match = matchesById.value.get(matchId)
  if (!match || !canChoose(match)) return
  if (match.winnerId === id) return
  chooseWinner(match.id, id)
  announcement.value = id === null
    ? `Результат матча ${matchReference(match.id)} отменён. Зависимые результаты сброшены.`
    : `${teamName(id)} — победитель матча ${matchReference(match.id)}.`
}

function applyAction(action: PendingAction) {
  if (action.type === 'resize') {
    resize(action.size)
    announcement.value = `Готова сетка на ${action.size} команд.`
  } else if (action.type === 'format') {
    changeFormat(action.format)
    announcement.value = action.format === 'double' ? 'Двойное выбывание: верхняя и нижняя сетки готовы.' : 'Сетка одиночного выбывания готова.'
  } else if (action.type === 'shuffle') {
    shuffle()
    announcement.value = 'Посев перемешан. Новые пары готовы.'
  } else {
    reset()
    announcement.value = 'Результаты очищены. Можно начинать новый кубок.'
  }
  pendingAction.value = null
}

function requestAction(action: PendingAction) {
  if (!ready.value || (action.type === 'resize' && action.size === state.value.size)) return
  if (action.type === 'format' && action.format === state.value.format) return
  if (hasResults.value) pendingAction.value = action
  else applyAction(action)
}

function confirmAction() {
  if (pendingAction.value) applyAction(pendingAction.value)
}

useSeoMeta({
  title: 'Кубок своего лобби — DOTA қауым',
  description: 'Кубок нашего лобби: команды из своих игроков, круговой этап для шести команд и плей-офф. Одиночное или двойное выбывание, результаты и история турниров.',
})
</script>

<template>
  <div class="page-container tournament-page">
    <div class="tournament-page-links">
      <NuxtLink class="tournament-back" to="/"><AppIcon name="arrow-left" :size="15" /> Наши игроки</NuxtLink>
      <NuxtLink class="tournament-back" to="/tournaments/history"><AppIcon name="trophy" :size="15" /> История чемпионов</NuxtLink>
    </div>

    <section class="tournament-hero" aria-labelledby="tournament-heading">
      <div class="tournament-hero-copy">
        <span class="eyebrow"><AppIcon name="swords" :size="13" /> СВОИ ПРОТИВ СВОИХ</span>
        <h1 id="tournament-heading">Кубок <span>своего лобби.</span></h1>
        <p>Собери команды, выбери формат и отмечай победителей.</p>
        <div class="tournament-format-label"><span>5 × 5</span><span>BO1</span><span>{{ state.format === 'double' ? 'С нижней сеткой' : 'До первого поражения' }}</span><a href="#tournament-bracket">К матчам <AppIcon name="arrow-right" :size="14" /></a></div>
      </div>
      <div class="tournament-emblem" aria-hidden="true">
        <span class="emblem-orbit" />
        <span class="emblem-orbit emblem-orbit-outer" />
        <AppIcon name="trophy" :size="124" />
        <span class="emblem-caption">OUR LOBBY. OUR RULES.</span>
      </div>
    </section>

    <section class="tournament-setup panel" aria-labelledby="setup-heading">
      <div class="setup-topline">
        <div>
          <span class="eyebrow">{{ state.size }} КОМАНД · {{ expectedMatches }} МАТЧЕЙ</span>
          <h2 id="setup-heading">Настройки турнира</h2>
        </div>
        <div class="tournament-actions">
          <button type="button" class="tournament-action setup-toggle" :aria-expanded="setupOpen" aria-controls="tournament-settings" @click="setupOpen = !setupOpen"><AppIcon name="chevron-down" :size="16" /> {{ setupOpen ? 'Свернуть' : 'Настроить' }}</button>
        </div>
      </div>
      <div v-show="setupOpen" id="tournament-settings">
        <div class="tournament-actions setup-actions">
          <button type="button" class="tournament-action" :disabled="!ready" @click="requestAction({ type: 'shuffle' })">
            <AppIcon name="swords" :size="15" /> Перемешать посев
          </button>
          <button type="button" class="tournament-action" :disabled="!ready || !hasResults" @click="requestAction({ type: 'reset' })">
            <AppIcon name="reset" :size="15" /> Сбросить результаты
          </button>
        </div>

      <div class="mode-selector" role="group" aria-label="Тип турнира">
        <button
          v-for="mode in modes" :key="mode.value" type="button"
          :class="{ selected: state.format === mode.value, 'mode-double': mode.value === 'double' }"
          :aria-label="mode.name" :aria-pressed="state.format === mode.value" :disabled="!ready"
          @click="requestAction({ type: 'format', format: mode.value })"
        >
          <span class="mode-icon"><AppIcon :name="mode.icon" :size="20" /></span>
          <span class="mode-copy"><strong>{{ mode.name }}</strong><small>{{ mode.description }}</small></span>
          <span class="mode-indicator"><AppIcon v-if="state.format === mode.value" name="check" :size="14" /></span>
        </button>
      </div>
      <p class="mode-explanation">{{ state.layout === 'round-robin' ? 'Шесть команд: каждая сыграет пять матчей в группе. Затем лучшие четыре выходят в выбранный плей-офф.' : state.format === 'double' ? 'Каждой команде — минимум две настоящие игры. Автоматические проходы не считаются матчами.' : 'Короткий формат: одна победа ведёт дальше, одно поражение завершает участие.' }}</p>

      <div class="format-row">
        <div class="format-selector" role="group" aria-label="Количество команд">
          <button
            v-for="size in teamCounts" :key="size"
            type="button" :class="{ selected: state.size === size }"
            :aria-label="`${size} ${size === 4 ? 'команды' : 'команд'}`"
            :aria-pressed="state.size === size" :disabled="!ready"
            @click="requestAction({ type: 'resize', size })"
          ><strong>{{ size }}</strong><span>{{ size === 4 ? 'команды' : 'команд' }}</span></button>
        </div>
        <div class="format-summary" aria-live="polite">
          <span><AppIcon name="users" :size="16" /><strong>{{ state.size * 5 }}</strong> мест</span>
          <span class="summary-divider" />
          <span><AppIcon name="swords" :size="16" /><strong>{{ expectedMatches }}</strong> {{ totalMatches === 3 ? 'матча' : 'матчей' }}</span>
        </div>
      </div>

      <div v-if="pendingAction" class="tournament-confirm" role="alertdialog" aria-labelledby="confirm-heading" aria-describedby="confirm-description">
        <div><h3 id="confirm-heading">{{ pendingTitle }}</h3><p id="confirm-description">{{ pendingDescription }}</p></div>
        <div class="confirm-actions">
          <button type="button" class="button button-secondary" @click="pendingAction = null">Отмена</button>
          <button type="button" class="button button-primary" @click="confirmAction">Подтвердить</button>
        </div>
      </div>

      <TournamentTeamEditor :state="state" :ready="ready" @rename="rename" @set-roster="setRoster" />
      </div>
    </section>

    <TournamentBracket :state="state" :ready="ready" @select="selectWinner" />

    <section v-if="champion" class="champion-panel" aria-labelledby="champion-heading">
      <span class="champion-icon"><AppIcon name="trophy" :size="42" /></span>
      <div><span class="eyebrow">ЧЕМПИОН НАШЕГО ЛОББИ</span><h2 id="champion-heading">{{ champion.name }}</h2><p>GG, WP. Кубок у своих — теперь есть что вспомнить.</p></div>
      <AppIcon class="champion-sparkle" name="sparkles" :size="37" />
    </section>

    <section v-if="champion" class="archive-finish-panel" aria-labelledby="archive-finish-heading">
      <div><span class="eyebrow">ОСТАВИМ В ИСТОРИИ</span><h2 id="archive-finish-heading">Запомнить чемпиона</h2><p>Дата, команда {{ champion.name }} и её игроки. Запись сохранится в этом браузере.</p></div>
      <form v-if="!archivedId" class="archive-form" @submit.prevent="archive(archiveDate)">
        <label><span>Дата турнира</span><input v-model="archiveDate" type="date" required></label>
        <button type="submit" class="button button-primary" :disabled="!ready || !archiveDate"><AppIcon name="trophy" :size="17" /> Сохранить в историю</button>
      </form>
      <p v-if="archiveError" class="archive-error" role="alert">{{ archiveError }}</p>
      <NuxtLink v-if="archivedId" to="/tournaments/history" class="button archive-saved"><AppIcon name="check" :size="17" /> Чемпион сохранён. Открыть историю <AppIcon name="arrow-right" :size="16" /></NuxtLink>
    </section>

    <div class="tournament-storage-note" :class="{ 'storage-unavailable': !storageAvailable }">
      <AppIcon :name="storageAvailable ? 'check' : 'info'" :size="14" />
      <p>{{ storageAvailable ? 'Сетка сохраняется в этом браузере. На другом устройстве будет своя.' : 'Не удалось восстановить или сохранить сетку. Пока эта страница открыта, она доступна.' }}</p>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style scoped>
.tournament-page-links { display: flex; align-items: center; justify-content: space-between; gap: 13px; }
.archive-finish-panel { margin-top: 20px; padding: 27px; border: 1px solid #ad8bff24; border-radius: 12px; background: #ad8bff04; }
.archive-finish-panel .eyebrow { font-size: 7px; color: #9077a3; }
.archive-finish-panel h2 { margin-top: 9px; font-family: var(--font-heading); font-size: 18px; font-weight: 500; color: #c7aedc; }
.archive-finish-panel > div > p { margin-top: 13px; color: #9f85ac; font-size: 11px; line-height: 1.9; max-width: 650px; }
.archive-form { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 13px; margin-top: 20px; }
.archive-form label { display: flex; flex: 1; flex-direction: column; gap: 8px; min-width: 150px; }
.archive-form label > span { color: #a48ab2; font-size: 10px; }
.archive-form input { width: 100%; min-width: 0; min-height: 44px; padding: 10px 12px; border: 1px solid #ffffff17; border-radius: 6px; color: #d4bfe2; background: #131017; font-size: 12px; }
.archive-form .button { min-height: 44px; }
.archive-error { margin-top: 14px; color: #dcb39b; font-size: 11px; line-height: 1.8; }
.archive-saved { margin-top: 18px; color: #c6df9d; border: 1px solid #c7e68a30; background: #c7e68a07; font-size: 11px; }
@media(max-width:520px) { .tournament-page-links { gap: 10px; }.tournament-page-links .tournament-back { font-size: 9px; }.archive-finish-panel { padding: 21px 17px; }.archive-finish-panel h2 { font-size: 15px; }.archive-form { flex-direction: column; align-items: stretch; }.archive-form label { min-width: 0; }.archive-saved { width: 100%; font-size: 10px; } }
.tournament-page { min-width: 0; padding-top: 27px; padding-bottom: 18px; }
.tournament-back { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; margin-bottom: 15px; color: #93909f; font-size: 11px; }
.tournament-back:hover { color: #d0eb91; }
.tournament-hero { position: relative; isolation: isolate; overflow: hidden; padding: 35px 39px; border: 1px solid #ffffff10; border-radius: 16px; background: radial-gradient(ellipse at 85% 20%, #93885514, transparent 45%), linear-gradient(115deg, #23202e, #1b1c22); }
.tournament-hero-copy { position: relative; z-index: 1; max-width: 75%; }
.tournament-hero-copy > .eyebrow { color: #b2a4c9; font-size: 8px; }
.tournament-hero h1 { margin: 20px 0 17px; font-family: var(--font-heading); font-size: clamp(30px, 3.6vw, 48px); font-weight: 650; line-height: 1.3; letter-spacing: -.04em; }
.tournament-hero h1 span { color: #c4dca0; }
.tournament-hero-copy > p { color: #aba5b5; font-size: 11px; line-height: 1.95; }
.tournament-format-label { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 24px; }
.tournament-format-label span { padding: 5px 9px; border: 1px solid #ffffff12; border-radius: 4px; color: #a39aa9; background: #ffffff03; font-size: 8px; }
.tournament-format-label span:first-child { color: #d0eb91; border-color: #d0eb9129; }
.tournament-emblem { position: absolute; inset: 0 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 35px; width: 36%; color: #cbdba68f; transform: rotate(-6deg); }
.tournament-emblem > svg { filter: drop-shadow(0 0 28px #d0eb9115); }
.emblem-orbit { position: absolute; z-index: -1; width: 238px; height: 238px; border: 1px solid #cbdba60f; border-radius: 50%; }
.emblem-orbit-outer { width: 310px; height: 310px; border-style: dashed; }
.emblem-caption { color: #a2ac8c; font-size: 7px; letter-spacing: 2px; }
.tournament-setup { margin-top: 22px; padding: 27px; border-radius: 14px; }
.setup-topline { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.setup-topline .eyebrow { color: #81788e; font-size: 7px; }
.setup-topline h2 { margin-top: 8px; font-family: var(--font-heading); font-size: 20px; font-weight: 550; letter-spacing: -.04em; }
.tournament-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
.tournament-action { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 9px 12px; border: 1px solid #ffffff13; border-radius: 6px; color: #aaa0b6; font-size: 10px; transition: border-color .2s, color .2s; }
.tournament-action:hover:not(:disabled) { color: #d5c3ee; border-color: #af8fe94a; }
.mode-selector { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 28px; }
.mode-selector > button { display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 85px; padding: 17px; border: 1px solid #ffffff12; border-radius: 9px; background: #ffffff02; text-align: left; transition: background .2s, border-color .2s; }
.mode-selector > button:hover:not(:disabled) { border-color: #ad8bff55; }
.mode-selector > button.selected { border-color: #ad8bff66; background: #ad8bff0b; }
.mode-selector > button.mode-double.selected { border-color: #c7e68a4a; background: #c7e68a08; }
.mode-icon { display: grid; place-items: center; width: 39px; height: 39px; flex-shrink: 0; border: 1px solid #ffffff10; border-radius: 9px; color: #857690; }
.selected .mode-icon { color: #bda0ec; border-color: #ad8bff25; }
.mode-double.selected .mode-icon { color: #c9e49a; border-color: #c7e68a25; }
.mode-copy { display: flex; flex: 1; flex-direction: column; min-width: 0; gap: 7px; }
.mode-copy strong { color: #b7a9c3; font-size: 12px; font-weight: 650; line-height: 1.5; }
.mode-copy small { color: #86778f; font-size: 9px; line-height: 1.7; }
.selected .mode-copy strong { color: #dcc9f1; }
.mode-double.selected .mode-copy strong { color: #d6e5bd; }
.mode-indicator { display: grid; place-items: center; flex-shrink: 0; width: 18px; height: 18px; border: 1px solid #ffffff17; border-radius: 50%; color: #bda0ec; }
.selected .mode-indicator { border-color: currentColor; }
.mode-double.selected .mode-indicator { color: #c9e49a; }
.mode-explanation { margin-top: 12px; color: #91839c; font-size: 10px; line-height: 1.85; }
.format-row { display: flex; align-items: center; flex-wrap: wrap; gap: 26px; margin-top: 27px; }
.format-selector { display: flex; align-items: stretch; gap: 8px; }
.format-selector button { display: flex; align-items: baseline; gap: 7px; min-width: 102px; min-height: 49px; padding: 12px 17px; border: 1px solid #ffffff0f; border-radius: 7px; background: #ffffff02; color: #7e768c; transition: background .2s, border-color .2s; }
.format-selector button strong { font-family: var(--font-heading); font-size: 19px; font-weight: 500; }
.format-selector button span { font-size: 9px; }
.format-selector button.selected { background: #ad8bff13; border-color: #ad8bff55; color: #c6adf7; }
.format-selector button:hover:not(:disabled) { border-color: #ad8bff70; }
.format-summary { display: flex; align-items: center; gap: 17px; color: #79717f; font-size: 10px; }
.format-summary > span:not(.summary-divider) { display: flex; align-items: center; gap: 6px; }
.format-summary strong { color: #c4bbc9; font-weight: 650; }
.format-summary svg { margin-right: 3px; color: #93869f; }
.summary-divider { width: 1px; height: 16px; background: #ffffff10; }
.tournament-confirm { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 18px; margin-top: 22px; padding: 17px; border: 1px solid #ad8bff36; border-radius: 9px; background: #ad8bff09; }
.tournament-confirm h3 { color: #dccbeb; font-size: 12px; }
.tournament-confirm p { margin-top: 7px; color: #a396b3; font-size: 11px; line-height: 1.7; }
.confirm-actions { display: flex; gap: 8px; flex-shrink: 0; }
.confirm-actions .button { font-size: 10px; min-height: 40px; }
.team-editor[open] > summary > svg { transform: rotate(180deg); }
.tournament-progress { width: 135px; flex-shrink: 0; text-align: right; }
.tournament-progress > span { color: #7f758d; font-size: 10px; }
.tournament-progress strong { color: #d0eb91; font-weight: 650; }
.tournament-progress > div { height: 3px; margin-top: 9px; overflow: hidden; border-radius: 5px; background: #ffffff0b; }
.tournament-progress > div > span { display: block; height: 100%; border-radius: inherit; background: #d0eb91; transition: width .3s; }
.champion-panel { position: relative; display: flex; align-items: center; gap: 27px; overflow: hidden; margin-top: 27px; padding: 29px 32px; border: 1px solid #cce7942c; border-radius: 13px; background: radial-gradient(ellipse at 95% 0, #cce79414, transparent 65%), #1c211b; }
.champion-icon { display: grid; place-items: center; flex-shrink: 0; width: 79px; height: 79px; border: 1px solid #cce79422; border-radius: 18px; background: #cce79408; color: #d0eb91; }
.champion-panel > div { min-width: 0; }
.champion-panel .eyebrow { color: #a9bb88; font-size: 7px; }
.champion-panel h2 { margin-top: 11px; overflow-wrap: anywhere; font-family: var(--font-heading); font-size: 25px; font-weight: 550; letter-spacing: -.035em; color: #d8ecc1; }
.champion-panel p { margin-top: 12px; color: #91a17e; font-size: 11px; line-height: 1.8; }
.champion-sparkle { flex-shrink: 0; margin-left: auto; color: #b0c88455; }
.tournament-storage-note { display: flex; align-items: flex-start; justify-content: center; gap: 7px; margin-top: 29px; color: #736a7e; }
.tournament-storage-note svg { margin-top: 1px; }
.tournament-storage-note p { font-size: 9px; line-height: 1.8; }
.storage-unavailable { color: #c8ae86; }
@media (max-width: 1050px) {
  .tournament-hero { padding: 33px; }
  .tournament-hero-copy { max-width: 80%; }
  .tournament-emblem { width: 32%; opacity: .7; }
  .tournament-emblem > svg { width: 95px; }
  .emblem-orbit { width: 190px; height: 190px; }
  .emblem-orbit-outer { width: 250px; height: 250px; }
  .emblem-caption { font-size: 6px; }
  .setup-topline { align-items: flex-start; }
  .tournament-actions { justify-content: flex-end; max-width: 320px; }
  .tournament-action { font-size: 9px; }
  .mode-selector > button { padding: 14px; gap: 10px; }
  .mode-icon { width: 33px; height: 33px; }
  .mode-copy strong { font-size: 11px; }
}
@media (max-width: 940px) {
}
@media (max-width: 700px) {
  .tournament-hero { padding: 29px; }
  .tournament-hero-copy { max-width: 100%; }
  .tournament-hero h1 { font-size: 37px; }
  .tournament-hero-copy > p { max-width: 340px; }
  .tournament-emblem { right: -20px; width: 45%; opacity: .2; }
  .emblem-caption { display: none; }
  .tournament-setup { padding: 24px; }
  .setup-topline { flex-direction: column; gap: 20px; }
  .tournament-actions { justify-content: flex-start; max-width: none; }
  .format-row { gap: 20px; margin-top: 23px; }
  .mode-selector { grid-template-columns: minmax(0, 1fr); margin-top: 22px; gap: 9px; }
  .mode-selector > button { min-height: 76px; padding: 15px; }
  .mode-copy strong { font-size: 12px; }
  .setup-topline h2 { font-size: 19px; }
  .tournament-progress { width: 105px; }
  .champion-panel { gap: 20px; padding: 25px; }
  .champion-panel h2 { font-size: 21px; }
  .champion-icon { width: 60px; height: 60px; border-radius: 14px; }
  .champion-icon svg { width: 33px; }
  .champion-sparkle { display: none; }
}
@media (max-width: 520px) {
  .tournament-page { padding-top: 15px; }
  .tournament-back { margin-bottom: 10px; }
  .tournament-hero { padding: 26px 23px; border-radius: 12px; }
  .tournament-hero-copy > .eyebrow { font-size: 7px; letter-spacing: 1.2px; }
  .tournament-hero h1 { margin-top: 21px; font-size: clamp(26px, 7.9vw, 37px); }
  .tournament-hero-copy > p { font-size: 11px; }
  .tournament-desktop-break { display: none; }
  .tournament-format-label { margin-top: 23px; }
  .tournament-emblem { right: -49px; top: 21px; }
  .tournament-setup { padding: 22px 18px 14px; margin-top: 16px; border-radius: 12px; }
  .tournament-actions { width: 100%; gap: 8px; }
  .tournament-action { flex: 1; min-width: 0; padding: 10px 8px; font-size: 8px; gap: 6px; }
  .tournament-action svg { width: 13px; }
  .format-row { display: block; }
  .format-selector { gap: 7px; }
  .format-selector button { flex: 1; min-width: 0; justify-content: center; padding: 12px 7px; gap: 5px; }
  .format-selector button strong { font-size: 20px; }
  .format-selector button span { font-size: 8px; }
  .format-summary { margin-top: 21px; gap: 17px; font-size: 10px; }
  .mode-selector > button { gap: 10px; padding: 14px 11px; }
  .mode-copy strong { font-size: 10px; }
  .mode-copy small { font-size: 9px; }
  .mode-icon { width: 29px; height: 33px; }
  .mode-icon svg { width: 17px; }
  .mode-indicator { width: 16px; height: 16px; }
  .mode-explanation { font-size: 10px; }
  .tournament-confirm { padding: 15px; }
  .confirm-actions { width: 100%; }
  .confirm-actions .button { flex: 1; padding-inline: 10px; }
  .tournament-progress { width: 88px; }
  .tournament-progress > span { font-size: 9px; }
  .champion-panel { align-items: flex-start; gap: 15px; padding: 22px 18px; }
  .champion-icon { width: 43px; height: 43px; border-radius: 10px; }
  .champion-icon svg { width: 25px; }
  .champion-panel .eyebrow { font-size: 6px; letter-spacing: 1px; }
  .champion-panel h2 { font-size: 19px; line-height: 1.5; }
  .champion-panel p { font-size: 10px; }
  .tournament-storage-note { justify-content: flex-start; margin-top: 24px; }
}
@media (max-width: 360px) {
  .tournament-action { font-size: 7px; gap: 5px; }
}
.tournament-hero { padding-block: 28px; }
.tournament-hero h1 { font-size: clamp(25px, 3.3vw, 40px); }
.tournament-hero-copy > p { font-size: 13px; }
.tournament-format-label { align-items: center; margin-top: 18px; }
.tournament-format-label span { font-size: 10px; }
.tournament-format-label a { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 8px 12px; border-radius: 6px; color: #d0eb91; font-size: 12px; }
.tournament-emblem { width: 25%; gap: 18px; }
.tournament-emblem > svg { width: 86px; }
.setup-topline { flex-direction: row; align-items: center; }
.setup-topline .eyebrow { font-size: 9px; }
.setup-topline > .tournament-actions { width: auto; flex-shrink: 0; }
.setup-actions { margin-top: 20px; max-width: none; justify-content: flex-start; }
.tournament-action { min-height: 44px; font-size: 12px; }
.setup-toggle[aria-expanded=true] svg { transform: rotate(180deg); }
.mode-copy strong { font-size: 13px; }.mode-copy small { color: #aa9ab8; font-size: 11px; }
.mode-explanation { color: #a99bb4; font-size: 12px; }
.format-selector button span, .format-summary { font-size: 11px; }
.archive-finish-panel p { overflow-wrap: anywhere; }
.archive-form label { flex: 0 1 240px; }.archive-form input { font-size: 16px; }
.tournament-storage-note p { font-size: 11px; }
@media(max-width:700px) {
  .tournament-hero { padding: 22px; }.tournament-hero-copy { max-width: 100%; }.tournament-hero h1 { margin-block: 12px; }.tournament-emblem { opacity: .14; width: 38%; }
  .tournament-setup { padding: 20px 16px; }.setup-topline h2 { font-size: 16px; }.setup-topline .eyebrow { font-size: 8px; }
  .tournament-actions { gap: 8px; }.tournament-action { font-size: 11px; }.setup-actions .tournament-action { flex: 1 1 150px; }
  .mode-copy strong { font-size: 13px; }.mode-copy small { font-size: 11px; }.mode-explanation { font-size: 12px; }
  .tournament-page-links .tournament-back { font-size: 11px; }.archive-form label { flex: auto; }.archive-form .button { font-size: 12px; }
}
@media(max-width:380px) { .setup-topline { gap: 10px; }.setup-topline h2 { font-size: 14px; }.setup-topline .eyebrow { font-size: 7px; }.setup-toggle { padding-inline: 8px; }.tournament-page-links { gap: 5px; }.tournament-page-links .tournament-back { font-size: 10px; gap: 5px; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; }
}
</style>
