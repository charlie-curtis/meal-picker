const RATE_LIMIT = 100          // total requests allowed per day globally
const WINDOW_MS  = 86_400_000   // 24 hours

const ALLOWED_ORIGINS = [
  'https://justpickfood.com',
  'https://www.justpickfood.com',
]

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin)
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  }
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

function isValidRoute(pathname, method) {
  return (pathname === '/nearby' && method === 'POST') ||
         (pathname === '/geocode' && method === 'GET')
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function sanitizedNearbyBody(body) {
  const circle = body?.locationRestriction?.circle
  const center = circle?.center
  const latitude = center?.latitude
  const longitude = center?.longitude
  const radius = circle?.radius
  const maxResultCount = body?.maxResultCount ?? 20

  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Invalid latitude')
  }
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Invalid longitude')
  }
  if (!isFiniteNumber(radius) || radius <= 0 || radius > 16093.4) {
    throw new Error('Invalid radius')
  }
  if (!Number.isInteger(maxResultCount) || maxResultCount < 1 || maxResultCount > 20) {
    throw new Error('Invalid result count')
  }

  return {
    includedTypes: ['restaurant'],
    maxResultCount,
    locationRestriction: {
      circle: {
        center: { latitude, longitude },
        radius,
      },
    },
  }
}

// Global daily cap — limits total spend regardless of who is calling.
// KV has eventual consistency so two simultaneous requests can both slip
// through, but worst case is a small overage, not unbounded spend.
async function isRateLimited(env) {
  const key = `global:${Math.floor(Date.now() / WINDOW_MS)}`
  const count = parseInt(await env.RATE_LIMIT_KV.get(key) ?? '0')
  if (count >= RATE_LIMIT) return true
  await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: 172800 })
  return false
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? ''

    if (!isAllowedOrigin(origin)) {
      return json({ error: 'Forbidden' }, 403, origin)
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) })
    }

    const { pathname, searchParams } = new URL(request.url)
    if (!isValidRoute(pathname, request.method)) {
      return json({ error: 'Not found' }, 404, origin)
    }

    if (pathname === '/nearby' && request.method === 'POST') {
      let body
      try {
        body = sanitizedNearbyBody(await request.json())
      } catch {
        return json({ error: 'Invalid nearby search request' }, 400, origin)
      }
      if (await isRateLimited(env)) {
        return json({ error: 'Rate limit exceeded. Try again in a minute.' }, 429, origin)
      }
      const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.id',
        },
        body: JSON.stringify(body),
      })
      return json(await res.json(), res.status, origin)
    }

    if (pathname === '/geocode' && request.method === 'GET') {
      const address = searchParams.get('address')?.trim()
      if (!address) return json({ error: 'Missing address' }, 400, origin)
      if (await isRateLimited(env)) {
        return json({ error: 'Rate limit exceeded. Try again in a minute.' }, 429, origin)
      }
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${env.GOOGLE_PLACES_API_KEY}`
      )
      return json(await res.json(), res.status, origin)
    }
  },
}
