import {
  buildBracket,
  changeTournamentFormat,
  createTournament,
  getChampion,
  getTournamentMatchCount,
  parseTournament,
  renameTeam,
  resetResults,
  resizeTournament,
  setMatchWinner,
  setTeamPlayers,
  shuffleTeams,
  type TournamentFormat,
  type TournamentSize,
  type TournamentState,
} from '~/utils/tournament'

const storageKey = 'dota-community-tournament-v1'

export function useTournament() {
  const state = useState<TournamentState>('lobby-tournament', () => createTournament(6))
  const ready = useState<boolean>('lobby-tournament-ready', () => false)
  const storageAvailable = useState<boolean>('lobby-tournament-storage', () => true)
  const { save, historyError } = useTournamentHistory()
  const archivedId = ref<string | null>(null)

  onMounted(() => {
    if (ready.value) return

    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const restored = parseTournament(JSON.parse(saved))
        if (restored) state.value = restored
      }
    } catch {
      // A blocked store or malformed saved bracket must not prevent playing.
      storageAvailable.value = false
    }

    ready.value = true
  })

  function apply(next: TournamentState) {
    if (!ready.value || next === state.value) return
    state.value = next
    archivedId.value = null

    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      storageAvailable.value = true
    } catch {
      storageAvailable.value = false
    }
  }

  const rounds = computed(() => buildBracket(state.value))
  const champion = computed(() => getChampion(state.value))
  const completedMatches = computed(() => rounds.value.flatMap(round => round.matches)
    .filter(match => match.status === 'complete').length)
  const totalMatches = computed(() => getTournamentMatchCount(state.value))
  const hasResults = computed(() => Object.keys(state.value.results).length > 0)

  return {
    state,
    ready,
    storageAvailable,
    rounds,
    champion,
    completedMatches,
    totalMatches,
    hasResults,
    archivedId,
    archiveError: historyError,
    archive: (title: string, date: string) => {
      archivedId.value = save(state.value, title, date)
      return Boolean(archivedId.value)
    },
    chooseWinner: (matchId: string, winnerId: string | null) => apply(setMatchWinner(state.value, matchId, winnerId)),
    rename: (id: string, name: string) => apply(renameTeam(state.value, id, name)),
    setRoster: (id: string, playerIds: string[]) => apply(setTeamPlayers(state.value, id, playerIds)),
    resize: (size: TournamentSize) => apply(resizeTournament(state.value, size)),
    changeFormat: (format: TournamentFormat) => apply(changeTournamentFormat(state.value, format)),
    shuffle: () => apply(shuffleTeams(state.value)),
    reset: () => apply(resetResults(state.value)),
  }
}
