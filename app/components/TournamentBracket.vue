<script setup lang="ts">
import { buildBracket, getChampion, getStandings, getTournamentMatchCount, type Match, type MatchSource, type TournamentRound, type TournamentState } from '~/utils/tournament'

const props = withDefaults(defineProps<{ state: TournamentState; ready?: boolean; readonly?: boolean }>(), { ready: false, readonly: false })
const emit = defineEmits<{ select: [matchId: string, teamId: string | null] }>()
const rounds = computed(() => buildBracket(props.state))
const matches = computed(() => rounds.value.flatMap(round => round.matches))
const byId = computed(() => new Map(matches.value.map(match => [match.id, match])))
const champion = computed(() => getChampion(props.state))
const completed = computed(() => matches.value.filter(match => match.status === 'complete').length)
const total = computed(() => getTournamentMatchCount(props.state))
const standings = computed(() => getStandings(props.state))
const groupComplete = computed(() => matches.value.filter(match => match.bracket === 'group').every(match => match.status === 'complete'))
const groupPlayed = computed(() => matches.value.filter(match => match.bracket === 'group' && match.status === 'complete').length)
const hasReset = computed(() => byId.value.has('gf-reset'))
const nextMatch = computed(() => matches.value.find(match => match.status === 'ready'))
const groups = computed(() => [
  { id: 'group', title: 'Группа', icon: 'users', caption: 'Каждый играет с каждым. Лучшие четыре команды выходят в плей-офф.', rounds: rounds.value.filter(round => round.bracket === 'group') },
  { id: 'upper', title: props.state.format === 'double' ? 'Верхняя сетка' : 'Плей-офф', icon: 'shield', caption: props.state.format === 'double' ? 'Победа ведёт дальше. После первого поражения — в нижнюю сетку.' : 'Победа ведёт дальше. Проигравшая команда выбывает.', rounds: rounds.value.filter(round => round.bracket === 'upper') },
  { id: 'lower', title: 'Нижняя сетка', icon: 'reset', caption: 'Второй шанс: победитель идёт дальше, проигравший выбывает.', rounds: rounds.value.filter(round => round.bracket === 'lower') },
  { id: 'final', title: 'Гранд-финал', icon: 'trophy', caption: 'Победители верхней и нижней сеток разыгрывают кубок.', rounds: rounds.value.filter(round => round.bracket === 'final') },
].filter(group => group.rounds.length))
const selectedGroupId = ref('')
const selectedRoundId = ref('')
const view = ref<'round' | 'board'>('round')
const activeGroup = computed(() => groups.value.find(group => group.id === selectedGroupId.value)
  ?? groups.value.find(group => group.rounds.some(round => round.matches.some(match => match.status === 'ready')))
  ?? groups.value.at(-1)!)
const activeRound = computed(() => activeGroup.value.rounds.find(round => round.id === selectedRoundId.value)
  ?? activeGroup.value.rounds.find(round => round.matches.some(match => match.status === 'ready'))
  ?? activeGroup.value.rounds[0]!)
const activeRoundIndex = computed(() => activeGroup.value.rounds.findIndex(round => round.id === activeRound.value.id))
const visibleRounds = computed(() => view.value === 'board' ? activeGroup.value.rounds : [activeRound.value])
function resetNavigation() {
  selectedGroupId.value = ''
  selectedRoundId.value = ''
}
watch(() => `${props.state.size}-${props.state.format}-${props.state.layout}-${props.state.teams.map(team => team.id).join(',')}`, resetNavigation)
watch(() => Object.keys(props.state.results).length, (count, previous) => {
  if (previous > 0 && count === 0) resetNavigation()
})
function reference(id: string) {
  if (id === 'gf-m0') return 'ГФ'
  if (id === 'gf-reset') return 'ГФ2'
  const parts = /^([rlg])(\d+)-m(\d+)$/.exec(id)
  return parts ? `${parts[1] === 'r' ? 'В' : parts[1] === 'l' ? 'Н' : 'Г'}${Number(parts[2]) + 1}.${Number(parts[3]) + 1}` : id
}
function roundName(round: TournamentRound) {
  if (round.bracket === 'group') return `Тур ${Number(round.id.replace('group-', '')) + 1}`
  return round.name.replace('Нижняя сетка · ', '').replace('раунд', 'Раунд')
}
function progress(stageRounds: TournamentRound[]) {
  const stageMatches = stageRounds.flatMap(round => round.matches).filter(match => match.status !== 'bye')
  return `${stageMatches.filter(match => match.status === 'complete').length} / ${stageMatches.length}`
}
function teamName(id: string | null) { return props.state.teams.find(team => team.id === id)?.name ?? 'Ожидается команда' }
function sourceLabel(source: MatchSource) {
  if (source.type === 'standing') return `${source.position}-е место группы`
  if (source.type === 'seed') return source.seed > props.state.teams.length ? 'Свободный слот' : `Посев ${String(source.seed).padStart(2, '0')}`
  const feeder = byId.value.get(source.matchId)
  if (feeder?.status === 'bye' && (source.type === 'loser' || !feeder.winnerId)) return 'Свободный слот'
  return `${source.type === 'winner' ? 'Победитель' : 'Проигравший'} ${reference(source.matchId)}`
}
function destination(match: Match, outcome: 'winner' | 'loser') {
  if (match.bracket === 'group') return { label: outcome === 'winner' ? '+1 победа в таблицу' : '+1 поражение в таблицу' }
  if (match.status === 'bye' && outcome === 'loser') return { label: 'Без игры и поражения' }
  const target = matches.value.find(candidate => candidate.sources.some(source => source.type === outcome && source.matchId === match.id))
  if (target) return { label: `${reference(target.id)} · ${target.bracket === 'lower' ? 'нижняя сетка' : target.bracket === 'final' ? 'финал' : 'верхняя сетка'}`, targetId: target.id }
  if (match.id === 'gf-m0' && !champion.value) return { label: outcome === 'winner' ? 'Кубок или решающий ГФ2' : 'ГФ2 или выбывание' }
  return { label: outcome === 'winner' ? 'Забирает кубок' : 'Выбывает из турнира' }
}
function selectGroup(id: string) { selectedGroupId.value = id; selectedRoundId.value = '' }
function selectMatch(matchId: string, teamId: string | null) {
  // Keep the round visible when entering or undoing its last result.
  const round = rounds.value.find(round => round.matches.some(match => match.id === matchId))
  if (!round) return
  selectedGroupId.value = round.bracket
  selectedRoundId.value = round.id
  emit('select', matchId, teamId)
}
async function openMatch(id: string) {
  const round = rounds.value.find(round => round.matches.some(match => match.id === id))
  if (!round) return
  selectedGroupId.value = round.bracket
  selectedRoundId.value = round.id
  await nextTick()
  const element = document.getElementById(`tournament-match-${id}`)
  element?.scrollIntoView({ block: 'center', inline: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  element?.focus({ preventScroll: true })
}
</script>

<template>
  <section id="tournament-bracket" class="tournament-bracket" aria-labelledby="bracket-heading">
    <header class="bracket-heading">
      <div><span class="eyebrow">ОТ ПЕРВОГО МАТЧА ДО КУБКА</span><h2 id="bracket-heading">Турнирная сетка</h2></div>
      <div class="bracket-progress"><span><strong>{{ completed }}</strong> из {{ total }} матчей</span><div role="progressbar" aria-label="Завершённые матчи" :aria-valuenow="completed" :aria-valuemin="0" :aria-valuemax="total"><span :style="{ width: `${completed / total * 100}%` }" /></div></div>
    </header>
    <div class="bracket-toolbar">
      <p>{{ readonly ? 'Результаты турнира по этапам и раундам.' : 'Нажми на команду, которая выиграла матч.' }}</p>
      <button v-if="!readonly && nextMatch" type="button" class="next-match" @click="openMatch(nextMatch.id)"><AppIcon name="swords" :size="16" /> К доступному матчу <AppIcon name="arrow-right" :size="16" /></button>
      <span v-else-if="champion" class="finished-label"><AppIcon name="check" :size="16" /> Турнир завершён</span>
    </div>
    <nav class="stage-navigation" aria-label="Этапы турнира">
      <button v-for="group in groups" :id="`${group.id}-bracket-heading`" :key="group.id" type="button" :class="['stage-tab', { active: activeGroup.id === group.id }]" :aria-pressed="activeGroup.id === group.id" aria-controls="bracket-stage-panel" @click="selectGroup(group.id)">
        <AppIcon :name="group.icon" :size="18" /><span>{{ group.title }}</span><small>{{ progress(group.rounds) }}</small>
      </button>
    </nav>
    <section id="bracket-stage-panel" class="stage-panel" :class="`stage-${activeGroup.id}`" :aria-labelledby="`${activeGroup.id}-bracket-heading`">
      <div class="stage-description"><p>{{ activeGroup.caption }}</p><div class="bracket-view-switch" role="group" aria-label="Вид сетки"><button type="button" :aria-pressed="view === 'round'" @click="view = 'round'"><AppIcon name="list" :size="15" /> По раундам</button><button type="button" :aria-pressed="view === 'board'" @click="view = 'board'"><AppIcon name="grid" :size="15" /> Весь этап</button></div></div>
      <details v-if="activeGroup.id === 'group'" class="group-standings" open>
        <summary><span id="group-standings-heading"><AppIcon name="chart" :size="17" /> Таблица группы</span><span>{{ groupPlayed }} / 15 <AppIcon name="chevron-down" :size="16" /></span></summary>
        <div class="standings-table" role="table" aria-label="Таблица кругового этапа">
          <div class="standing-row standing-header" role="row"><span role="columnheader">#</span><span role="columnheader">Команда</span><span role="columnheader" aria-label="Сыграно" title="Сыграно">И</span><span role="columnheader" aria-label="Победы" title="Победы">В</span><span role="columnheader" aria-label="Поражения" title="Поражения">П</span></div>
          <div v-for="entry in standings" :key="entry.teamId" class="standing-row" :class="{ qualified: entry.rank <= 4 }" role="row"><span role="cell">{{ entry.rank }}</span><strong role="cell">{{ teamName(entry.teamId) }}<small v-if="groupComplete && entry.rank <= 4">В плей-офф</small></strong><span role="cell">{{ entry.played }}</span><span class="standing-wins" role="cell">{{ entry.wins }}</span><span role="cell">{{ entry.losses }}</span></div>
        </div>
        <p class="standings-note">{{ groupComplete ? 'Итоговые места.' : 'Пока места предварительные.' }} При равенстве побед выше команда с меньшим номером посева.</p>
      </details>
      <p v-if="state.layout === 'legacy-six-byes'" class="stage-note">Сохранена прежняя сетка с проходами без игры. Новый турнир на шесть команд начнётся с группы.</p>
      <p v-if="state.layout === 'round-robin' && !groupComplete && activeGroup.id !== 'group'" class="stage-note"><AppIcon name="info" :size="16" /> Плей-офф начнётся после всех 15 матчей группы.</p>
      <p v-if="activeGroup.id === 'final'" class="stage-note"><AppIcon name="info" :size="16" /><span>{{ champion ? 'Кубок разыгран. GG, WP!' : hasReset ? 'Команда снизу выиграла первый финал. Теперь у обеих по одному поражению — всё решит ГФ2.' : 'Если команда из нижней сетки выиграет, появится ещё один, решающий финал. Команде сверху достаточно одной победы.' }}</span></p>
      <div v-if="view === 'round' && activeGroup.rounds.length > 1" class="round-navigation" role="group" aria-label="Раунды этапа">
        <button v-for="round in activeGroup.rounds" :key="round.id" type="button" :aria-pressed="activeRound.id === round.id" @click="selectedRoundId = round.id"><span>{{ roundName(round) }}</span><small>{{ progress([round]) }}</small></button>
      </div>
      <p v-if="view === 'board' && activeGroup.rounds.length > 1" class="board-hint"><AppIcon name="arrow-right" :size="15" /> Раунды идут слева направо. Сетку можно прокручивать.</p>
      <div class="rounds-content" :class="{ 'board-view': view === 'board' }" :tabindex="view === 'board' ? 0 : undefined" :role="view === 'board' ? 'region' : undefined" :aria-label="view === 'board' ? 'Все раунды этапа, горизонтальная прокрутка' : undefined">
        <section v-for="round in visibleRounds" :key="round.id" class="round-column" :aria-labelledby="`round-heading-${round.id}`">
          <header class="round-heading"><h3 :id="`round-heading-${round.id}`">{{ roundName(round) }}</h3><span>{{ progress([round]) }}</span></header>
          <div class="round-matches">
            <TournamentMatch v-for="match in round.matches" :id="`tournament-match-${match.id}`" :key="match.id" tabindex="-1"
              :match="match" :teams="state.teams" :ready="ready" :readonly="readonly" :label="reference(match.id)" :source-labels="match.sources.map(sourceLabel)"
              :winner-destination="destination(match, 'winner').label" :winner-target="destination(match, 'winner').targetId"
              :loser-destination="destination(match, 'loser').label" :loser-target="destination(match, 'loser').targetId"
              @select="selectMatch(match.id, $event)" @navigate="openMatch" />
          </div>
        </section>
      </div>
      <div v-if="view === 'round' && activeGroup.rounds.length > 1" class="round-pagination"><button type="button" :disabled="activeRoundIndex === 0" @click="selectedRoundId = activeGroup.rounds[activeRoundIndex - 1]!.id"><AppIcon name="arrow-left" :size="16" /> Назад</button><span>{{ activeRoundIndex + 1 }} / {{ activeGroup.rounds.length }}</span><button type="button" :disabled="activeRoundIndex === activeGroup.rounds.length - 1" @click="selectedRoundId = activeGroup.rounds[activeRoundIndex + 1]!.id">Дальше <AppIcon name="arrow-right" :size="16" /></button></div>
    </section>
  </section>
</template>

<style scoped>
.tournament-bracket { min-width: 0; margin-top: 32px; scroll-margin-top: 24px; }
.bracket-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.bracket-heading .eyebrow { color: #9d90aa; font-size: 10px; }
.bracket-heading h2 { margin-top: 10px; font-family: var(--font-heading); font-size: clamp(19px, 2.5vw, 27px); font-weight: 550; letter-spacing: -.04em; }
.bracket-progress { width: 150px; flex-shrink: 0; color: #a79ab4; font-size: 12px; text-align: right; }
.bracket-progress strong { color: var(--lime); }
.bracket-progress > div { height: 5px; margin-top: 10px; overflow: hidden; border-radius: 5px; background: #ffffff0c; }
.bracket-progress > div > span { display: block; height: 100%; background: var(--lime); }
.bracket-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin: 16px 0 20px; }
.bracket-toolbar p { color: #a99cb5; font-size: 13px; line-height: 1.7; }
.next-match, .finished-label { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 44px; padding: 10px 14px; border: 1px solid #c7e68a30; border-radius: 8px; background: #c7e68a08; color: #d0e5ac; font-size: 12px; }
.next-match:hover { background: #c7e68a14; }
.stage-navigation { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.stage-tab { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 52px; padding: 12px 16px; border: 1px solid #ffffff10; border-radius: 9px; color: #a79ab4; background: #191a20; font-size: 12px; }
.stage-tab small { color: #90829c; font-size: 11px; white-space: nowrap; }
.stage-tab.active { border-color: #aa8aff70; background: #aa8aff12; color: #e1d3f7; }
.stage-tab.active small { color: #c4b0e4; }
.stage-panel { --stage-accent: #c1a6e4; min-width: 0; padding: 22px; border: 1px solid #aa8aff24; border-radius: 12px; background: #16151c; }
.stage-group { --stage-accent: #a4c9e8; }.stage-lower { --stage-accent: #dfb695; }.stage-final { --stage-accent: #d0e5ac; }
.stage-description { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.stage-description > p { max-width: 620px; color: #a99cb5; font-size: 13px; line-height: 1.8; }
.bracket-view-switch { display: flex; flex-shrink: 0; gap: 4px; padding: 4px; border: 1px solid #ffffff0e; border-radius: 9px; background: #101114; }
.bracket-view-switch button { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 9px 12px; border-radius: 6px; font-size: 12px; color: #95889f; }
.bracket-view-switch button[aria-pressed=true] { background: #2c2538; color: #dac7f0; }
.group-standings { margin-bottom: 22px; border: 1px solid #8fb6dd22; border-radius: 9px; background: #8fb6dd03; }
.group-standings summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; min-height: 52px; cursor: pointer; list-style: none; }
.group-standings summary::-webkit-details-marker { display: none; }
.group-standings summary > span { display: flex; align-items: center; gap: 9px; color: #bacfe2; font-size: 13px; }
.group-standings summary > span:last-child { color: #8ea5b8; font-size: 12px; }
.group-standings[open] summary > span:last-child svg { transform: rotate(180deg); }
.standings-table { margin: 0 16px; }
.standing-row { display: grid; grid-template-columns: 30px minmax(0, 1fr) repeat(3, 50px); align-items: center; gap: 10px; min-height: 42px; padding: 9px 12px; border-top: 1px solid #ffffff09; color: #9bafc0; font-size: 12px; }
.standing-row > span:not(:nth-child(2)) { text-align: center; }.standing-row > strong { min-width: 0; color: #ccd7e3; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.standing-row strong small { display: inline-block; margin-left: 9px; color: var(--lime); font-size: 10px; }.standing-header { color: #8ea5b8; font-size: 11px; }
.standing-row.qualified { border-left: 2px solid #c7e68a66; padding-left: 10px; }.standing-row .standing-wins { color: #c7e68a; }
.standings-note { margin: 12px 16px 16px; color: #94a5b7; font-size: 11px; line-height: 1.8; }
.stage-note { display: flex; align-items: flex-start; gap: 9px; margin: 0 0 20px; padding: 13px; background: #ffffff04; border-radius: 7px; font-size: 12px; color: var(--stage-accent); line-height: 1.8; }.stage-note svg { margin-top: 3px; }
.round-navigation { display: flex; gap: 8px; overflow-x: auto; padding: 4px 4px 10px; margin: -4px -4px 6px; scrollbar-width: thin; scrollbar-color: #5d486f transparent; }
.round-navigation button { display: flex; align-items: center; justify-content: center; flex: 1 0 auto; gap: 10px; min-height: 48px; padding: 10px 16px; border: 1px solid #ffffff12; border-radius: 7px; color: #a898b6; font-size: 12px; }
.round-navigation button small { color: #8d7c9e; font-size: 11px; white-space: nowrap; }.round-navigation button[aria-pressed=true] { border-color: #aa8aff60; background: #aa8aff0e; color: #e0cdf5; }
.rounds-content { min-width: 0; }.round-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 45px; margin-bottom: 10px; }.round-heading h3 { color: var(--stage-accent); font-size: 14px; font-weight: 650; }.round-heading > span { color: #93849f; font-size: 11px; white-space: nowrap; }
.round-matches { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; gap: 14px; }.round-matches > * { min-width: 0; scroll-margin: 20px; }
.board-hint { display: flex; align-items: center; gap: 7px; margin-bottom: 12px; color: #9584a4; font-size: 11px; line-height: 1.7; }
.board-view { display: flex; align-items: stretch; gap: 28px; overflow-x: auto; padding: 4px 4px 16px; margin: -4px; scroll-snap-type: x proximity; scrollbar-width: thin; scrollbar-color: #69527e #ffffff05; }
.board-view .round-column { position: relative; flex: 1 0 285px; max-width: 370px; min-width: 0; scroll-snap-align: start; }.board-view .round-column + .round-column::before { content: '→'; position: absolute; left: -22px; top: 14px; color: #8b729f; font-size: 14px; }
.board-view .round-matches { display: flex; flex-direction: column; justify-content: space-around; gap: 16px; min-height: calc(100% - 55px); }.board-view .round-matches > * { width: 100%; }.stage-group .board-view .round-matches { justify-content: flex-start; }
.round-pagination { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-top: 20px; padding-top: 14px; border-top: 1px solid #ffffff0b; }.round-pagination button { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 12px; border-radius: 6px; color: #c4acd7; font-size: 12px; }.round-pagination button:hover:not(:disabled) { background: #aa8aff0b; }.round-pagination > span { color: #9682a7; font-size: 11px; }
@media(max-width:1100px) { .stage-description { align-items: flex-start; flex-direction: column; gap: 14px; }.round-matches { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media(max-width:700px) {
  .tournament-bracket { margin-top: 26px; }.bracket-heading .eyebrow { font-size: 8px; letter-spacing: 1px; }.bracket-progress { width: 108px; font-size: 11px; }
  .stage-navigation { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }.stage-tab { min-width: 0; justify-content: flex-start; flex-wrap: wrap; gap: 7px; padding: 12px; }.stage-tab small { margin-left: auto; }
  .stage-panel { padding: 16px; }.stage-description { gap: 14px; }.bracket-view-switch { width: 100%; }.bracket-view-switch button { flex: 1; }.round-matches { grid-template-columns: minmax(0, 1fr); }.round-navigation button { flex: 0 0 auto; padding-inline: 14px; }.board-view .round-column { flex: 0 0 100%; max-width: none; }
  .standings-table { margin-inline: 10px; }.standing-row { grid-template-columns: 20px minmax(0, 1fr) repeat(3, 23px); gap: 6px; padding: 9px 6px; }.standing-row.qualified { padding-left: 4px; }.standing-row > strong { font-size: 12px; }.standing-row strong small { display: block; margin: 4px 0 0; }.group-standings summary { padding-inline: 12px; }.standings-note { margin-inline: 12px; }
}
@media(max-width:380px) { .bracket-heading { align-items: flex-start; }.bracket-heading .eyebrow { display: none; }.bracket-heading h2 { margin-top: 0; font-size: 17px; }.bracket-progress { width: 90px; }.stage-panel { padding: 12px; }.stage-tab { padding-inline: 9px; font-size: 11px; }.stage-tab > svg { width: 15px; }.stage-tab small { font-size: 10px; } }
</style>
