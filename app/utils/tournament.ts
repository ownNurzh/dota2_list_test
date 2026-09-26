import { players } from '../data/players.ts'

export type TournamentSize = 4 | 6 | 8
export type TournamentFormat = 'single' | 'double'
export type TournamentLayout = 'standard' | 'round-robin' | 'legacy-six-byes'
export type BracketType = 'group' | 'upper' | 'lower' | 'final'
export type MatchSource = { type: 'seed'; seed: number }
  | { type: 'standing'; position: 1 | 2 | 3 | 4 }
  | { type: 'winner' | 'loser'; matchId: string }

export interface Team {
  id: string
  name: string
  playerIds: string[]
}

export interface TournamentState {
  version: 3
  size: TournamentSize
  format: TournamentFormat
  layout: TournamentLayout
  teams: Team[]
  results: Record<string, string>
}

export interface Match {
  id: string
  roundIndex: number
  matchIndex: number
  bracket: BracketType
  sources: [MatchSource, MatchSource]
  teamIds: [string | null, string | null]
  winnerId: string | null
  loserId: string | null
  status: 'waiting' | 'ready' | 'bye' | 'complete'
}

export interface TournamentRound {
  id: string
  name: string
  bracket: BracketType
  matches: Match[]
}

export interface Standing {
  teamId: string
  played: number
  wins: number
  losses: number
  rank: number
}

export const MAX_TEAM_NAME_LENGTH = 40
export const MAX_TEAM_PLAYERS = 5
const sizes: TournamentSize[] = [4, 6, 8]
const knownPlayerIds = new Set(players.map(player => player.id))

function isTournamentSize(value: unknown): value is TournamentSize {
  return sizes.includes(value as TournamentSize)
}

function isTournamentFormat(value: unknown): value is TournamentFormat {
  return value === 'single' || value === 'double'
}

function currentLayout(size: TournamentSize): TournamentLayout {
  return size === 6 ? 'round-robin' : 'standard'
}

function isTournamentLayout(value: unknown, size: TournamentSize): value is TournamentLayout {
  return size === 6 ? value === 'round-robin' || value === 'legacy-six-byes' : value === 'standard'
}

function defaultName(index: number): string {
  return `Команда ${String(index + 1).padStart(2, '0')}`
}

function matchId(roundIndex: number, matchIndex: number): string {
  return `r${roundIndex}-m${matchIndex}`
}

export function createTournament(size: TournamentSize = 6, format: TournamentFormat = 'double'): TournamentState {
  if (!isTournamentSize(size)) throw new RangeError('Tournament size must be 4, 6 or 8')
  if (!isTournamentFormat(format)) throw new RangeError('Tournament format must be single or double')
  return {
    version: 3,
    size,
    format,
    layout: currentLayout(size),
    teams: Array.from({ length: size }, (_, index) => ({ id: `team-${index + 1}`, name: defaultName(index), playerIds: [] })),
    results: {},
  }
}

interface MatchDefinition {
  id: string
  sources: [MatchSource, MatchSource]
}

interface RoundDefinition {
  id: string
  name: string
  bracket: BracketType
  roundIndex: number
  matches: MatchDefinition[]
}

const winner = (id: string): MatchSource => ({ type: 'winner', matchId: id })
const loser = (id: string): MatchSource => ({ type: 'loser', matchId: id })

/** A topological dependency graph, including the potentially inactive reset final. */
function definitions(state: TournamentState): RoundDefinition[] {
  const isRoundRobin = state.layout === 'round-robin'
  const playoffSize = isRoundRobin ? 4 : state.size
  const seeds = playoffSize === 4 ? [1, 4, 2, 3] as const : [1, 8, 4, 5, 2, 7, 3, 6] as const
  const roundCount = Math.log2(seeds.length)
  const roundNames = ['Четвертьфинал', 'Полуфинал', 'Финал'].slice(3 - roundCount)
  const rounds: RoundDefinition[] = []

  if (isRoundRobin) {
    const rotation = [1, 2, 3, 4, 5, 6]
    for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
      rounds.push({
        id: `group-${roundIndex}`, name: `Круговой этап · тур ${roundIndex + 1}`, bracket: 'group', roundIndex,
        matches: Array.from({ length: 3 }, (_, matchIndex) => ({
          id: `g${roundIndex}-m${matchIndex}`,
          sources: [{ type: 'seed', seed: rotation[matchIndex]! }, { type: 'seed', seed: rotation[5 - matchIndex]! }],
        })),
      })
      rotation.splice(1, 0, rotation.pop()!)
    }
  }

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const matches: MatchDefinition[] = []
    const count = seeds.length / 2 ** (roundIndex + 1)
    for (let matchIndex = 0; matchIndex < count; matchIndex++) {
      matches.push({
        id: matchId(roundIndex, matchIndex),
        sources: roundIndex === 0
          ? isRoundRobin
            ? [{ type: 'standing', position: seeds[matchIndex * 2]! as 1 | 2 | 3 | 4 }, { type: 'standing', position: seeds[matchIndex * 2 + 1]! as 1 | 2 | 3 | 4 }]
            : [{ type: 'seed', seed: seeds[matchIndex * 2]! }, { type: 'seed', seed: seeds[matchIndex * 2 + 1]! }]
          : [winner(matchId(roundIndex - 1, matchIndex * 2)), winner(matchId(roundIndex - 1, matchIndex * 2 + 1))],
      })
    }
    rounds.push({ id: `round-${roundIndex}`, name: roundNames[roundIndex]!, bracket: 'upper', roundIndex, matches })
  }

  if (state.format === 'single') return rounds

  const lowerSources: [MatchSource, MatchSource][][] = playoffSize === 4
    ? [
        [[loser('r0-m0'), loser('r0-m1')]],
        [[winner('l0-m0'), loser('r1-m0')]],
      ]
    : [
        [[loser('r0-m0'), loser('r0-m1')], [loser('r0-m2'), loser('r0-m3')]],
        // Cross upper-semifinal losers into the opposite lower half to avoid immediate rematches.
        [[winner('l0-m0'), loser('r1-m1')], [winner('l0-m1'), loser('r1-m0')]],
        [[winner('l1-m0'), winner('l1-m1')]],
        [[winner('l2-m0'), loser('r2-m0')]],
      ]
  for (const [roundIndex, sources] of lowerSources.entries()) {
    rounds.push({
      id: `lower-${roundIndex}`,
      name: roundIndex === lowerSources.length - 1 ? 'Финал нижней сетки' : `Нижняя сетка · раунд ${roundIndex + 1}`,
      bracket: 'lower',
      roundIndex,
      matches: sources.map((pair, index) => ({ id: `l${roundIndex}-m${index}`, sources: pair })),
    })
  }
  rounds.push({
    id: 'grand-final', name: 'Гранд-финал', bracket: 'final', roundIndex: 0,
    matches: [{ id: 'gf-m0', sources: [winner(matchId(roundCount - 1, 0)), winner(`l${lowerSources.length - 1}-m0`)] }],
  })
  rounds.push({
    id: 'grand-final-reset', name: 'Решающий гранд-финал', bracket: 'final', roundIndex: 1,
    matches: [{ id: 'gf-reset', sources: [winner('gf-m0'), loser('gf-m0')] }],
  })
  return rounds
}

interface ResolvedSlot {
  resolved: boolean
  teamId: string | null
}

function resolveSource(state: TournamentState, matches: Map<string, Match>, source: MatchSource): ResolvedSlot {
  if (source.type === 'seed') return { resolved: true, teamId: state.teams[source.seed - 1]?.id ?? null }
  if (source.type === 'standing') {
    const group = [...matches.values()].filter(match => match.bracket === 'group')
    if (group.length !== 15 || group.some(match => match.status !== 'complete')) return { resolved: false, teamId: null }
    return { resolved: true, teamId: standingsFromMatches(state, group)[source.position - 1]?.teamId ?? null }
  }
  const feeder = matches.get(source.matchId)
  if (!feeder || (feeder.status !== 'complete' && feeder.status !== 'bye')) return { resolved: false, teamId: null }
  return { resolved: true, teamId: source.type === 'winner' ? feeder.winnerId : feeder.loserId }
}

/** Equal group wins are resolved by the initial seed, a stable and transitive ordering. */
function standingsFromMatches(state: TournamentState, matches: Iterable<Match>): Standing[] {
  const standings = new Map(state.teams.map(team => [team.id, { teamId: team.id, played: 0, wins: 0, losses: 0, rank: 0 }]))
  const seeds = new Map(state.teams.map((team, index) => [team.id, index]))
  for (const match of matches) {
    if (match.bracket !== 'group' || match.status !== 'complete') continue
    const winner = standings.get(match.winnerId!)!
    const loser = standings.get(match.loserId!)!
    winner.played++
    winner.wins++
    loser.played++
    loser.losses++
  }
  return [...standings.values()]
    .sort((a, b) => b.wins - a.wins || seeds.get(a.teamId)! - seeds.get(b.teamId)!)
    .map((standing, index) => ({ ...standing, rank: index + 1 }))
}

export function getStandings(state: TournamentState): Standing[] {
  if (state.layout !== 'round-robin') return []
  return standingsFromMatches(state, buildBracket(state).flatMap(round => round.matches))
}

/** Empty sources are resolved byes; unfinished sources must never auto-advance a team. */
export function buildBracket(state: TournamentState): TournamentRound[] {
  const rounds: TournamentRound[] = []
  const matches = new Map<string, Match>()
  for (const round of definitions(state)) {
    if (round.id === 'grand-final-reset') {
      const grandFinal = matches.get('gf-m0')!
      if (grandFinal.status !== 'complete' || grandFinal.winnerId !== grandFinal.teamIds[1]) continue
    }
    const roundMatches = round.matches.map((definition, matchIndex): Match => {
      const first = resolveSource(state, matches, definition.sources[0])
      const second = resolveSource(state, matches, definition.sources[1])
      const teamIds: Match['teamIds'] = [first.teamId, second.teamId]
      const sourcesResolved = first.resolved && second.resolved
      const isBye = sourcesResolved && (first.teamId === null || second.teamId === null)
      const isReady = sourcesResolved && !isBye
      const result = state.results[definition.id]
      const isComplete = isReady && typeof result === 'string' && teamIds.includes(result)
      const match: Match = {
        id: definition.id, roundIndex: round.roundIndex, matchIndex, bracket: round.bracket, sources: definition.sources,
        teamIds,
        winnerId: isBye ? first.teamId ?? second.teamId : isComplete ? result! : null,
        loserId: isComplete ? teamIds.find(id => id !== result) ?? null : null,
        status: isBye ? 'bye' : isComplete ? 'complete' : isReady ? 'ready' : 'waiting',
      }
      matches.set(match.id, match)
      return match
    })
    rounds.push({ id: round.id, name: round.name, bracket: round.bracket, matches: roundMatches })
  }
  return rounds
}

/** Changing any winner invalidates every match that depends on that result. */
export function setMatchWinner(state: TournamentState, id: string, winnerId: string | null): TournamentState {
  const rounds = buildBracket(state)
  const match = rounds.flatMap(round => round.matches).find(item => item.id === id)
  if (!match || (match.status !== 'ready' && match.status !== 'complete')) return state
  if (winnerId !== null && !match.teamIds.includes(winnerId)) return state
  if (match.winnerId === winnerId) return state

  const results = { ...state.results }
  if (winnerId === null) delete results[id]
  else results[id] = winnerId

  const changed = new Set([id])
  const groupChanged = match.bracket === 'group'
  for (const definition of definitions(state).flatMap(round => round.matches)) {
    if (!definition.sources.some(source => source.type === 'standing'
      ? groupChanged
      : (source.type === 'winner' || source.type === 'loser') && changed.has(source.matchId))) continue
    changed.add(definition.id)
    delete results[definition.id]
  }
  return { ...state, results }
}

export function resetResults(state: TournamentState): TournamentState {
  const layout = currentLayout(state.size)
  return Object.keys(state.results).length || state.layout !== layout ? { ...state, layout, results: {} } : state
}

/** Preserve visible team names in seed order when switching bracket sizes. */
export function resizeTournament(state: TournamentState, size: TournamentSize): TournamentState {
  const resized = createTournament(size, state.format)
  resized.teams = resized.teams.map((team, index) => ({
    ...team,
    name: state.teams[index]?.name ?? team.name,
    playerIds: [...(state.teams[index]?.playerIds ?? [])],
  }))
  return resized
}

export function changeTournamentFormat(state: TournamentState, format: TournamentFormat): TournamentState {
  if (!isTournamentFormat(format)) throw new RangeError('Tournament format must be single or double')
  return { ...state, format, layout: currentLayout(state.size), results: {} }
}

/** Invalid assignments are a no-op; valid roster edits preserve match results as team metadata. */
export function setTeamPlayers(state: TournamentState, id: string, playerIds: string[]): TournamentState {
  const team = state.teams.find(item => item.id === id)
  if (!team || !Array.isArray(playerIds) || playerIds.length > MAX_TEAM_PLAYERS) return state
  const assigned = new Set(state.teams.filter(item => item.id !== id).flatMap(item => item.playerIds))
  if (new Set(playerIds).size !== playerIds.length || Array.from(playerIds).some(playerId => typeof playerId !== 'string' || !knownPlayerIds.has(playerId) || assigned.has(playerId))) return state
  if (playerIds.length === team.playerIds.length && playerIds.every((playerId, index) => playerId === team.playerIds[index])) return state
  return { ...state, teams: state.teams.map(item => item.id === id ? { ...item, playerIds: [...playerIds] } : item) }
}

export function renameTeam(state: TournamentState, id: string, name: string): TournamentState {
  const team = state.teams.find(item => item.id === id)
  if (!team) return state
  const normalizedName = Array.from(name.trim()).slice(0, MAX_TEAM_NAME_LENGTH).join('')
    || defaultName(Number(id.slice('team-'.length)) - 1)
  if (team.name === normalizedName) return state
  return { ...state, teams: state.teams.map(item => item.id === id ? { ...item, name: normalizedName } : item) }
}

/** Fisher–Yates changes seeding without changing team identities. */
export function shuffleTeams(state: TournamentState, random: () => number = Math.random): TournamentState {
  const teams = state.teams.map(team => ({ ...team, playerIds: [...team.playerIds] }))
  for (let index = teams.length - 1; index > 0; index--) {
    const value = random()
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Random source must return values from 0 inclusive to 1 exclusive')
    const target = Math.floor(value * (index + 1))
    ;[teams[index], teams[target]] = [teams[target]!, teams[index]!]
  }
  return { ...state, layout: currentLayout(state.size), teams, results: {} }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

/** Reject invalid identities/schema and discard invalid or premature stored results. */
export function parseTournament(value: unknown): TournamentState | null {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2 && value.version !== 3)) return null
  const keys = value.version === 1 ? ['version', 'size', 'teams', 'results']
    : value.version === 2 ? ['version', 'size', 'format', 'teams', 'results']
      : ['version', 'size', 'format', 'layout', 'teams', 'results']
  if (!hasExactKeys(value, keys)) return null
  const format = value.version === 1 ? 'single' : value.format
  if (!isTournamentFormat(format) || !isTournamentSize(value.size) || !Array.isArray(value.teams) || !isRecord(value.results)) return null
  if (value.teams.length !== value.size) return null
  const layout = value.version === 3 ? value.layout : value.size === 6 ? 'legacy-six-byes' : 'standard'
  if (!isTournamentLayout(layout, value.size)) return null

  const validIds = new Set(Array.from({ length: value.size }, (_, index) => `team-${index + 1}`))
  const teams: Team[] = []
  const assignedPlayerIds = new Set<string>()
  for (const item of value.teams) {
    if (!isRecord(item) || !hasExactKeys(item, value.version === 3 ? ['id', 'name', 'playerIds'] : ['id', 'name'])) return null
    if (typeof item.id !== 'string' || !validIds.delete(item.id)) return null
    if (typeof item.name !== 'string' || item.name !== item.name.trim() || !item.name || Array.from(item.name).length > MAX_TEAM_NAME_LENGTH) return null
    const playerIds = value.version === 3 ? item.playerIds : []
    if (!Array.isArray(playerIds) || playerIds.length > MAX_TEAM_PLAYERS) return null
    for (const playerId of playerIds) {
      if (typeof playerId !== 'string' || !knownPlayerIds.has(playerId) || assignedPlayerIds.has(playerId)) return null
      assignedPlayerIds.add(playerId)
    }
    teams.push({ id: item.id, name: item.name, playerIds: [...playerIds] })
  }

  const state: TournamentState = { version: 3, size: value.size, format, layout, teams, results: {} }
  for (const definition of definitions(state).flatMap(round => round.matches)) {
    if (!Object.hasOwn(value.results, definition.id)) continue
    const match = buildBracket(state).flatMap(round => round.matches).find(item => item.id === definition.id)
    const winnerId = value.results[definition.id]
    if (match?.status === 'ready' && typeof winnerId === 'string' && match.teamIds.includes(winnerId)) state.results[match.id] = winnerId
  }
  // An unplayed legacy setup has no history to protect; open it in the current six-team format.
  if (state.layout === 'legacy-six-byes' && Object.keys(state.results).length === 0) state.layout = 'round-robin'
  return state
}

export function getChampion(state: TournamentState): Team | null {
  const winnerId = buildBracket(state).at(-1)?.matches[0]?.winnerId
  return state.teams.find(team => team.id === winnerId) ?? null
}

/** Expected real games for the selected format, including an activated reset final. */
export function getTournamentMatchCount(state: TournamentState): number {
  const groupMatches = state.layout === 'round-robin' ? 15 : 0
  const playoffSize = state.layout === 'round-robin' ? 4 : state.size
  if (state.format === 'single') return groupMatches + playoffSize - 1
  const resetActive = buildBracket(state).some(round => round.matches.some(match => match.id === 'gf-reset'))
  return groupMatches + playoffSize * 2 - 2 + Number(resetActive)
}
