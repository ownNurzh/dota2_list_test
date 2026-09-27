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
    champion: { name: 'Daiteris', playerIds: ['p1', 'p2', 'p3'] },
  },
]
