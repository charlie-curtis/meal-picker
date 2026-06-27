const RATE_LIMIT = 100          // total requests allowed per day globally
const WINDOW_MS  = 86_400_000   // 24 hours

const ALLOWED_ORIGINS = [
  'https://justpickfood.com',
  'https://www.justpickfood.com',
]

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  }
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
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
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) })
    }

    if (await isRateLimited(env)) {
      return json({ error: 'Rate limit exceeded. Try again in a minute.' }, 429, origin)
    }

    const { pathname } = new URL(request.url)

    if (pathname === '/nearby' && request.method === 'POST') {
      const body = await request.json()
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
      const address = new URL(request.url).searchParams.get('address')
      if (!address) return json({ error: 'Missing address' }, 400, origin)
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${env.GOOGLE_PLACES_API_KEY}`
      )
      return json(await res.json(), res.status, origin)
    }

    return new Response('Not found', { status: 404, headers: corsHeaders(origin) })
  },
}
