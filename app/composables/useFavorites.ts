export function useFavorites() {
  const favorites = useState<string[]>('favorite-players', () => [])
  const initialized = useState('favorites-initialized', () => false)
  onMounted(() => {
    if (initialized.value) return
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('dota-community-favorites') || '[]')
      if (Array.isArray(saved)) favorites.value = saved.filter((id): id is string => typeof id === 'string')
    } catch { /* An unavailable browser store should not block the directory. */ }
    initialized.value = true
  })
  function toggleFavorite(id: string) {
    favorites.value = favorites.value.includes(id) ? favorites.value.filter(item => item !== id) : [...favorites.value, id]
    try { localStorage.setItem('dota-community-favorites', JSON.stringify(favorites.value)) } catch { /* In-memory favorites remain usable. */ }
  }
  return { favorites, isFavorite: (id: string) => favorites.value.includes(id), toggleFavorite }
}
