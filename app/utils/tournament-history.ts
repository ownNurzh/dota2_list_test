import { getChampion, MAX_TEAM_NAME_LENGTH, MAX_TEAM_PLAYERS, parseTournament, type TournamentState } from './tournament.ts'

export interface TournamentChampion {
  name: string
  playerIds: string[]
}

export interface TournamentArchiveEntry {
  id: string
  date: string
  champion: TournamentChampion
}

export const MAX_ARCHIVED_TOURNAMENTS = 100

export function isTournamentDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function parseChampion(value: unknown): TournamentChampion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const champion = value as Record<string, unknown>
  if (typeof champion.name !== 'string' || !champion.name.trim() || Array.from(champion.name.trim()).length > MAX_TEAM_NAME_LENGTH) return null
  if (!Array.isArray(champion.playerIds) || champion.playerIds.length > MAX_TEAM_PLAYERS) return null
  // Keep valid historical IDs even if a player is later removed from the directory.
  if (!champion.playerIds.every(id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id))) return null
  if (new Set(champion.playerIds).size !== champion.playerIds.length) return null
  return { name: champion.name.trim(), playerIds: [...champion.playerIds] }
}

export function parseTournamentEntry(value: unknown): TournamentArchiveEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entry = value as Record<string, unknown>
  if (typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(entry.id)) return null
  if (!isTournamentDate(entry.date)) return null

  let champion: TournamentChampion | null
  if ('champion' in entry) {
    champion = parseChampion(entry.champion)
  } else {
    // Read full brackets from the original browser archive as champion records.
    const state = parseTournament(entry.state)
    champion = state ? parseChampion(getChampion(state)) : null
  }
  return champion ? { id: entry.id, date: entry.date, champion } : null
}

export function createTournamentEntry(state: TournamentState, date: string, id: string): TournamentArchiveEntry | null {
  // Parsing verifies the completed final and detaches the winning roster.
  return parseTournamentEntry({ id, date, state })
}

export function parseTournamentHistory(value: unknown): TournamentArchiveEntry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap(item => {
    const entry = parseTournamentEntry(item)
    if (!entry || seen.has(entry.id)) return []
    seen.add(entry.id)
    return [entry]
  })
}

export function tournamentFingerprint(entry: Pick<TournamentArchiveEntry, 'date' | 'champion'>): string {
  return JSON.stringify({ date: entry.date, name: entry.champion.name, playerIds: [...entry.champion.playerIds].sort() })
}

export function formatTournamentDate(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}
