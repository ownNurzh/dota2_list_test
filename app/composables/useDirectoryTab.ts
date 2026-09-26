export type DirectoryTab = 'players' | 'ranking' | 'favorites'

/** Static HTML always starts on the roster; apply query tabs after hydration. */
export function useDirectoryTab() {
  const route = useRoute()
  const ready = useState<boolean>('directory-tabs-ready', () => false)

  onMounted(() => { ready.value = true })

  return computed<DirectoryTab>(() => {
    if (!ready.value) return 'players'
    if (route.query.tab === 'ranking') return 'ranking'
    if (route.query.tab === 'favorites') return 'favorites'
    return 'players'
  })
}
