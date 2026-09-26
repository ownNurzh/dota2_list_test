<script setup lang="ts">
import { buildBracket, getChampion, getStandings, getTournamentMatchCount, type Match, type MatchSource, type TournamentState } from '~/utils/tournament'

const props = withDefaults(defineProps<{ state: TournamentState; ready?: boolean; readonly?: boolean }>(), { ready: false, readonly: false })
const emit = defineEmits<{ select: [matchId: string, teamId: string] }>()
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
const allReady = computed(() => matches.value.filter(match => match.status === 'ready'))
const suggestedMatches = computed(() => {
  const groupRound = rounds.value.find(round => round.bracket === 'group' && round.matches.some(match => match.status === 'ready'))
  return groupRound ? groupRound.matches.filter(match => match.status === 'ready') : allReady.value
})
const groups = computed(() => [
  { id: 'group', title: 'Круговой этап', icon: 'users', caption: 'Пять туров. Каждая команда играет с каждой один раз.', rounds: rounds.value.filter(round => round.bracket === 'group') },
  { id: 'upper', title: props.state.format === 'double' ? 'Верхняя сетка' : 'Плей-офф', icon: 'shield', caption: props.state.format === 'double' ? 'Первое поражение переводит команду в нижнюю сетку.' : 'Победитель проходит дальше, проигравший выбывает.', rounds: rounds.value.filter(round => round.bracket === 'upper') },
  { id: 'lower', title: 'Нижняя сетка', icon: 'reset', caption: 'Здесь встречаются команды с одним поражением. Второе — вылет.', rounds: rounds.value.filter(round => round.bracket === 'lower') },
  { id: 'final', title: 'Гранд-финал', icon: 'trophy', caption: 'Победители верхней и нижней сеток разыгрывают кубок.', rounds: rounds.value.filter(round => round.bracket === 'final') },
].filter(group => group.rounds.length))

function reference(id: string) {
  if (id === 'gf-m0') return 'ГФ'
  if (id === 'gf-reset') return 'ГФ2'
  const parts = /^([rlg])(\d+)-m(\d+)$/.exec(id)
  return parts ? `${parts[1] === 'r' ? 'В' : parts[1] === 'l' ? 'Н' : 'Г'}${Number(parts[2]) + 1}.${Number(parts[3]) + 1}` : id
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
function roundOpen(roundId: string) {
  return groups.value.some(group => {
    const current = group.rounds.find(round => round.matches.some(match => match.status === 'ready')) ?? group.rounds[0]
    return current?.id === roundId
  })
}
function openMatch(id: string) {
  const element = document.getElementById(`tournament-match-${id}`)
  if (!element) return
  const stage = element.closest('details')
  if (stage) stage.open = true
  element.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  element.focus({ preventScroll: true })
}
</script>

<template>
  <section class="tournament-bracket" aria-labelledby="bracket-heading">
    <div class="bracket-heading"><div><span class="eyebrow">ДО ПОСЛЕДНЕГО ТРОНА</span><h2 id="bracket-heading">Путь к кубку</h2></div><div class="bracket-progress"><span><strong>{{ completed }}</strong> / {{ total }} матчей</span><div role="progressbar" aria-label="Завершённые матчи" :aria-valuenow="completed" :aria-valuemin="0" :aria-valuemax="total"><span :style="{ width: `${completed / total * 100}%` }" /></div></div></div>
    <p v-if="!readonly" class="bracket-intro">После матча выбери победителя. Повторное нажатие отменяет результат и зависимые матчи.</p>
    <div v-if="state.format === 'double'" class="bracket-legend"><span><i class="legend-upper" /> В плей-офф: первое поражение</span><AppIcon name="arrow-right" :size="14" /><span><i class="legend-lower" /> Нижняя сетка</span><AppIcon name="arrow-right" :size="14" /><span>Второе поражение — вылет</span></div>

    <section v-if="state.layout === 'round-robin'" class="group-standings" aria-labelledby="group-standings-heading">
      <div class="standings-heading"><div><span class="eyebrow">ВСЕ ИГРАЮТ СО ВСЕМИ</span><h3 id="group-standings-heading">Таблица группы</h3></div><span>{{ groupPlayed }} / 15 матчей</span></div>
      <p class="group-rule">Все шесть команд начинают с первого тура и сыграют по пять матчей. Четыре лучшие проходят в плей-офф после завершения всей группы.</p>
      <div class="standings-table" role="table" aria-label="Таблица кругового этапа"><div class="standing-row standing-header" role="row"><span role="columnheader">#</span><span role="columnheader">Команда</span><span role="columnheader" title="Сыграно">И</span><span role="columnheader" title="Победы">В</span><span role="columnheader" title="Поражения">П</span></div><div v-for="entry in standings" :key="entry.teamId" class="standing-row" :class="{ qualified: entry.rank <= 4, 'qualification-final': groupComplete }" role="row"><span role="cell">{{ entry.rank }}</span><strong role="cell">{{ teamName(entry.teamId) }}<small v-if="groupComplete && entry.rank <= 4">ПЛЕЙ-ОФФ</small></strong><span role="cell">{{ entry.played }}</span><span class="standing-wins" role="cell">{{ entry.wins }}</span><span role="cell">{{ entry.losses }}</span></div></div>
      <p class="standings-note"><AppIcon name="info" :size="14" /> Места определяются по победам. При равенстве выше команда с меньшим номером посева. До конца группы таблица предварительная.</p>
    </section>
    <div v-else-if="state.layout === 'legacy-six-byes'" class="legacy-note"><AppIcon name="info" :size="16" /><p>Восстановлена прежняя сетка на шесть команд с проходами без игры. При новом турнире шесть команд начнут с кругового этапа.</p></div>

    <section v-if="!readonly && suggestedMatches.length" class="ready-section" aria-labelledby="ready-matches-heading">
      <div class="ready-heading"><h3 id="ready-matches-heading"><AppIcon name="swords" :size="17" /> Можно играть</h3><span>{{ suggestedMatches[0]?.bracket === 'group' ? 'Ближайший незавершённый тур' : 'Оба соперника известны' }}</span></div>
      <div class="ready-list"><a v-for="match in suggestedMatches" :key="match.id" :href="`#tournament-match-${match.id}`" @click.prevent="openMatch(match.id)"><span class="ready-reference">{{ reference(match.id) }}</span><span class="ready-teams"><strong>{{ teamName(match.teamIds[0]) }}</strong><small>против</small><strong>{{ teamName(match.teamIds[1]) }}</strong></span><AppIcon name="arrow-right" :size="17" /></a></div>
    </section>

    <section v-for="group in groups" :key="group.id" class="bracket-group" :class="`bracket-group-${group.id}`" :aria-labelledby="`${group.id}-bracket-heading`">
      <div class="bracket-group-heading"><span class="bracket-group-icon"><AppIcon :name="group.icon" :size="21" /></span><div><h2 :id="`${group.id}-bracket-heading`">{{ group.title }}</h2><p>{{ group.caption }}</p></div></div>
      <div v-if="group.id === 'final'" class="final-rule"><AppIcon name="info" :size="16" /><p v-if="champion">Кубок разыгран {{ hasReset ? 'в решающем матче ГФ2' : 'в гранд-финале' }}. GG, WP!</p><p v-else-if="hasReset">Команда из нижней сетки выиграла первый финал. У обеих команд по одному поражению — всё решит ГФ2.</p><p v-else>У победителя верхней сетки ещё нет поражений. Если первый финал выиграет команда снизу, появится решающий матч ГФ2.</p></div>
      <p v-if="state.layout === 'round-robin' && !groupComplete && group.id === 'upper'" class="playoff-wait"><AppIcon name="info" :size="15" /> Пары плей-офф определятся после всех 15 матчей группы.</p>
      <details v-for="(round, index) in group.rounds" :key="round.id" class="bracket-stage" :open="roundOpen(round.id)">
        <summary><span class="stage-number">{{ String(index + 1).padStart(2, '0') }}</span><span class="stage-name">{{ round.name }}</span><span class="stage-count">{{ round.matches.filter(match => match.status === 'complete').length }} / {{ round.matches.filter(match => match.status !== 'bye').length }}</span><AppIcon name="chevron-down" :size="16" /></summary>
        <div class="stage-matches">
          <TournamentMatch
            v-for="match in round.matches" :id="`tournament-match-${match.id}`" :key="match.id" tabindex="-1"
            :match="match" :teams="state.teams" :ready="ready" :readonly="readonly" :label="reference(match.id)"
            :source-labels="match.sources.map(sourceLabel)"
            :winner-destination="destination(match, 'winner').label" :winner-target="destination(match, 'winner').targetId"
            :loser-destination="destination(match, 'loser').label" :loser-target="destination(match, 'loser').targetId"
            @select="emit('select', match.id, $event)" @navigate="openMatch"
          />
        </div>
      </details>
    </section>

    <p class="bracket-key"><AppIcon name="info" :size="14" /> Г — группа, В — верхняя сетка, Н — нижняя, ГФ — финал. Стрелки в карточках ведут к следующему матчу.</p>
  </section>
</template>

<style scoped>
.tournament-bracket { min-width: 0; margin-top: 37px; }
.bracket-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.bracket-heading .eyebrow { color: #82708e; font-size: 7px; }
.bracket-heading h2 { margin-top: 8px; font-family: var(--font-heading); font-size: 22px; font-weight: 550; letter-spacing: -.04em; }
.bracket-progress { width: 133px; flex-shrink: 0; text-align: right; }
.bracket-progress > span { color: #9784a5; font-size: 10px; }
.bracket-progress strong { color: #d0eb91; }
.bracket-progress > div { height: 3px; margin-top: 9px; overflow: hidden; border-radius: 5px; background: #ffffff0c; }
.bracket-progress > div > span { display: block; height: 100%; background: #c7e68a; }
.bracket-intro { margin-top: 16px; color: #a18aaa; font-size: 11px; line-height: 1.8; }
.bracket-legend { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 18px; padding: 14px 16px; border: 1px solid #ffffff0a; border-radius: 8px; background: #ffffff02; color: #a894b3; font-size: 10px; line-height: 1.6; }
.bracket-legend > span { display: inline-flex; align-items: center; gap: 6px; }
.bracket-legend i { width: 6px; height: 6px; border-radius: 50%; }
.legend-upper { background: #b39bd7; }.legend-lower { background: #d7a576; }
.group-standings { margin-top: 24px; padding: 24px; border: 1px solid #8fb6dd26; border-radius: 12px; background: #1a202805; }
.standings-heading { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
.standings-heading .eyebrow { color: #7e9bb6; font-size: 7px; }
.standings-heading h3 { margin-top: 8px; color: #c1d4e7; font-family: var(--font-heading); font-size: 17px; font-weight: 500; }
.standings-heading > span { color: #7c9ab7; font-size: 10px; white-space: nowrap; }
.group-rule { margin-top: 16px; color: #a0b1c1; font-size: 11px; line-height: 1.9; }
.standings-table { margin-top: 18px; overflow: hidden; border: 1px solid #ffffff0a; border-radius: 7px; }
.standing-row { display: grid; grid-template-columns: 30px minmax(0,1fr) repeat(3,45px); align-items: center; min-height: 47px; gap: 10px; padding: 9px 14px; border-top: 1px solid #ffffff08; color: #8499ad; font-size: 11px; }
.standing-row > span:not(:nth-child(2)) { text-align: center; }.standing-row > strong { min-width: 0; color: #c0cfde; font-size: 11px; font-weight: 600; overflow-wrap: anywhere; }
.standing-row strong small { display: inline-block; margin-left: 9px; color: #bddb91; font-size: 6px; letter-spacing: .8px; }
.standing-header { min-height: 36px; border-top: 0; color: #7190ac; font-size: 9px; background: #ffffff02; }
.standing-row .standing-wins { color: #b8d68f; }.standing-row.qualified { border-left: 2px solid #bcd69735; padding-left: 12px; }.standing-row.qualified.qualification-final { background: #bcd69705; }
.standings-note, .legacy-note, .bracket-key { display: flex; align-items: flex-start; gap: 7px; color: #7f8e9c; font-size: 10px; line-height: 1.8; }
.standings-note { margin-top: 15px; }.standings-note svg,.bracket-key svg { margin-top: 2px; }
.legacy-note { margin-top: 19px; padding: 14px; color: #b7a08b; background: #cf9c7407; border-radius: 7px; }
.ready-section { margin-top: 26px; }
.ready-heading { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 10px; }
.ready-heading h3 { display: flex; align-items: center; gap: 8px; color: #cce59c; font-size: 14px; }.ready-heading > span { color: #839367; font-size: 9px; }
.ready-list { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; margin-top: 14px; }
.ready-list a { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 90px; padding: 14px; border: 1px solid #c7e68a25; border-radius: 8px; background: #c7e68a06; }
.ready-list a:hover { border-color: #c7e68a70; background: #c7e68a0c; }.ready-list a > svg { margin-left: auto; color: #9daf80; }
.ready-reference { flex-shrink: 0; color: #9daf80; font-size: 9px; }.ready-teams { display: flex; flex: 1; flex-direction: column; min-width: 0; gap: 3px; }
.ready-teams strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #c8d7b4; font-size: 10px; }.ready-teams small { color: #758368; font-size: 8px; }
.bracket-group { margin-top: 27px; padding: 24px; border: 1px solid #ad8bff1b; border-radius: 12px; background: #ad8bff02; }
.bracket-group-heading { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 20px; }.bracket-group-icon { display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0; color: #b69adf; background: #ad8bff07; border: 1px solid #ad8bff25; border-radius: 9px; }
.bracket-group-heading h2 { color: #d1bde0; font-family: var(--font-heading); font-size: 17px; font-weight: 500; letter-spacing: -.03em; line-height: 1.5; }.bracket-group-heading p { margin-top: 7px; color: #947c9e; font-size: 11px; line-height: 1.8; }
.bracket-group-lower { border-color: #cf9c742b; background: #c9916604; }.bracket-group-lower .bracket-group-icon { color: #d1a580; border-color: #cf9c7430; background: #cf9c7408; }.bracket-group-lower .bracket-group-heading h2 { color: #d6b69b; }.bracket-group-lower .bracket-group-heading p { color: #a08775; }
.bracket-group-group { border-color: #8fb6dd20; }.bracket-group-group .bracket-group-icon { color: #8fb6dd; border-color: #8fb6dd25; }.bracket-group-group .bracket-group-heading h2 { color: #b3cbe2; }
.bracket-group-final { border-color: #c7e68a25; }.bracket-group-final .bracket-group-icon { color: #c3db95; border-color: #c7e68a26; }.bracket-group-final .bracket-group-heading h2 { color: #cbdcb0; }
.bracket-stage { margin-top: 11px; border: 1px solid #ffffff0b; border-radius: 8px; background: #10111428; }.bracket-stage > summary { display: flex; align-items: center; gap: 12px; min-height: 54px; padding: 12px 15px; cursor: pointer; list-style: none; }.bracket-stage > summary::-webkit-details-marker { display: none; }
.stage-number { color: #776282; font-size: 9px; }.stage-name { min-width: 0; flex: 1; color: #bba4c9; font-size: 12px; font-weight: 650; }.stage-count { color: #8e759e; font-size: 10px; white-space: nowrap; }.bracket-stage > summary > svg { color: #8e759e; transition: transform .2s; }.bracket-stage[open] > summary > svg { transform: rotate(180deg); }
.stage-matches { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); align-items: start; gap: 13px; padding: 0 13px 13px; }.stage-matches > * { min-width: 0; scroll-margin-top: 20px; }
.final-rule,.playoff-wait { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 18px; padding: 13px; border-radius: 7px; color: #a7b68f; background: #c7e68a06; font-size: 10px; line-height: 1.9; }.final-rule svg,.playoff-wait svg { margin-top: 2px; }.playoff-wait { color: #9e8caf; background: #ad8bff07; }
.historical-rosters { margin-top: 23px; border: 1px solid #ffffff10; border-radius: 10px; padding: 0 20px; }.historical-rosters > summary { display: flex; align-items: center; gap: 10px; min-height: 56px; list-style: none; cursor: pointer; color: #bda7ce; font-size: 12px; }.historical-rosters > summary > svg:last-child { margin-left: auto; }.historical-roster-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 18px; padding-bottom: 20px; }.historical-roster-grid h3 { color: #c5b3d0; font-size: 12px; }.historical-roster-grid small { color: #8a7398; font-size: 9px; margin-left: 6px; }.historical-roster-grid p { margin-top: 9px; color: #9c85a9; font-size: 11px; line-height: 1.9; overflow-wrap: anywhere; }
.bracket-key { margin-top: 19px; color: #8a7298; }
@media(max-width:1150px) { .stage-matches { grid-template-columns: repeat(2,minmax(0,1fr)); }.ready-list { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media(max-width:760px) { .bracket-group { padding: 20px 15px; }.stage-matches { grid-template-columns: minmax(0,1fr); padding: 0 10px 10px; }.historical-roster-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media(max-width:520px) { .tournament-bracket { margin-top: 28px; }.bracket-heading h2 { font-size: 18px; }.bracket-progress { width: 95px; }.bracket-progress > span { font-size: 9px; }.bracket-legend { padding: 12px; font-size: 9px; gap: 8px; }.group-standings { padding: 19px 13px; }.standings-heading h3 { font-size: 14px; }.standings-heading > span { font-size: 9px; }.standing-row { grid-template-columns: 19px minmax(0,1fr) repeat(3,22px); gap: 6px; padding: 9px 7px; font-size: 10px; }.standing-row.qualified { padding-left: 5px; }.standing-row > strong { font-size: 10px; }.standing-row strong small { display: block; margin: 4px 0 0; }.ready-list { grid-template-columns: minmax(0,1fr); }.ready-list a { min-height: 78px; }.bracket-group { padding: 19px 10px 12px; }.bracket-group-heading { gap: 9px; padding-inline: 3px; }.bracket-group-heading h2 { font-size: 14px; }.bracket-group-heading p { font-size: 10px; }.bracket-group-icon { width: 30px; height: 33px; border-radius: 7px; }.bracket-group-icon svg { width: 17px; }.bracket-stage > summary { padding-inline: 10px; gap: 8px; }.stage-name { font-size: 11px; }.stage-number { font-size: 8px; }.stage-count { font-size: 9px; }.stage-matches { padding-inline: 7px; }.historical-roster-grid { grid-template-columns: minmax(0,1fr); }.bracket-key { font-size: 9px; } }
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { transition: none !important; } }
</style>
