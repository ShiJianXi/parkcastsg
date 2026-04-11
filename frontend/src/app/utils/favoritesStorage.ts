const FAVORITES_STORAGE_KEY = 'parkcast.favoriteCarparkIds'

function parseFavoriteIds(raw: string | null): string[] {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      console.warn('[favorites] Invalid storage payload: expected an array of IDs.')
      return []
    }
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch (error) {
    console.warn('[favorites] Failed to parse favorite IDs from localStorage.', error)
    return []
  }
}

export function getFavoriteCarparkIds(): string[] {
  if (typeof window === 'undefined') return []
  return parseFavoriteIds(window.localStorage.getItem(FAVORITES_STORAGE_KEY))
}

function writeFavoriteCarparkIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids))
}

export function isFavoriteCarpark(id: string): boolean {
  return getFavoriteCarparkIds().includes(id)
}

export function toggleFavoriteCarpark(id: string): boolean {
  const current = getFavoriteCarparkIds()
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id]

  writeFavoriteCarparkIds(next)
  return next.includes(id)
}

