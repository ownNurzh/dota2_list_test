<script setup lang="ts">
import type { Match, Team } from '~/utils/tournament'

const props = defineProps<{
  match: Match
  teams: Team[]
  ready: boolean
  label: string
  sourceLabels: string[]
}>()
const emit = defineEmits<{ select: [teamId: string] }>()
const canChoose = computed(() => props.ready && (props.match.status === 'ready' || props.match.status === 'complete'))
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
  if (props.match.status === 'bye') return `${teamName(id)}: автоматический проход`
  if (props.match.status === 'waiting') return `${teamName(id)}: ждём соперника`
  return `${teamName(id)}: ${props.match.winnerId === id ? 'победитель, нажать для отмены' : 'выбрать победителем'}`
}
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
        <button
          v-if="id" type="button" class="match-team"
          :class="{ winner: match.winnerId === id, loser: Boolean(match.winnerId && match.winnerId !== id) }"
          :disabled="!canChoose" :aria-pressed="match.winnerId === id"
          :aria-label="buttonLabel(id)" :title="teamName(id)"
          @click="emit('select', id)"
        >
          <span class="team-seed">{{ teamSeed(id) }}</span>
          <span class="match-team-copy"><strong>{{ teamName(id) }}</strong><small>{{ sourceLabels[index] }}</small></span>
          <AppIcon v-if="match.winnerId === id" name="check" :size="16" />
          <span v-else class="team-pick-dot" />
        </button>
        <div v-else class="match-placeholder"><span class="empty-seed">—</span><span>{{ sourceLabels[index] }}</span></div>
      </template>
    </div>
  </article>
</template>

<style scoped>
.tournament-match {
  height: 176px;
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
.match-team:not(:disabled):hover { border-color: #aa8aff55; background: #aa8aff0c; }
.match-team:disabled { opacity: 1; cursor: default; }
.match-team.winner { border-color: #c7e68a23; background: #c7e68a0b; }
.match-team.winner .match-team-copy strong, .match-team.winner > svg { color: #c9e49a; }
.match-team.loser .match-team-copy strong { color: #76687e; }
.team-seed, .empty-seed { flex-shrink: 0; width: 19px; color: #817089; font-size: 9px; font-variant-numeric: tabular-nums; }
.match-team-copy { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; }
.match-team-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #c3b7d0; font-size: 11px; font-weight: 600; line-height: 1.5; }
.match-team-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #766780; font-size: 8px; line-height: 1.4; }
.team-pick-dot { width: 11px; height: 11px; flex-shrink: 0; margin-left: auto; border: 1px solid #50465c; border-radius: 50%; }
.match-team:not(:disabled):hover .team-pick-dot { border-color: #b596ec; }
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
.match-lower .match-team:not(:disabled):hover { border-color: #d6a07355; background: #d6a0730c; }
.match-lower .match-team-copy small { color: #8d7667; }
.match-lower .match-placeholder { color: #9b7e69; }
.match-final { background: #1c201c; border-color: #c7e68a29; }
.match-final .match-topline > span:first-child { color: #b5c496; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; }
}
</style>
