<script setup lang="ts">
import { players, roles } from '~/data/players'
import { formatRole } from '~/utils/players'
import type { TournamentState } from '~/utils/tournament'

const props = defineProps<{ state: TournamentState; ready: boolean }>()
const emit = defineEmits<{
  rename: [teamId: string, name: string]
  setRoster: [teamId: string, playerIds: string[]]
}>()
const activeTeamId = ref(props.state.teams[0]?.id ?? '')
const search = ref('')
const role = ref('')
const hideOtherTeams = ref(true)
const activeTeam = computed(() => props.state.teams.find(team => team.id === activeTeamId.value))
const activeTeamIndex = computed(() => props.state.teams.findIndex(team => team.id === activeTeamId.value))
const assignedCount = computed(() => props.state.teams.reduce((sum, team) => sum + team.playerIds.length, 0))
const completeCount = computed(() => props.state.teams.filter(team => team.playerIds.length === 5).length)
const playersById = new Map(players.map(player => [player.id, player]))
const owners = computed(() => new Map(props.state.teams.flatMap(team => team.playerIds.map(id => [id, team] as const))))
const results = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('ru')
  return players.filter(player => {
    const owner = owners.value.get(player.id)
    return (!hideOtherTeams.value || !owner || owner.id === activeTeamId.value)
      && (!role.value || player.role === Number(role.value))
      && (!query || (player.nickname + ' ' + player.fullName + ' ' + formatRole(player.role)).toLocaleLowerCase('ru').includes(query))
  }).sort((a, b) => a.role - b.role || a.nickname.localeCompare(b.nickname, 'ru'))
})

watch(() => props.state.teams.map(team => team.id), ids => {
  if (!ids.includes(activeTeamId.value)) selectTeam(ids[0] ?? '')
})

function playerById(id: string) { return playersById.get(id) }
function unavailable(id: string) {
  const owner = owners.value.get(id)
  return !props.ready || Boolean(owner && owner.id !== activeTeamId.value)
    || Boolean(activeTeam.value && activeTeam.value.playerIds.length >= 5 && !activeTeam.value.playerIds.includes(id))
}
function selectTeam(id: string) {
  activeTeamId.value = id
  search.value = ''
  role.value = ''
}
function togglePlayer(id: string) {
  if (!activeTeam.value || unavailable(id)) return
  const current = activeTeam.value.playerIds
  emit('setRoster', activeTeam.value.id, current.includes(id) ? current.filter(item => item !== id) : [...current, id])
}
function removePlayer(id: string) {
  if (activeTeam.value && props.ready) {
    emit('setRoster', activeTeam.value.id, activeTeam.value.playerIds.filter(item => item !== id))
  }
}
function renameTeam(id: string, event: Event) {
  if (!props.ready) return
  const input = event.target as HTMLInputElement
  emit('rename', id, input.value)
  nextTick(() => { input.value = props.state.teams.find(team => team.id === id)?.name ?? '' })
}
function finishInput(event: KeyboardEvent) { (event.target as HTMLInputElement).blur() }
function clearFilters() {
  search.value = ''
  role.value = ''
  hideOtherTeams.value = true
}
</script>

<template>
  <details class="roster-editor" open>
    <summary>
      <span><AppIcon name="users" :size="18" /> Команды и составы</span>
      <span class="roster-total">{{ assignedCount }} / {{ state.size * 5 }} <AppIcon name="chevron-down" :size="16" /></span>
    </summary>
    <div class="roster-intro">
      <p>Выбери команду, задай название и собери пятёрку.</p>
      <span>{{ completeCount }} из {{ state.size }} собрано</span>
    </div>

    <div class="team-selector" role="group" aria-label="Выбрать команду для редактирования">
      <button
        v-for="(team, index) in state.teams" :key="team.id" type="button"
        class="team-option" :class="{ selected: team.id === activeTeamId, complete: team.playerIds.length === 5 }"
        :aria-pressed="team.id === activeTeamId" aria-controls="active-team-editor" :disabled="!ready"
        :aria-label="team.name + ', игроков ' + team.playerIds.length + ' из 5'"
        @click="selectTeam(team.id)"
      >
        <span class="team-option-number">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="team-option-copy"><strong>{{ team.name }}</strong><small>{{ team.playerIds.length === 5 ? 'Состав собран' : 'Игроков: ' + team.playerIds.length + ' / 5' }}</small></span>
        <AppIcon v-if="team.playerIds.length === 5" name="check" :size="16" />
      </button>
    </div>

    <section v-if="activeTeam" id="active-team-editor" class="team-workspace" aria-labelledby="active-team-heading">
      <div class="active-roster">
        <div class="active-roster-heading">
          <h3 id="active-team-heading">Команда {{ String(activeTeamIndex + 1).padStart(2, '0') }}</h3>
          <span :class="{ complete: activeTeam.playerIds.length === 5 }">{{ activeTeam.playerIds.length }} / 5</span>
        </div>
        <label class="team-name-label" for="active-team-name">Название команды</label>
        <input
          id="active-team-name" :key="activeTeam.id" class="team-name-input" :value="activeTeam.name"
          :disabled="!ready" maxlength="40" @change="renameTeam(activeTeam.id, $event)" @keydown.enter="finishInput"
        >
        <ul v-if="activeTeam.playerIds.length" class="roster-members" aria-label="Текущий состав">
          <li v-for="id in activeTeam.playerIds" :key="id">
            <span class="roster-position" :title="playerById(id) ? formatRole(playerById(id)!.role) : ''">{{ playerById(id)?.role ?? '—' }}</span>
            <span class="roster-member-info"><strong>{{ playerById(id)?.nickname ?? id }}</strong><small>{{ playerById(id) ? formatRole(playerById(id)!.role) : 'Игрок' }}</small></span>
            <button type="button" :disabled="!ready" :aria-label="'Убрать ' + (playerById(id)?.nickname ?? id) + ' из команды ' + activeTeam.name" @click="removePlayer(id)"><AppIcon name="close" :size="17" /></button>
          </li>
        </ul>
        <p v-else class="empty-roster">Пока никого. Добавь игроков из списка<span class="desktop-picker-direction"> справа</span>.</p>
        <p class="roster-status" :class="{ complete: activeTeam.playerIds.length === 5 }" aria-live="polite">
          <AppIcon :name="activeTeam.playerIds.length === 5 ? 'check' : 'users'" :size="15" />
          {{ activeTeam.playerIds.length === 5 ? 'Пятёрка собрана' : 'Осталось мест: ' + (5 - activeTeam.playerIds.length) }}
        </p>
      </div>

      <div class="roster-picker">
        <div class="picker-heading"><h3>Добавить игроков</h3><span>{{ results.length }} в списке</span></div>
        <p class="picker-help">Один игрок — одна команда. Нажми повторно, чтобы убрать.</p>
        <div class="picker-filters">
          <label class="picker-search"><AppIcon name="search" :size="18" /><input v-model="search" type="search" placeholder="Ник или имя" aria-label="Поиск игроков для команды"></label>
          <select v-model="role" aria-label="Позиция игрока">
            <option value="">Все позиции</option>
            <option v-for="position in roles" :key="position" :value="String(position)">{{ formatRole(position) }}</option>
          </select>
        </div>
        <label class="picker-availability"><input v-model="hideOtherTeams" type="checkbox"><span>Скрыть игроков других команд</span></label>
        <p v-if="activeTeam.playerIds.length === 5" class="picker-full">Все места заняты. Убери игрока из состава, чтобы заменить.</p>
        <div v-if="results.length" class="picker-results">
          <button
            v-for="player in results" :key="player.id" type="button" class="picker-player"
            :class="{ selected: activeTeam.playerIds.includes(player.id) }" :disabled="unavailable(player.id)"
            :aria-pressed="activeTeam.playerIds.includes(player.id)"
            :aria-label="player.nickname + ', ' + formatRole(player.role) + (owners.get(player.id) && owners.get(player.id)?.id !== activeTeamId ? ', уже в команде ' + owners.get(player.id)?.name : '')"
            @click="togglePlayer(player.id)"
          >
            <span class="picker-role">{{ player.role }}</span>
            <span class="picker-player-info"><strong>{{ player.nickname }}</strong><small>{{ owners.get(player.id) && owners.get(player.id)?.id !== activeTeamId ? 'Уже: ' + owners.get(player.id)?.name : player.fullName + ' · ' + formatRole(player.role) }}</small></span>
            <AppIcon v-if="activeTeam.playerIds.includes(player.id)" name="check" :size="18" /><span v-else class="picker-check" aria-hidden="true">+</span>
          </button>
        </div>
        <div v-else class="picker-empty"><p>По этим условиям игроков нет.</p><button type="button" @click="clearFilters">Сбросить поиск и фильтры</button></div>
      </div>
    </section>
  </details>
</template>

<style scoped>
.roster-editor { min-width: 0; margin-top: 26px; border-top: 1px solid #ffffff10; }
.roster-editor > summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px; list-style: none; cursor: pointer; }
.roster-editor > summary::-webkit-details-marker { display: none; }
.roster-editor > summary > span:first-child { display: flex; align-items: center; gap: 9px; color: #d9c9e8; font-size: 14px; font-weight: 650; }
.roster-total { display: flex; align-items: center; gap: 12px; color: #ac9ab9; font-size: 12px; white-space: nowrap; }
.roster-editor[open] .roster-total svg { transform: rotate(180deg); }
.roster-intro { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 7px 16px; color: #ac9cb8; font-size: 12px; line-height: 1.7; }
.roster-intro > span { color: #b9cca0; }
.team-selector { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
.team-option { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 75px; padding: 12px; border: 1px solid #ffffff12; border-radius: 8px; background: #14151a; text-align: left; }
.team-option:not(:disabled):hover { border-color: #ad8bff65; }
.team-option.selected { border-color: #ad8bff80; background: #ad8bff12; }
.team-option-number { color: #9d86b0; font-size: 11px; font-variant-numeric: tabular-nums; }
.team-option-copy { display: flex; flex: 1; flex-direction: column; gap: 5px; min-width: 0; }
.team-option-copy strong { overflow: hidden; color: #cfbfdc; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.team-option-copy small { color: #9f8dab; font-size: 10px; }
.team-option.complete small, .team-option > svg { color: #c8dfa4; }
.team-option.selected strong { color: #ecddfb; }
.team-workspace { display: grid; grid-template-columns: minmax(230px, .75fr) minmax(0, 1.5fr); margin-top: 16px; overflow: hidden; border: 1px solid #ad8bff2d; border-radius: 10px; background: #17151d; }
.active-roster { min-width: 0; padding: 20px; border-right: 1px solid #ffffff0d; }
.active-roster-heading, .picker-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.active-roster-heading h3, .picker-heading h3 { color: #d8c6e7; font-size: 14px; font-weight: 650; }
.active-roster-heading > span { color: #b7a0c9; font-size: 12px; font-variant-numeric: tabular-nums; }
.active-roster-heading > .complete { color: #c8dfa4; }
.team-name-label { display: block; margin-top: 20px; margin-bottom: 8px; color: #a995b8; font-size: 11px; }
.team-name-input { width: 100%; min-width: 0; min-height: 46px; padding: 10px 12px; border: 1px solid #ffffff20; border-radius: 6px; color: #e8d8f2; background: #ffffff03; font-size: 14px; font-weight: 650; }
.roster-members { margin: 16px 0 0; padding: 0; list-style: none; }
.roster-members li { display: flex; align-items: center; gap: 9px; min-height: 56px; border-bottom: 1px solid #ffffff09; }
.roster-position { display: grid; place-items: center; width: 25px; height: 29px; flex-shrink: 0; border: 1px solid #b18ae530; border-radius: 5px; color: #c3a2dd; font-size: 12px; }
.roster-member-info { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; }
.roster-member-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #d8c9e3; font-size: 12px; font-weight: 600; }
.roster-member-info small { color: #a28daf; font-size: 10px; }
.roster-members button { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 6px; color: #ad8dc0; }
.roster-members button:hover:not(:disabled) { color: #edbac3; background: #edbac30a; }
.empty-roster { margin-top: 18px; color: #a38eaf; font-size: 12px; line-height: 1.8; }
.roster-status { display: flex; align-items: center; gap: 7px; margin-top: 18px; color: #b7a0c7; font-size: 12px; line-height: 1.6; }
.roster-status.complete { color: #c7e09d; }
.roster-picker { min-width: 0; padding: 20px; background: #201b283b; }
.picker-heading > span { color: #a48bb5; font-size: 11px; white-space: nowrap; }
.picker-help { margin-top: 9px; color: #a692b5; font-size: 11px; line-height: 1.8; }
.picker-filters { display: flex; gap: 8px; margin-top: 14px; }
.picker-search { display: flex; flex: 1; align-items: center; gap: 9px; min-width: 0; min-height: 46px; padding: 0 11px; border: 1px solid #ffffff20; border-radius: 6px; color: #a88fbd; background: #141219; }
.picker-search input { width: 100%; min-width: 0; height: 44px; padding: 0; border: 0; outline: 0; color: #e2d1ee; background: none; font-size: 13px; }
.picker-search input::placeholder { color: #a18dad; }
.picker-search:focus-within { outline: 2px solid var(--purple); outline-offset: 2px; }
.picker-filters > select { min-width: 0; width: 157px; padding: 9px; border: 1px solid #ffffff20; border-radius: 6px; color: #c9b5d9; background: #141219; font-size: 12px; }
.picker-availability { display: flex; align-items: center; gap: 9px; width: fit-content; min-height: 44px; color: #b6a0c4; font-size: 11px; line-height: 1.5; cursor: pointer; }
.picker-availability input { width: 17px; height: 17px; flex-shrink: 0; margin: 0; accent-color: #bc9df2; }
.picker-full { margin-bottom: 9px; color: #c3d79f; font-size: 11px; line-height: 1.7; }
.picker-results { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 7px; max-height: 330px; overflow-y: auto; padding: 4px; scrollbar-width: thin; scrollbar-color: #765387 transparent; }
.picker-player { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 62px; padding: 9px; border: 1px solid #ffffff10; border-radius: 6px; background: #ffffff02; text-align: left; }
.picker-player:disabled { opacity: .5; }
.picker-player:not(:disabled):hover { background: #ad8bff13; border-color: #ad8bff55; }
.picker-player.selected { border-color: #c7e68a45; background: #c7e68a0b; }
.picker-role { display: grid; place-items: center; width: 24px; height: 28px; flex-shrink: 0; border: 1px solid #ffffff1c; border-radius: 5px; color: #c9addb; font-size: 12px; }
.picker-player-info { display: flex; flex: 1; flex-direction: column; min-width: 0; gap: 5px; }
.picker-player-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e2cdef; font-size: 12px; font-weight: 650; }
.picker-player-info small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ad94bc; font-size: 10px; }
.picker-player > svg { color: #d0eb91; }
.picker-check { display: grid; place-items: center; width: 18px; height: 18px; flex-shrink: 0; border: 1px solid #9373a2; border-radius: 4px; color: #c5aad6; font-size: 15px; line-height: 1; }
.picker-empty { padding: 22px 0; color: #b79dc6; font-size: 12px; line-height: 1.8; }
.picker-empty button { min-height: 44px; margin-top: 6px; padding: 5px 0; color: #d4b8f4; text-align: left; text-decoration: underline; text-underline-offset: 4px; }
@media (max-width: 1150px) {
  .team-selector { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .team-workspace { grid-template-columns: minmax(210px, .8fr) minmax(0, 1.2fr); }
  .picker-results { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .team-selector { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .team-workspace { grid-template-columns: minmax(0, 1fr); }
  .active-roster { border-right: 0; border-bottom: 1px solid #ffffff10; }
  .roster-members { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 18px; }
  .desktop-picker-direction { display: none; }
  .picker-results { grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 360px; }
  .team-name-input, .picker-search input, .picker-filters > select { font-size: 16px; }
}
@media (max-width: 520px) {
  .roster-editor > summary > span:first-child { gap: 7px; font-size: 13px; }
  .roster-total { gap: 6px; font-size: 11px; }
  .roster-intro { font-size: 11px; }
  .team-option { gap: 7px; min-height: 72px; padding: 10px 8px; }
  .team-option-number { font-size: 10px; }
  .team-option-copy strong { font-size: 11px; }
  .team-option-copy small { font-size: 10px; }
  .team-option > svg { width: 13px; }
  .active-roster, .roster-picker { padding: 16px 12px; }
  .roster-members, .picker-results { grid-template-columns: minmax(0, 1fr); }
  .picker-filters { flex-direction: column; }
  .picker-filters > select { width: 100%; min-height: 46px; }
  .picker-player { min-height: 64px; padding: 10px; }
  .picker-player-info strong { font-size: 13px; }
  .picker-player-info small { font-size: 11px; }
  .picker-availability { font-size: 11px; }
}
</style>
