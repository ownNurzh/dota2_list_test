export type TournamentSize = 4 | 6 | 8
export type TournamentFormat = 'single' | 'double'
export type BracketType = 'upper' | 'lower' | 'final'
export type MatchSource = { type: 'seed'; seed: number } | { type: 'winner' | 'loser'; matchId: string }

export interface Team {
  id: string
  name: string
}

export interface TournamentState {
  version: 2
  size: TournamentSize
  format: TournamentFormat
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

export const MAX_TEAM_NAME_LENGTH = 40
const sizes: TournamentSize[] = [4, 6, 8]

function isTournamentSize(value: unknown): value is TournamentSize {
  return sizes.includes(value as TournamentSize)
}

function isTournamentFormat(value: unknown): value is TournamentFormat {
  return value === 'single' || value === 'double'
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
    version: 2,
    size,
    format,
    teams: Array.from({ length: size }, (_, index) => ({ id: `team-${index + 1}`, name: defaultName(index) })),
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
  const seeds = state.size === 4 ? [1, 4, 2, 3] : [1, 8, 4, 5, 2, 7, 3, 6]
  const roundCount = Math.log2(seeds.length)
  const roundNames = ['Четвертьфинал', 'Полуфинал', 'Финал'].slice(3 - roundCount)
  const rounds: RoundDefinition[] = []

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const matches: MatchDefinition[] = []
    const count = seeds.length / 2 ** (roundIndex + 1)
    for (let matchIndex = 0; matchIndex < count; matchIndex++) {
      matches.push({
        id: matchId(roundIndex, matchIndex),
        sources: roundIndex === 0
          ? [{ type: 'seed', seed: seeds[matchIndex * 2]! }, { type: 'seed', seed: seeds[matchIndex * 2 + 1]! }]
          : [winner(matchId(roundIndex - 1, matchIndex * 2)), winner(matchId(roundIndex - 1, matchIndex * 2 + 1))],
      })
    }
    rounds.push({ id: `round-${roundIndex}`, name: roundNames[roundIndex]!, bracket: 'upper', roundIndex, matches })
  }

  if (state.format === 'single') return rounds

  const lowerSources: [MatchSource, MatchSource][][] = state.size === 4
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
  const feeder = matches.get(source.matchId)
  if (!feeder || (feeder.status !== 'complete' && feeder.status !== 'bye')) return { resolved: false, teamId: null }
  return { resolved: true, teamId: source.type === 'winner' ? feeder.winnerId : feeder.loserId }
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
  for (const definition of definitions(state).flatMap(round => round.matches)) {
    if (!definition.sources.some(source => source.type !== 'seed' && changed.has(source.matchId))) continue
    changed.add(definition.id)
    delete results[definition.id]
  }
  return { ...state, results }
}

export function resetResults(state: TournamentState): TournamentState {
  return Object.keys(state.results).length ? { ...state, results: {} } : state
}

/** Preserve visible team names in seed order when switching bracket sizes. */
export function resizeTournament(state: TournamentState, size: TournamentSize): TournamentState {
  const resized = createTournament(size, state.format)
  resized.teams = resized.teams.map((team, index) => ({ ...team, name: state.teams[index]?.name ?? team.name }))
  return resized
}

export function changeTournamentFormat(state: TournamentState, format: TournamentFormat): TournamentState {
  if (!isTournamentFormat(format)) throw new RangeError('Tournament format must be single or double')
  return { ...state, format, results: {} }
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
  const teams = state.teams.map(team => ({ ...team }))
  for (let index = teams.length - 1; index > 0; index--) {
    const value = random()
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Random source must return values from 0 inclusive to 1 exclusive')
    const target = Math.floor(value * (index + 1))
    ;[teams[index], teams[target]] = [teams[target]!, teams[index]!]
  }
  return { ...state, teams, results: {} }
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
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) return null
  const keys = value.version === 1 ? ['version', 'size', 'teams', 'results'] : ['version', 'size', 'format', 'teams', 'results']
  if (!hasExactKeys(value, keys)) return null
  const format = value.version === 1 ? 'single' : value.format
  if (!isTournamentFormat(format) || !isTournamentSize(value.size) || !Array.isArray(value.teams) || !isRecord(value.results)) return null
  if (value.teams.length !== value.size) return null

  const validIds = new Set(Array.from({ length: value.size }, (_, index) => `team-${index + 1}`))
  const teams: Team[] = []
  for (const item of value.teams) {
    if (!isRecord(item) || !hasExactKeys(item, ['id', 'name'])) return null
    if (typeof item.id !== 'string' || !validIds.delete(item.id)) return null
    if (typeof item.name !== 'string' || item.name !== item.name.trim() || !item.name || Array.from(item.name).length > MAX_TEAM_NAME_LENGTH) return null
    teams.push({ id: item.id, name: item.name })
  }

  const state: TournamentState = { version: 2, size: value.size, format, teams, results: {} }
  for (const definition of definitions(state).flatMap(round => round.matches)) {
    if (!Object.hasOwn(value.results, definition.id)) continue
    const match = buildBracket(state).flatMap(round => round.matches).find(item => item.id === definition.id)
    const winnerId = value.results[definition.id]
    if (match?.status === 'ready' && typeof winnerId === 'string' && match.teamIds.includes(winnerId)) state.results[match.id] = winnerId
  }
  return state
}

export function getChampion(state: TournamentState): Team | null {
  const winnerId = buildBracket(state).at(-1)?.matches[0]?.winnerId
  return state.teams.find(team => team.id === winnerId) ?? null
}

/** Expected real games for the selected format, including an activated reset final. */
export function getTournamentMatchCount(state: TournamentState): number {
  if (state.format === 'single') return state.size - 1
  const resetActive = buildBracket(state).some(round => round.matches.some(match => match.id === 'gf-reset'))
  return state.size * 2 - 2 + Number(resetActive)
}
