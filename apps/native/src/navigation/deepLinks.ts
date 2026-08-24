const WEB_ROUTE_ALIASES: Record<string, string> = {
  planner: 'plan',
  wardrobe: 'closet',
  outfits: 'lookbook',
}

const ALLOWED_WEB_ROUTES = new Set([
  'login',
  'plan',
  'closet',
  'lookbook',
  'recommend',
  'settings',
  'profile',
])

function normalizeWebPath(pathValue: string) {
  try {
    const url = new URL(pathValue, 'https://closet.native')
    if (url.origin !== 'https://closet.native') return null

    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return '/plan'

    const decodedSegments = segments.map((segment) =>
      decodeURIComponent(segment),
    )
    if (decodedSegments.some((segment) => segment === '.' || segment === '..')) {
      return null
    }

    const firstSegment = WEB_ROUTE_ALIASES[decodedSegments[0]] ?? decodedSegments[0]
    if (!ALLOWED_WEB_ROUTES.has(firstSegment)) return null

    const pathname = [firstSegment, ...decodedSegments.slice(1)]
      .map((segment) => encodeURIComponent(segment))
      .join('/')

    return `/${pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function deepLinkToWebPath(urlValue: string) {
  try {
    const url = new URL(urlValue)
    if (url.protocol !== 'closet:') return null

    if (url.hostname === 'open') {
      const path = url.searchParams.get('path')
      return path ? normalizeWebPath(path) : null
    }

    const routePath = [url.hostname, ...url.pathname.split('/').filter(Boolean)]
      .filter(Boolean)
      .join('/')

    return normalizeWebPath(`/${routePath}${url.search}${url.hash}`)
  } catch {
    return null
  }
}
