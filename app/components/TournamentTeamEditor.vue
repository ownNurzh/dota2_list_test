<script setup lang="ts">
import { players } from '~/data/players'
import { formatRole } from '~/utils/players'
import type { TournamentState } from '~/utils/tournament'

const props = defineProps<{ state: TournamentState; ready: boolean }>()
const emit = defineEmits<{
  rename: [teamId: string, name: string]
  setRoster: [teamId: string, playerIds: string[]]
}>()
const activeTeamId = ref<string | null>(null)
const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const picker = ref<HTMLElement | null>(null)
const activeTeam = computed(() => props.state.teams.find(team => team.id === activeTeamId.value))
const assignedCount = computed(() => props.state.teams.reduce((sum, team) => sum + team.playerIds.length, 0))
const owners = computed(() => new Map(props.state.teams.flatMap(team => team.playerIds.map(id => [id, team] as const))))
const results = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('ru')
  return players.filter(player => !query || `${player.nickname} ${player.fullName} ${formatRole(player.role)}`.toLocaleLowerCase('ru').includes(query))
    .sort((a, b) => Number(activeTeam.value?.playerIds.includes(b.id)) - Number(activeTeam.value?.playerIds.includes(a.id))
      || a.role - b.role || a.nickname.localeCompare(b.nickname, 'ru'))
})

function playerById(id: string) { return players.find(player => player.id === id) }
function unavailable(id: string) {
  const owner = owners.value.get(id)
  return !props.ready || Boolean(owner && owner.id !== activeTeamId.value)
    || Boolean(activeTeam.value && activeTeam.value.playerIds.length >= 5 && !activeTeam.value.playerIds.includes(id))
}
function openPicker(id: string) {
  activeTeamId.value = id
  search.value = ''
  nextTick(() => {
    picker.value?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    searchInput.value?.focus({ preventScroll: true })
  })
}
function togglePlayer(id: string) {
  if (!activeTeam.value || unavailable(id)) return
  const current = activeTeam.value.playerIds
  emit('setRoster', activeTeam.value.id, current.includes(id) ? current.filter(item => item !== id) : [...current, id])
}
function removePlayer(teamId: string, id: string) {
  const team = props.state.teams.find(item => item.id === teamId)
  if (team && props.ready) emit('setRoster', teamId, team.playerIds.filter(item => item !== id))
}
function renameTeam(id: string, event: Event) {
  const input = event.target as HTMLInputElement
  emit('rename', id, input.value)
  nextTick(() => { input.value = props.state.teams.find(team => team.id === id)?.name ?? '' })
}
function finishInput(event: KeyboardEvent) { (event.target as HTMLInputElement).blur() }
</script>

<template>
  <details class="roster-editor" open>
    <summary><span><AppIcon name="users" :size="17" /> Команды и составы</span><span class="roster-total">{{ assignedCount }} / {{ state.size * 5 }} <AppIcon name="chevron-down" :size="15" /></span></summary>
    <p class="roster-help">Собери пятёрки из наших игроков. Один игрок может быть только в одной команде.</p>
    <div class="roster-grid">
      <article v-for="(team, index) in state.teams" :key="team.id" class="roster-card" :class="{ 'roster-full': team.playerIds.length === 5 }">
        <div class="roster-card-top"><span>КОМАНДА {{ String(index + 1).padStart(2, '0') }}</span><strong>{{ team.playerIds.length }} / 5</strong></div>
        <input class="team-name-input" :value="team.name" :aria-label="`Название команды ${index + 1}`" :disabled="!ready" maxlength="40" @change="renameTeam(team.id, $event)" @keydown.enter="finishInput">
        <ul v-if="team.playerIds.length" class="roster-members">
          <li v-for="id in team.playerIds" :key="id">
            <span class="roster-position" :title="playerById(id) ? formatRole(playerById(id)!.role) : ''">{{ playerById(id)?.role ?? '—' }}</span>
            <span class="roster-member-name">{{ playerById(id)?.nickname ?? id }}</span>
            <button type="button" :disabled="!ready" :aria-label="`Убрать ${playerById(id)?.nickname ?? id} из команды ${team.name}`" @click="removePlayer(team.id, id)"><AppIcon name="close" :size="14" /></button>
          </li>
        </ul>
        <p v-else class="empty-roster">Пятёрка ещё не собрана</p>
        <button type="button" class="edit-roster-button" :disabled="!ready" :aria-label="`Выбрать игроков: ${team.name}`" @click="openPicker(team.id)"><AppIcon name="users" :size="14" /> {{ team.playerIds.length ? 'Изменить состав' : 'Выбрать игроков' }} <AppIcon name="arrow-right" :size="14" /></button>
      </article>
    </div>

    <section v-if="activeTeam" ref="picker" class="roster-picker" aria-labelledby="roster-picker-heading">
      <div class="picker-heading"><div><span>ВЫБИРАЕМ НАШИХ</span><h3 id="roster-picker-heading">{{ activeTeam.name }} <small>{{ activeTeam.playerIds.length }} / 5</small></h3></div><button type="button" aria-label="Закрыть выбор игроков" @click="activeTeamId = null"><AppIcon name="close" :size="18" /></button></div>
      <label class="picker-search"><AppIcon name="search" :size="17" /><input ref="searchInput" v-model="search" type="search" placeholder="Ник, имя или позиция…" aria-label="Поиск игроков для команды"></label>
      <p class="picker-hint" aria-live="polite">{{ activeTeam.playerIds.length === 5 ? 'Пятёрка собрана. Убери игрока, чтобы выбрать другого.' : `Свободных мест: ${5 - activeTeam.playerIds.length}. Нажми на игрока, чтобы добавить.` }}</p>
      <div v-if="results.length" class="picker-results">
        <button v-for="player in results" :key="player.id" type="button" class="picker-player" :class="{ selected: activeTeam.playerIds.includes(player.id) }" :disabled="unavailable(player.id)" :aria-pressed="activeTeam.playerIds.includes(player.id)" :aria-label="`${player.nickname}, ${formatRole(player.role)}${owners.get(player.id) && owners.get(player.id)?.id !== activeTeamId ? `, уже в команде ${owners.get(player.id)?.name}` : ''}`" @click="togglePlayer(player.id)">
          <span class="picker-role">{{ player.role }}</span>
          <span class="picker-player-info"><strong>{{ player.nickname }}</strong><small>{{ owners.get(player.id) && owners.get(player.id)?.id !== activeTeamId ? `Уже: ${owners.get(player.id)?.name}` : `${player.fullName} · ${formatRole(player.role)}` }}</small></span>
          <AppIcon v-if="activeTeam.playerIds.includes(player.id)" name="check" :size="17" /><span v-else class="picker-check" />
        </button>
      </div>
      <p v-else class="picker-empty">Никого не нашли. Попробуй имя или другой ник.</p>
    </section>
  </details>
</template>

<style scoped>
.roster-editor { margin-top: 26px; border-top: 1px solid #ffffff10; }
.roster-editor > summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 57px; list-style: none; cursor: pointer; }
.roster-editor > summary::-webkit-details-marker { display: none; }
.roster-editor > summary > span:first-child { display: flex; align-items: center; gap: 9px; color: #c7b4dd; font-size: 13px; font-weight: 650; }
.roster-total { display: flex; align-items: center; gap: 12px; color: #8d7b9f; font-size: 10px; }
.roster-help { color: #96879f; font-size: 11px; line-height: 1.8; }
.roster-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 13px; margin-top: 19px; }
.roster-card { display: flex; flex-direction: column; min-width: 0; padding: 15px; border: 1px solid #ffffff0c; border-radius: 9px; background: #14151a; }
.roster-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 11px; }
.roster-card-top > span { color: #807089; font-size: 8px; letter-spacing: .8px; }
.roster-card-top strong { color: #a990bd; font-size: 10px; }
.roster-full .roster-card-top strong { color: #c2df95; }
.team-name-input { width: 100%; min-width: 0; min-height: 41px; padding: 9px 10px; border: 1px solid #ffffff15; border-radius: 6px; color: #dfd1ea; background: #ffffff03; font-size: 12px; font-weight: 650; }
.roster-members { margin: 12px 0; padding: 0; list-style: none; }
.roster-members li { display: flex; align-items: center; gap: 8px; min-height: 40px; border-bottom: 1px solid #ffffff06; }
.roster-position { display: grid; place-items: center; width: 21px; height: 23px; flex-shrink: 0; border: 1px solid #b18ae525; border-radius: 4px; color: #ae8cc8; font-size: 10px; }
.roster-member-name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #b5a5c2; font-size: 10px; }
.roster-members button { display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; color: #75617f; }
.roster-members button:hover { color: #dda8b2; }
.empty-roster { display: grid; place-items: center; min-height: 72px; color: #74617e; font-size: 10px; }
.edit-roster-button { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; margin-top: auto; border: 1px solid #ad8bff20; border-radius: 5px; color: #bba0d2; background: #ad8bff06; font-size: 10px; }
.edit-roster-button:hover { border-color: #ad8bff65; background: #ad8bff12; }
.roster-picker { margin-top: 19px; padding: 21px; border: 1px solid #ad8bff3a; border-radius: 10px; background: #201b28; scroll-margin-top: 25px; }
.picker-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.picker-heading > div { min-width: 0; }
.picker-heading > div > span { color: #8c769e; font-size: 8px; letter-spacing: 1px; }
.picker-heading h3 { margin-top: 7px; color: #dcc6ef; font-size: 15px; overflow-wrap: anywhere; }
.picker-heading h3 small { margin-left: 8px; font-size: 11px; color: #b09ac2; white-space: nowrap; }
.picker-heading > button { width: 40px; height: 40px; flex-shrink: 0; color: #a68ab9; }
.picker-search { display: flex; align-items: center; gap: 10px; min-height: 45px; margin-top: 17px; padding: 0 12px; border: 1px solid #ffffff17; border-radius: 6px; color: #8d76a3; background: #15121c; }
.picker-search input { width: 100%; min-width: 0; height: 43px; padding: 0; border: 0; outline: 0; color: #ddcdea; background: none; font-size: 12px; }
.picker-search:focus-within { border-color: #b08fd5; }
.picker-hint { margin-top: 11px; color: #ac91bd; font-size: 10px; line-height: 1.8; }
.picker-results { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; max-height: 380px; overflow-y: auto; margin-top: 13px; padding: 3px; scrollbar-width: thin; scrollbar-color: #60436f transparent; }
.picker-player { display: flex; align-items: center; gap: 9px; min-width: 0; min-height: 59px; padding: 9px 11px; border: 1px solid #ffffff0b; border-radius: 6px; background: #ffffff02; text-align: left; }
.picker-player:disabled { opacity: .45; }
.picker-player:not(:disabled):hover { background: #ad8bff13; border-color: #ad8bff45; }
.picker-player.selected { border-color: #c7e68a35; background: #c7e68a09; }
.picker-role { display: grid; place-items: center; width: 25px; height: 29px; flex-shrink: 0; border: 1px solid #ffffff16; border-radius: 5px; color: #bd9fce; font-size: 12px; }
.picker-player-info { display: flex; flex: 1; flex-direction: column; min-width: 0; gap: 5px; }
.picker-player-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #d8c4e5; font-size: 11px; }
.picker-player-info small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #9b82ac; font-size: 9px; }
.picker-player > svg { color: #c7e68a; }
.picker-check { width: 14px; height: 14px; flex-shrink: 0; border: 1px solid #755487; border-radius: 4px; }
.picker-empty { padding: 25px 0 10px; color: #a78bb6; font-size: 11px; }
@media(max-width:1000px) { .roster-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media(max-width:620px) { .roster-grid { grid-template-columns: minmax(0, 1fr); } .picker-results { grid-template-columns: minmax(0, 1fr); } .roster-picker { padding: 16px 12px; } .roster-editor > summary > span:first-child { font-size: 12px; } .roster-total { gap: 7px; font-size: 9px; } }
</style>
