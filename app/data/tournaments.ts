import type { TournamentArchiveEntry } from '../utils/tournament-history'

/**
 * История чемпионов, доступная всем посетителям сайта.
 * Для нового турнира добавьте уникальный id, дату YYYY-MM-DD и победителя.
 * champion.name — название команды, champion.playerIds — ID её игроков из players.ts.
 */
export const tournaments: TournamentArchiveEntry[] = [
  {
    id: 't1',
    date: '2026-09-26',
    champion: { name: 'Daiteris', playerIds: ['p5', 'p34', 'p33', 'p21', 'p35'] },
  },
  {
    id: 't2',
    date: '2026-09-27',
    champion: { name: 'Avengers', playerIds: ['p12', 'p34', 'p4', 'p21', 'p25'] },
  },
]
