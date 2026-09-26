import { tournaments } from '~/data/tournaments'
import {
  createTournamentEntry, MAX_ARCHIVED_TOURNAMENTS, parseTournamentHistory,
  tournamentFingerprint, type TournamentArchiveEntry,
} from '~/utils/tournament-history'
import type { TournamentState } from '~/utils/tournament'

const storageKey = 'dota-community-tournament-history-v1'
const publishedEntries = parseTournamentHistory(tournaments)

export function useTournamentHistory() {
  const localEntries = useState<TournamentArchiveEntry[]>('tournament-history', () => [])
  const historyReady = useState('tournament-history-ready', () => false)
  const historyError = useState('tournament-history-error', () => '')

  onMounted(() => {
    if (historyReady.value) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const raw: unknown = JSON.parse(saved)
        localEntries.value = parseTournamentHistory(raw)
        if (!Array.isArray(raw) || localEntries.value.length !== raw.length) historyError.value = 'Часть сохранённой истории повреждена и не может быть открыта.'
      }
    } catch {
      historyError.value = 'Не удалось открыть историю этого браузера.'
    }
    historyReady.value = true
  })

  const publishedIds = new Set(publishedEntries.map(entry => entry.id))
  const entries = computed(() => [
    ...publishedEntries.map(entry => ({ ...entry, source: 'published' as const })),
    ...localEntries.value.filter(entry => !publishedIds.has(entry.id)).map(entry => ({ ...entry, source: 'local' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)))

  function save(state: TournamentState, title: string, date: string): string | null {
    historyError.value = ''
    if (!historyReady.value) return null
    const id = `cup-${crypto.randomUUID()}`
    const entry = createTournamentEntry(state, title, date, id)
    if (!entry) {
      historyError.value = 'Заверши турнир и укажи название (до 80 символов) и корректную дату.'
      return null
    }
    const fingerprint = tournamentFingerprint(entry)
    const existing = entries.value.find(item => tournamentFingerprint(item) === fingerprint)
    if (existing) return existing.id
    if (localEntries.value.length >= MAX_ARCHIVED_TOURNAMENTS) {
      historyError.value = 'История заполнена: скачай нужные записи и удали старые, чтобы сохранить новый турнир.'
      return null
    }
    const next = [entry, ...localEntries.value]
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      localEntries.value = next
      return entry.id
    } catch {
      historyError.value = 'Браузер не разрешил сохранить историю. Проверь свободное место и настройки хранения.'
      return null
    }
  }

  function remove(id: string): boolean {
    const next = localEntries.value.filter(entry => entry.id !== id)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      localEntries.value = next
      historyError.value = ''
      return true
    } catch {
      historyError.value = 'Не удалось изменить историю в этом браузере.'
      return false
    }
  }

  function download(entry: TournamentArchiveEntry) {
    const { id, title, date, state } = entry
    const url = URL.createObjectURL(new Blob([JSON.stringify({ id, title, date, state }, null, 2)], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${id}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return { entries, localEntries, historyReady, historyError, save, remove, download }
}
