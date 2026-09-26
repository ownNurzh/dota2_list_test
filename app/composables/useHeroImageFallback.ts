/** Capture the deployment base in setup, before a later image error event. */
export function useHeroImageFallback() {
  const baseURL = useRuntimeConfig().app.baseURL
  const fallbackSource = `${baseURL.endsWith('/') ? baseURL : `${baseURL}/`}images/hero-fallback.svg`

  return (event: Event) => {
    const image = event.target as HTMLImageElement | null
    if (!image || image.getAttribute('src') === fallbackSource) return

    image.src = fallbackSource
    image.alt = 'Dota 2 — изображение недоступно'
  }
}
