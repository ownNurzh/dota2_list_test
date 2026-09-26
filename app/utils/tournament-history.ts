import { getChampion, parseTournament, type TournamentState } from './tournament.ts'

export interface TournamentArchiveEntry {
  id: string
  title: string
  date: string
  state: TournamentState
}

export const MAX_ARCHIVED_TOURNAMENTS = 100

export function isTournamentDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function parseTournamentEntry(value: unknown): TournamentArchiveEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entry = value as Record<string, unknown>
  if (typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(entry.id)) return null
  if (typeof entry.title !== 'string' || !entry.title.trim() || Array.from(entry.title.trim()).length > 80) return null
  if (!isTournamentDate(entry.date)) return null
  const state = parseTournament(entry.state)
  if (!state || !getChampion(state)) return null
  return { id: entry.id, title: entry.title.trim(), date: entry.date, state }
}

export function createTournamentEntry(state: TournamentState, title: string, date: string, id: string): TournamentArchiveEntry | null {
  // Parsing makes a detached snapshot: later edits cannot change an archived cup.
  return parseTournamentEntry({ id, title, date, state })
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

export function tournamentFingerprint(entry: Pick<TournamentArchiveEntry, 'title' | 'date' | 'state'>): string {
  const { results, ...state } = entry.state
  return JSON.stringify({ title: entry.title, date: entry.date, state, results: Object.entries(results).sort(([a], [b]) => a.localeCompare(b)) })
}

export function formatTournamentDate(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

export function tournamentFormatLabel(state: TournamentState): string {
  const playoff = state.format === 'double' ? 'Двойная сетка' : 'Одиночная сетка'
  return state.layout === 'round-robin' ? `Круговой этап + ${playoff.toLowerCase()}` : playoff
}
