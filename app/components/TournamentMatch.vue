<script setup lang="ts">
import type { Match, Team } from '~/utils/tournament'
import { players } from '~/data/players'
import { formatRole } from '~/utils/players'

const props = withDefaults(defineProps<{
  match: Match
  teams: Team[]
  ready: boolean
  label: string
  sourceLabels: string[]
  readonly?: boolean
  winnerDestination?: string
  winnerTarget?: string
  loserDestination?: string
  loserTarget?: string
}>(), { readonly: false })
const emit = defineEmits<{ select: [teamId: string]; navigate: [matchId: string] }>()
const canChoose = computed(() => !props.readonly && props.ready && (props.match.status === 'ready' || props.match.status === 'complete'))
const status = computed(() => ({
  ready: 'Можно играть',
  waiting: 'Ждём соперника',
  bye: 'Без игры',
  complete: 'Завершён',
})[props.match.status])

function teamName(id: string) {
  return props.teams.find(team => team.id === id)?.name ?? ''
}

function teamSeed(id: string) {
  return String(props.teams.findIndex(team => team.id === id) + 1).padStart(2, '0')
}

function buttonLabel(id: string) {
  if (props.readonly) return `${teamName(id)}${props.match.winnerId === id ? ': победитель' : ''}`
  if (props.match.status === 'bye') return `${teamName(id)}: автоматический проход`
  if (props.match.status === 'waiting') return `${teamName(id)}: ждём соперника`
  return `${teamName(id)}: ${props.match.winnerId === id ? 'победитель, нажать для отмены' : 'выбрать победителем'}`
}
function roster(id: string | null) {
  return (props.teams.find(team => team.id === id)?.playerIds ?? []).map(playerId => players.find(player => player.id === playerId)).filter(player => Boolean(player))
}
function select(id: string) { if (canChoose.value) emit('select', id) }
</script>

<template>
  <article
    class="tournament-match" :class="[`match-${match.status}`, `match-${match.bracket}`]"
    :aria-label="`${match.status === 'bye' ? 'Автоматический проход' : 'Матч'} ${label}`"
  >
    <div class="match-topline">
      <span>{{ match.status === 'bye' ? 'ПРОХОД' : 'МАТЧ' }} {{ label }}</span>
      <span class="match-status">{{ status }}</span>
    </div>
    <div class="match-teams">
      <template v-for="(id, index) in match.teamIds" :key="`${match.id}-${index}`">
        <component
          :is="readonly ? 'div' : 'button'" v-if="id" :type="readonly ? undefined : 'button'" class="match-team"
          :class="{ winner: match.winnerId === id, loser: Boolean(match.winnerId && match.winnerId !== id) }"
          :disabled="readonly ? undefined : !canChoose" :aria-pressed="readonly ? undefined : match.winnerId === id"
          :aria-label="buttonLabel(id)" :title="teamName(id)"
          @click="select(id)"
        >
          <span class="team-seed">{{ teamSeed(id) }}</span>
          <span class="match-team-copy"><strong>{{ teamName(id) }}</strong><small>{{ sourceLabels[index] }}</small></span>
          <AppIcon v-if="match.winnerId === id" name="check" :size="16" />
          <span v-else class="team-pick-dot" />
        </component>
        <div v-else class="match-placeholder"><span class="empty-seed">—</span><span>{{ sourceLabels[index] }}</span></div>
      </template>
    </div>
    <div v-if="winnerDestination || loserDestination" class="match-destinations">
      <div v-if="winnerDestination" class="winner-destination"><AppIcon name="check" :size="13" /><span>Победитель</span><a v-if="winnerTarget" :href="`#tournament-match-${winnerTarget}`" @click.prevent="emit('navigate', winnerTarget)">{{ winnerDestination }} <AppIcon name="arrow-right" :size="12" /></a><strong v-else>{{ winnerDestination }}</strong></div>
      <div v-if="loserDestination"><AppIcon name="arrow-right" :size="13" /><span>{{ match.status === 'bye' ? 'Проход' : 'Проигравший' }}</span><a v-if="loserTarget" :href="`#tournament-match-${loserTarget}`" @click.prevent="emit('navigate', loserTarget)">{{ loserDestination }} <AppIcon name="arrow-right" :size="12" /></a><strong v-else>{{ loserDestination }}</strong></div>
    </div>
    <details v-if="match.teamIds.some(Boolean)" class="match-rosters"><summary><AppIcon name="users" :size="13" /> Составы команд <AppIcon name="chevron-down" :size="13" /></summary><div v-for="id in match.teamIds.filter((item): item is string => Boolean(item))" :key="id"><h4>{{ teamName(id) }} <span>{{ roster(id).length }} / 5</span></h4><ul v-if="roster(id).length"><li v-for="player in roster(id)" :key="player!.id"><span :title="formatRole(player!.role)">{{ player!.role }}</span>{{ player!.nickname }}</li></ul><p v-else>Состав ещё не указан</p></div></details>
  </article>
</template>

<style scoped>
.tournament-match {
  min-height: 176px;
  padding: 13px;
  border: 1px solid #ffffff10;
  border-radius: 9px;
  background: #191a20;
}
.match-topline { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 15px; margin-bottom: 12px; }
.match-topline > span:first-child { color: #8b7c9a; font-size: 8px; letter-spacing: .6px; }
.match-status { color: #82728d; font-size: 8px; }
.match-ready .match-status { color: #b9a1d8; }
.match-complete { border-color: #c4e58b25; }
.match-complete .match-status { color: #9db57c; }
.match-teams { display: flex; flex-direction: column; gap: 6px; }
.match-team, .match-placeholder { display: flex; align-items: center; gap: 9px; width: 100%; min-width: 0; min-height: 54px; padding: 8px 10px; border: 1px solid transparent; border-radius: 5px; text-align: left; }
.match-team { background: #ffffff03; transition: background .2s, border-color .2s; }
button.match-team:not(:disabled):hover { border-color: #aa8aff55; background: #aa8aff0c; }
.match-team:disabled { opacity: 1; cursor: default; }
.match-team.winner { border-color: #c7e68a23; background: #c7e68a0b; }
.match-team.winner .match-team-copy strong, .match-team.winner > svg { color: #c9e49a; }
.match-team.loser .match-team-copy strong { color: #76687e; }
.team-seed, .empty-seed { flex-shrink: 0; width: 19px; color: #817089; font-size: 9px; font-variant-numeric: tabular-nums; }
.match-team-copy { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; }
.match-team-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #c3b7d0; font-size: 11px; font-weight: 600; line-height: 1.5; }
.match-team-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #766780; font-size: 8px; line-height: 1.4; }
.team-pick-dot { width: 11px; height: 11px; flex-shrink: 0; margin-left: auto; border: 1px solid #50465c; border-radius: 50%; }
button.match-team:not(:disabled):hover .team-pick-dot { border-color: #b596ec; }
.match-placeholder { border-color: #ffffff04; color: #867090; background: #ffffff01; font-size: 10px; line-height: 1.6; }
.match-bye { border-style: dashed; background: #171a1c; }
.match-bye .match-status { color: #91a575; }
.match-bye .match-placeholder { color: #788768; }
.match-lower { border-color: #c491661e; background: #1d1b1c; }
.match-lower .match-topline > span:first-child { color: #ac8c76; }
.match-lower.match-ready .match-status { color: #caac95; }
.match-lower.match-complete { border-color: #d6a07335; }
.match-lower.match-complete .match-status { color: #c7a280; }
.match-lower .match-team.winner { border-color: #d6a07329; background: #d6a0730b; }
.match-lower .match-team.winner .match-team-copy strong, .match-lower .match-team.winner > svg { color: #e0b892; }
.match-lower button.match-team:not(:disabled):hover { border-color: #d6a07355; background: #d6a0730c; }
.match-lower .match-team-copy small { color: #8d7667; }
.match-lower .match-placeholder { color: #9b7e69; }
.match-final { background: #1c201c; border-color: #c7e68a29; }
.match-final .match-topline > span:first-child { color: #b5c496; }
.tournament-match:focus-visible { outline: 2px solid #b18cde; outline-offset: 4px; }
.match-group { border-color: #8fb6dd25; background: #181d23; }
.match-group .match-topline > span:first-child { color: #9bb5d0; }
.match-destinations { display: grid; gap: 2px; margin-top: 13px; padding-top: 9px; border-top: 1px solid #ffffff0a; }
.match-destinations > div { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; min-height: 39px; color: #9f826d; font-size: 8px; line-height: 1.7; }
.match-destinations > div > span { min-width: 58px; }
.match-destinations > div > a { display: inline-flex; align-items: center; gap: 5px; min-height: 40px; color: #c8aa8b; font-weight: 600; }
.match-destinations > div > a:hover { color: #edd0af; text-decoration: underline; text-underline-offset: 3px; }
.match-destinations > div > strong { font-size: 8px; font-weight: 500; color: #9b8577; }
.match-destinations > .winner-destination { color: #93a17a; }.match-destinations > .winner-destination > a,.match-destinations > .winner-destination > strong { color: #b5c99a; }
.match-rosters { margin-top: 8px; border-top: 1px solid #ffffff08; }
.match-rosters summary { display: flex; align-items: center; gap: 6px; min-height: 40px; color: #a18bac; font-size: 9px; cursor: pointer; list-style: none; }.match-rosters summary::-webkit-details-marker { display: none; }.match-rosters summary > svg:last-child { margin-left: auto; }
.match-rosters > div { padding: 11px 0; border-top: 1px solid #ffffff06; }.match-rosters h4 { margin: 0; color: #bba4c5; font-size: 10px; font-weight: 650; overflow-wrap: anywhere; }.match-rosters h4 > span { margin-left: 5px; color: #816b8b; font-size: 8px; white-space: nowrap; }
.match-rosters ul { display: grid; gap: 8px; margin: 11px 0 0; padding: 0; list-style: none; }.match-rosters li { display: flex; align-items: center; gap: 7px; color: #a58eb0; font-size: 10px; overflow-wrap: anywhere; }.match-rosters li > span { display: grid; place-items: center; flex-shrink: 0; width: 19px; height: 20px; border: 1px solid #ad8bff20; border-radius: 4px; font-size: 9px; }.match-rosters p { margin-top: 9px; color: #7d6688; font-size: 9px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; }
}
</style>
