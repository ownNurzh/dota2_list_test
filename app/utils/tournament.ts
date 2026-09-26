export type TournamentSize = 4 | 6 | 8

export interface Team {
  id: string
  name: string
}

export interface TournamentState {
  version: 1
  size: TournamentSize
  teams: Team[]
  results: Record<string, string>
}

export interface Match {
  id: string
  roundIndex: number
  matchIndex: number
  teamIds: [string | null, string | null]
  winnerId: string | null
  status: 'waiting' | 'ready' | 'bye' | 'complete'
}

export interface TournamentRound {
  id: string
  name: string
  matches: Match[]
}

export const MAX_TEAM_NAME_LENGTH = 40
const sizes: TournamentSize[] = [4, 6, 8]

function isTournamentSize(value: unknown): value is TournamentSize {
  return sizes.includes(value as TournamentSize)
}

function defaultName(index: number): string {
  return `Команда ${String(index + 1).padStart(2, '0')}`
}

function matchId(roundIndex: number, matchIndex: number): string {
  return `r${roundIndex}-m${matchIndex}`
}

export function createTournament(size: TournamentSize = 6): TournamentState {
  if (!isTournamentSize(size)) throw new RangeError('Tournament size must be 4, 6 or 8')
  return {
    version: 1,
    size,
    teams: Array.from({ length: size }, (_, index) => ({ id: `team-${index + 1}`, name: defaultName(index) })),
    results: {},
  }
}

/** Missing seeds are byes only in the first round; unfinished feeders remain waiting. */
export function buildBracket(state: TournamentState): TournamentRound[] {
  const seeds = state.size === 4 ? [1, 4, 2, 3] : [1, 8, 4, 5, 2, 7, 3, 6]
  const slots = seeds.map(seed => state.teams[seed - 1]?.id ?? null)
  const roundCount = Math.log2(slots.length)
  const roundNames = ['Четвертьфинал', 'Полуфинал', 'Финал'].slice(3 - roundCount)
  const rounds: TournamentRound[] = []

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const matches: Match[] = []
    const count = slots.length / 2 ** (roundIndex + 1)
    for (let matchIndex = 0; matchIndex < count; matchIndex++) {
      const teamIds: Match['teamIds'] = roundIndex === 0
        ? [slots[matchIndex * 2] ?? null, slots[matchIndex * 2 + 1] ?? null]
        : [rounds[roundIndex - 1]!.matches[matchIndex * 2]!.winnerId, rounds[roundIndex - 1]!.matches[matchIndex * 2 + 1]!.winnerId]
      const id = matchId(roundIndex, matchIndex)
      const result = state.results[id]
      const isBye = roundIndex === 0 && teamIds.filter(Boolean).length === 1
      const isReady = teamIds[0] !== null && teamIds[1] !== null
      const isComplete = isReady && typeof result === 'string' && teamIds.includes(result)
      matches.push({
        id,
        roundIndex,
        matchIndex,
        teamIds,
        winnerId: isBye ? teamIds[0] ?? teamIds[1] : isComplete ? result! : null,
        status: isBye ? 'bye' : isComplete ? 'complete' : isReady ? 'ready' : 'waiting',
      })
    }
    rounds.push({ id: `round-${roundIndex}`, name: roundNames[roundIndex]!, matches })
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

  let downstreamIndex = match.matchIndex
  for (let roundIndex = match.roundIndex + 1; roundIndex < rounds.length; roundIndex++) {
    downstreamIndex = Math.floor(downstreamIndex / 2)
    delete results[matchId(roundIndex, downstreamIndex)]
  }
  return { ...state, results }
}

export function resetResults(state: TournamentState): TournamentState {
  return Object.keys(state.results).length ? { ...state, results: {} } : state
}

/** Preserve visible team names in seed order when switching bracket sizes. */
export function resizeTournament(state: TournamentState, size: TournamentSize): TournamentState {
  const resized = createTournament(size)
  resized.teams = resized.teams.map((team, index) => ({ ...team, name: state.teams[index]?.name ?? team.name }))
  return resized
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
  if (!isRecord(value) || !hasExactKeys(value, ['version', 'size', 'teams', 'results'])) return null
  if (value.version !== 1 || !isTournamentSize(value.size) || !Array.isArray(value.teams) || !isRecord(value.results)) return null
  if (value.teams.length !== value.size) return null

  const validIds = new Set(Array.from({ length: value.size }, (_, index) => `team-${index + 1}`))
  const teams: Team[] = []
  for (const item of value.teams) {
    if (!isRecord(item) || !hasExactKeys(item, ['id', 'name'])) return null
    if (typeof item.id !== 'string' || !validIds.delete(item.id)) return null
    if (typeof item.name !== 'string' || item.name !== item.name.trim() || !item.name || Array.from(item.name).length > MAX_TEAM_NAME_LENGTH) return null
    teams.push({ id: item.id, name: item.name })
  }

  const state: TournamentState = { version: 1, size: value.size, teams, results: {} }
  const roundCount = state.size === 4 ? 2 : 3
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const round = buildBracket(state)[roundIndex]!
    for (const match of round.matches) {
      if (!Object.hasOwn(value.results, match.id)) continue
      const winner = value.results[match.id]
      if (match.status === 'ready' && typeof winner === 'string' && match.teamIds.includes(winner)) state.results[match.id] = winner
    }
  }
  return state
}

export function getChampion(state: TournamentState): Team | null {
  const winnerId = buildBracket(state).at(-1)?.matches[0]?.winnerId
  return state.teams.find(team => team.id === winnerId) ?? null
}
