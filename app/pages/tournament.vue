<script setup lang="ts">
import type { Match, TournamentSize } from '~/utils/tournament'

const {
  state,
  ready,
  storageAvailable,
  rounds,
  champion,
  completedMatches,
  totalMatches,
  hasResults,
  chooseWinner,
  rename,
  resize,
  shuffle,
  reset,
} = useTournament()

const formats: TournamentSize[] = [4, 6, 8]
type PendingAction = { type: 'resize'; size: TournamentSize } | { type: 'shuffle' } | { type: 'reset' }
const pendingAction = ref<PendingAction | null>(null)
const announcement = ref('')
const progress = computed(() => completedMatches.value / totalMatches.value * 100)
const matchNumbers = computed(() => {
  const playable = rounds.value.flatMap(round => round.matches).filter(match => match.status !== 'bye')
  return Object.fromEntries(playable.map((match, index) => [match.id, String(index + 1).padStart(2, '0')]))
})
const pendingTitle = computed(() => {
  if (pendingAction.value?.type === 'resize') return `Перейти на ${pendingAction.value.size} ${pendingAction.value.size === 4 ? 'команды' : 'команд'}?`
  if (pendingAction.value?.type === 'shuffle') return 'Перемешать посев?'
  return 'Начать заново?'
})
const pendingDescription = computed(() => {
  if (pendingAction.value?.type === 'resize') return 'Текущая сетка будет заменена. Все выбранные победители сбросятся.'
  if (pendingAction.value?.type === 'shuffle') return 'Команды получат новую случайную расстановку. Все выбранные победители сбросятся.'
  return 'Очистим результаты всех матчей. Названия и порядок команд останутся.'
})

function teamName(id: string | null) {
  return state.value.teams.find(team => team.id === id)?.name ?? ''
}

function teamSeed(id: string) {
  return String(state.value.teams.findIndex(team => team.id === id) + 1).padStart(2, '0')
}

function slotLabel(match: Match, index: number) {
  if (match.status === 'bye') return 'Свободный слот'
  const feeder = rounds.value[match.roundIndex - 1]?.matches[match.matchIndex * 2 + index]
  return feeder ? `Победитель матча ${matchNumbers.value[feeder.id]}` : 'Команда не определена'
}

function statusLabel(match: Match) {
  return {
    ready: 'Можно играть',
    waiting: 'Ждём соперника',
    bye: 'Без игры',
    complete: 'Завершён',
  }[match.status]
}

function canChoose(match: Match) {
  return ready.value && (match.status === 'ready' || match.status === 'complete')
}

function selectWinner(match: Match, id: string) {
  if (!canChoose(match)) return
  const deselect = match.winnerId === id
  chooseWinner(match.id, deselect ? null : id)
  announcement.value = deselect
    ? `Результат матча ${matchNumbers.value[match.id]} отменён. Зависимые результаты сброшены.`
    : `${teamName(id)} — победитель матча ${matchNumbers.value[match.id]}.`
}

function applyAction(action: PendingAction) {
  if (action.type === 'resize') {
    resize(action.size)
    announcement.value = `Готова сетка на ${action.size} команд.`
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
  if (hasResults.value) pendingAction.value = action
  else applyAction(action)
}

function confirmAction() {
  if (pendingAction.value) applyAction(pendingAction.value)
}

function renameFromInput(id: string, event: Event) {
  const input = event.target as HTMLInputElement
  rename(id, input.value)
  input.value = teamName(id)
}

function blurOnEnter(event: KeyboardEvent) {
  (event.target as HTMLInputElement).blur()
}

useSeoMeta({
  title: 'Кубок своего лобби — DOTA қауым',
  description: 'Турнирная сетка для своих: 4, 6 или 8 команд по пять друзей, матчи до одной победы и свой чемпион лобби.',
})
</script>

<template>
  <div class="page-container tournament-page">
    <NuxtLink class="tournament-back" to="/">
      <AppIcon name="arrow-left" :size="15" /> Наши игроки
    </NuxtLink>

    <section class="tournament-hero" aria-labelledby="tournament-heading">
      <div class="tournament-hero-copy">
        <span class="eyebrow"><AppIcon name="swords" :size="13" /> СВОИ ПРОТИВ СВОИХ</span>
        <h1 id="tournament-heading">Кубок<br><span>своего лобби.</span></h1>
        <p>Собрались, разбились на пятёрки — и выясняем,<br class="tournament-desktop-break"> кто сегодня заберёт кубок. После катки всё равно свои.</p>
        <div class="tournament-format-label"><span>5 × 5</span><span>BO1</span><span>На выбывание</span></div>
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
          <span class="eyebrow">ПЕРЕД ПЕРВОЙ КАТКОЙ</span>
          <h2 id="setup-heading">Собираем сетку</h2>
        </div>
        <div class="tournament-actions">
          <button type="button" class="tournament-action" :disabled="!ready" @click="requestAction({ type: 'shuffle' })">
            <AppIcon name="swords" :size="15" /> Перемешать посев
          </button>
          <button type="button" class="tournament-action" :disabled="!ready || !hasResults" @click="requestAction({ type: 'reset' })">
            <AppIcon name="reset" :size="15" /> Сбросить результаты
          </button>
        </div>
      </div>

      <div class="format-row">
        <div class="format-selector" role="group" aria-label="Количество команд">
          <button
            v-for="size in formats" :key="size"
            type="button" :class="{ selected: state.size === size }"
            :aria-label="`${size} ${size === 4 ? 'команды' : 'команд'}`"
            :aria-pressed="state.size === size" :disabled="!ready"
            @click="requestAction({ type: 'resize', size })"
          ><strong>{{ size }}</strong><span>{{ size === 4 ? 'команды' : 'команд' }}</span></button>
        </div>
        <div class="format-summary" aria-live="polite">
          <span><AppIcon name="users" :size="16" /><strong>{{ state.size * 5 }}</strong> игроков</span>
          <span class="summary-divider" />
          <span><AppIcon name="swords" :size="16" /><strong>{{ totalMatches }}</strong> {{ totalMatches === 3 ? 'матча' : 'матчей' }}</span>
        </div>
      </div>

      <div v-if="pendingAction" class="tournament-confirm" role="alertdialog" aria-labelledby="confirm-heading" aria-describedby="confirm-description">
        <div><h3 id="confirm-heading">{{ pendingTitle }}</h3><p id="confirm-description">{{ pendingDescription }}</p></div>
        <div class="confirm-actions">
          <button type="button" class="button button-secondary" @click="pendingAction = null">Отмена</button>
          <button type="button" class="button button-primary" @click="confirmAction">Подтвердить</button>
        </div>
      </div>

      <details class="team-editor">
        <summary><span><AppIcon name="users" :size="16" /> Названия команд <small>{{ state.size }}</small></span><AppIcon name="chevron-down" :size="16" /></summary>
        <div class="team-inputs">
          <label v-for="(team, index) in state.teams" :key="`${state.size}-${team.id}`">
            <span>ПОСЕВ {{ String(index + 1).padStart(2, '0') }}</span>
            <input
              type="text" :value="team.name" :aria-label="`Название команды ${index + 1}`"
              maxlength="40" :disabled="!ready" autocomplete="off"
              @change="renameFromInput(team.id, $event)" @keydown.enter="blurOnEnter"
            >
          </label>
        </div>
      </details>
    </section>

    <section class="bracket-section" aria-labelledby="bracket-heading">
      <div class="bracket-heading">
        <div><span class="eyebrow">ДО ПОСЛЕДНЕГО ТРОНА</span><h2 id="bracket-heading">Путь к кубку</h2></div>
        <div class="tournament-progress">
          <span><strong>{{ completedMatches }}</strong> / {{ totalMatches }} матчей</span>
          <div role="progressbar" aria-label="Завершённые матчи" :aria-valuenow="completedMatches" :aria-valuemin="0" :aria-valuemax="totalMatches"><span :style="{ width: `${progress}%` }" /></div>
        </div>
      </div>
      <p class="bracket-instructions">После матча нажми на победителя — команда пройдёт дальше. Повторное нажатие отменяет выбор.</p>
      <div v-if="state.size === 6" class="bye-explanation">
        <AppIcon name="info" :size="15" />
        <p>Шесть команд: посевы №1 и №2 сразу в полуфинале. Остальные играют четвертьфинал.</p>
      </div>
      <p class="bracket-scroll-hint"><AppIcon name="arrow-right" :size="14" /> Листай сетку по горизонтали</p>

      <div class="bracket-scroller" tabindex="0" role="region" aria-label="Турнирная сетка, прокручивается по горизонтали">
        <div
          class="bracket-grid"
          :style="{ '--rounds': rounds.length, '--opening-matches': rounds[0]?.matches.length ?? 0 }"
        >
          <section v-for="(round, roundIndex) in rounds" :key="round.id" class="bracket-round" :aria-labelledby="`heading-${round.id}`">
            <div class="round-heading"><span>{{ String(roundIndex + 1).padStart(2, '0') }}</span><h3 :id="`heading-${round.id}`">{{ round.name }}</h3><small>BO1</small></div>
            <div class="round-matches">
              <article
                v-for="match in round.matches" :key="match.id"
                class="match-card" :class="[`match-${match.status}`, { 'has-feeders': roundIndex > 0 }]"
                :style="{ gridRow: `span ${2 ** roundIndex}`, '--feeder-height': `${168 * 2 ** (roundIndex - 1)}px` }"
                :aria-label="match.status === 'bye' ? 'Автоматический проход' : `Матч ${matchNumbers[match.id]}`"
              >
                <div class="match-topline">
                  <span>{{ match.status === 'bye' ? 'ПРЯМО В ПОЛУФИНАЛ' : `МАТЧ ${matchNumbers[match.id]}` }}</span>
                  <span class="match-status">{{ statusLabel(match) }}</span>
                </div>
                <div class="match-teams">
                  <template v-for="(id, index) in match.teamIds" :key="`${match.id}-${index}`">
                    <button
                      v-if="id" type="button" class="match-team"
                      :class="{ winner: match.winnerId === id, loser: Boolean(match.winnerId && match.winnerId !== id) }"
                      :disabled="!canChoose(match)" :aria-pressed="match.winnerId === id"
                      :aria-label="`${teamName(id)}: ${match.status === 'bye' ? 'автоматический проход' : match.winnerId === id ? 'победитель, нажать для отмены' : 'выбрать победителем'}`"
                      @click="selectWinner(match, id)"
                    ><span class="team-seed">{{ teamSeed(id) }}</span><span class="match-team-name">{{ teamName(id) }}</span><AppIcon v-if="match.winnerId === id" name="check" :size="16" /><span v-else class="team-pick-dot" /></button>
                    <div v-else class="match-placeholder"><span class="empty-seed">—</span><span>{{ slotLabel(match, index) }}</span></div>
                  </template>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>

      <p class="bracket-change-note"><AppIcon name="info" :size="14" /> При изменении победителя результаты следующих матчей в этой ветке сбрасываются.</p>
    </section>

    <section v-if="champion" class="champion-panel" aria-labelledby="champion-heading">
      <span class="champion-icon"><AppIcon name="trophy" :size="42" /></span>
      <div><span class="eyebrow">ЧЕМПИОН НАШЕГО ЛОББИ</span><h2 id="champion-heading">{{ champion.name }}</h2><p>GG, WP. Кубок у своих — теперь есть что вспомнить.</p></div>
      <AppIcon class="champion-sparkle" name="sparkles" :size="37" />
    </section>

    <div class="tournament-storage-note" :class="{ 'storage-unavailable': !storageAvailable }">
      <AppIcon :name="storageAvailable ? 'check' : 'info'" :size="14" />
      <p>{{ storageAvailable ? 'Сетка сохраняется в этом браузере. На другом устройстве будет своя.' : 'Не удалось восстановить или сохранить сетку. Пока эта страница открыта, она доступна.' }}</p>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style scoped>
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
.setup-topline .eyebrow, .bracket-heading .eyebrow { color: #81788e; font-size: 7px; }
.setup-topline h2, .bracket-heading h2 { margin-top: 8px; font-family: var(--font-heading); font-size: 20px; font-weight: 550; letter-spacing: -.04em; }
.tournament-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
.tournament-action { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 9px 12px; border: 1px solid #ffffff13; border-radius: 6px; color: #aaa0b6; font-size: 10px; transition: border-color .2s, color .2s; }
.tournament-action:hover:not(:disabled) { color: #d5c3ee; border-color: #af8fe94a; }
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
.team-editor { margin-top: 25px; border-top: 1px solid #ffffff0b; }
.team-editor > summary { display: flex; justify-content: space-between; align-items: center; gap: 10px; min-height: 47px; padding-top: 8px; cursor: pointer; color: #b7a7c8; list-style: none; font-size: 11px; }
.team-editor > summary::-webkit-details-marker { display: none; }
.team-editor > summary > span { display: inline-flex; align-items: center; gap: 8px; }
.team-editor > summary small { padding: 2px 6px; border-radius: 4px; border: 1px solid #ffffff12; color: #7b7088; font-size: 9px; }
.team-editor > summary > svg { transition: transform .2s; }
.team-editor[open] > summary > svg { transform: rotate(180deg); }
.team-inputs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 17px 14px; margin-top: 17px; }
.team-inputs label { display: flex; flex-direction: column; min-width: 0; gap: 8px; }
.team-inputs label > span { color: #796e87; font-size: 7px; letter-spacing: 1px; }
.team-inputs input { width: 100%; min-width: 0; min-height: 43px; padding: 10px 12px; border: 1px solid #ffffff11; border-radius: 6px; background: #111217; color: #d3cbdc; font-size: 11px; }
.team-inputs input:focus { border-color: #ad8bff70; }
.bracket-section { min-width: 0; margin-top: 39px; }
.bracket-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
.tournament-progress { width: 135px; flex-shrink: 0; text-align: right; }
.tournament-progress > span { color: #7f758d; font-size: 10px; }
.tournament-progress strong { color: #d0eb91; font-weight: 650; }
.tournament-progress > div { height: 3px; margin-top: 9px; overflow: hidden; border-radius: 5px; background: #ffffff0b; }
.tournament-progress > div > span { display: block; height: 100%; border-radius: inherit; background: #d0eb91; transition: width .3s; }
.bracket-instructions { margin-top: 16px; color: #92869f; font-size: 11px; line-height: 1.9; }
.bye-explanation { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; color: #9f8cbc; }
.bye-explanation svg { margin-top: 2px; }
.bye-explanation p { font-size: 10px; line-height: 1.9; }
.bracket-scroll-hint { display: none; align-items: center; gap: 7px; margin-top: 16px; color: #887398; font-size: 9px; }
.bracket-scroller { width: 100%; max-width: 100%; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: thin; scrollbar-color: #50405f #1c1822; margin-top: 29px; padding: 3px 2px 17px; border-radius: 8px; }
.bracket-scroller:focus-visible { outline: 2px solid #aa8aff; outline-offset: 5px; }
.bracket-grid { --round-gap: 36px; display: grid; grid-template-columns: repeat(var(--rounds), minmax(250px, 1fr)); gap: var(--round-gap); min-width: calc(var(--rounds) * 250px + (var(--rounds) - 1) * var(--round-gap)); }
.bracket-round { min-width: 0; }
.round-heading { display: flex; align-items: center; gap: 9px; min-height: 36px; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid #ffffff0c; }
.round-heading > span { color: #675972; font-size: 9px; }
.round-heading h3 { color: #c7b5d5; font-size: 12px; font-weight: 650; }
.round-heading small { margin-left: auto; color: #675873; font-size: 8px; }
.round-matches { display: grid; grid-template-rows: repeat(var(--opening-matches), 148px); gap: 20px; }
.match-card { position: relative; align-self: center; height: 148px; padding: 13px; border: 1px solid #ffffff10; border-radius: 9px; background: #191a20; }
.bracket-round:not(:last-child) .match-card:after { content: ''; position: absolute; right: -19px; top: 50%; width: 18px; height: 1px; background: #50425f; }
.match-card.has-feeders:before { content: ''; position: absolute; left: -19px; top: 50%; width: 18px; height: var(--feeder-height); transform: translateY(-50%); border-left: 1px solid #50425f; background: linear-gradient(#50425f, #50425f) center / 100% 1px no-repeat; }
.match-topline { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; min-height: 15px; }
.match-topline > span:first-child { color: #73677f; font-size: 7px; letter-spacing: .75px; }
.match-status { color: #776c84; font-size: 7px; }
.match-ready .match-status { color: #b9a1d8; }
.match-complete { border-color: #c4e58b25; }
.match-complete .match-status { color: #9db57c; }
.match-teams { display: flex; flex-direction: column; gap: 5px; }
.match-team, .match-placeholder { display: flex; align-items: center; gap: 9px; width: 100%; min-width: 0; min-height: 43px; padding: 8px 10px; border: 1px solid transparent; border-radius: 5px; text-align: left; }
.match-team { background: #ffffff03; transition: background .2s, border-color .2s; }
.match-team:not(:disabled):hover { border-color: #aa8aff55; background: #aa8aff0c; }
.match-team:disabled { opacity: 1; cursor: default; }
.match-team.winner { border-color: #c7e68a23; background: #c7e68a0b; }
.match-team.winner .match-team-name, .match-team.winner > svg { color: #c9e49a; }
.match-team.loser .match-team-name { color: #68616f; }
.team-seed, .empty-seed { flex-shrink: 0; width: 19px; color: #6a5f78; font-size: 9px; font-variant-numeric: tabular-nums; }
.match-team-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #c3b7d0; font-size: 11px; font-weight: 600; }
.team-pick-dot { width: 11px; height: 11px; flex-shrink: 0; margin-left: auto; border: 1px solid #50465c; border-radius: 50%; }
.match-team:not(:disabled):hover .team-pick-dot { border-color: #b596ec; }
.match-placeholder { border-color: #ffffff04; color: #62586e; background: #ffffff01; font-size: 9px; line-height: 1.6; }
.match-bye { border-style: dashed; background: #171a1c; }
.match-bye .match-status { color: #91a575; }
.match-bye .match-placeholder { color: #5b6452; }
.bracket-change-note { display: flex; align-items: flex-start; gap: 7px; margin-top: 12px; color: #70627e; font-size: 9px; line-height: 1.9; }
.bracket-change-note svg { margin-top: 2px; }
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
  .team-inputs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 940px) {
  .bracket-scroll-hint { display: flex; }
  .bracket-scroller { margin-top: 18px; }
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
  .team-inputs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .setup-topline h2, .bracket-heading h2 { font-size: 19px; }
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
  .tournament-confirm { padding: 15px; }
  .confirm-actions { width: 100%; }
  .confirm-actions .button { flex: 1; padding-inline: 10px; }
  .team-editor { margin-top: 20px; }
  .team-inputs { gap: 15px 10px; padding-bottom: 9px; }
  .team-inputs input { padding-inline: 10px; font-size: 11px; }
  .bracket-section { margin-top: 30px; }
  .bracket-heading { gap: 12px; }
  .bracket-heading h2 { font-size: 17px; }
  .bracket-heading .eyebrow { font-size: 6px; letter-spacing: 1px; }
  .tournament-progress { width: 88px; }
  .tournament-progress > span { font-size: 9px; }
  .bracket-instructions { font-size: 11px; }
  .bye-explanation p { font-size: 10px; }
  .bracket-grid { grid-template-columns: repeat(var(--rounds), 250px); }
  .bracket-change-note { font-size: 9px; }
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
  .bracket-heading h2 { font-size: 15px; }
  .team-inputs { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; }
}
</style>
