const DEFAULT_HOST = 'ai.licheng.uk'
const MAX_HOURS = 24
const RANGE_OPTIONS = new Set([1, 6, 12, 24])
const MAX_FAILED_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const MAX_BODY_BYTES = 2048
const failedAttempts = new Map()

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return jsonResponse({}, 204, {
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, x-analytics-key'
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const configError = missingConfig(env)
  if (configError) {
    return jsonResponse({ error: configError, configured: false }, 503)
  }

  const clientId = request.headers.get('cf-connecting-ip') || 'unknown'
  const limited = rateLimitStatus(clientId)
  if (limited) return jsonResponse({ error: 'Too many attempts' }, 429, { 'retry-after': String(limited) })

  const parsedBody = await readJsonBody(request)
  if (parsedBody.tooLarge) return jsonResponse({ error: 'Request body too large' }, 413)
  const body = parsedBody.data
  const key = request.headers.get('x-analytics-key')
  if (!safeEqual(String(key || ''), String(env.ANALYTICS_ACCESS_KEY || ''))) {
    recordFailedAttempt(clientId)
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  failedAttempts.delete(clientId)

  const requestedRange = Number(body.rangeHours || 24)
  const rangeHours = RANGE_OPTIONS.has(requestedRange) ? requestedRange : 24
  const host = env.ANALYTICS_HOST || DEFAULT_HOST
  const now = new Date()
  const end = now.toISOString()
  const start = new Date(now.getTime() - Math.min(rangeHours, MAX_HOURS) * 60 * 60 * 1000).toISOString()

  const payload = await queryCloudflareAnalytics({
    apiToken: env.CLOUDFLARE_ANALYTICS_API_TOKEN,
    zoneId: env.CLOUDFLARE_ZONE_ID,
    host,
    start,
    end
  })

  return jsonResponse(normalizeAnalytics(payload, { host, start, end, rangeHours }))
}

async function queryCloudflareAnalytics({ apiToken, zoneId, host, start, end }) {
  const query = `query SiteAnalytics($zoneTag:String!, $host:String!, $start:Time!, $end:Time!) {
    viewer {
      zones(filter:{zoneTag:$zoneTag}) {
        totals:httpRequestsAdaptiveGroups(
          limit:1,
          filter:{datetime_geq:$start, datetime_leq:$end, clientRequestHTTPHost:$host}
        ) {
          count
          sum { visits edgeRequestBytes edgeResponseBytes }
        }
        byPath:httpRequestsAdaptiveGroups(
          limit:25,
          filter:{datetime_geq:$start, datetime_leq:$end, clientRequestHTTPHost:$host},
          orderBy:[count_DESC]
        ) {
          count
          sum { visits }
          dimensions { clientRequestPath }
        }
        byCountry:httpRequestsAdaptiveGroups(
          limit:10,
          filter:{datetime_geq:$start, datetime_leq:$end, clientRequestHTTPHost:$host},
          orderBy:[count_DESC]
        ) {
          count
          dimensions { clientCountryName }
        }
        byDevice:httpRequestsAdaptiveGroups(
          limit:8,
          filter:{datetime_geq:$start, datetime_leq:$end, clientRequestHTTPHost:$host},
          orderBy:[count_DESC]
        ) {
          count
          dimensions { clientDeviceType }
        }
        byBrowser:httpRequestsAdaptiveGroups(
          limit:8,
          filter:{datetime_geq:$start, datetime_leq:$end, clientRequestHTTPHost:$host},
          orderBy:[count_DESC]
        ) {
          count
          dimensions { userAgentBrowser }
        }
        byCache:httpRequestsAdaptiveGroups(
          limit:8,
          filter:{datetime_geq:$start, datetime_leq:$end, clientRequestHTTPHost:$host},
          orderBy:[count_DESC]
        ) {
          count
          dimensions { cacheStatus }
        }
        timeline:httpRequestsAdaptiveGroups(
          limit:24,
          filter:{datetime_geq:$start, datetime_leq:$end, clientRequestHTTPHost:$host},
          orderBy:[datetimeHour_ASC]
        ) {
          count
          sum { visits }
          dimensions { datetimeHour }
        }
      }
    }
  }`

  try {
    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query,
        variables: { zoneTag: zoneId, host, start, end }
      })
    })
    const json = await response.json()
    if (!response.ok || json.errors) {
      return {
        errors: json.errors || [{ message: `Cloudflare API responded with ${response.status}` }]
      }
    }
    return json.data?.viewer?.zones?.[0] || {}
  } catch {
    return {
      errors: [{ message: 'Cloudflare analytics service is temporarily unavailable' }]
    }
  }
}

function normalizeAnalytics(zoneData, meta) {
  if (zoneData.errors) {
    return {
      error: zoneData.errors.map((item) => item.message).join('; '),
      configured: true,
      meta
    }
  }

  const totals = zoneData.totals?.[0] || { count: 0, sum: {} }
  const topPathsRaw = normalizeList(zoneData.byPath || [], 'clientRequestPath')
  const topPages = topPathsRaw
    .filter((item) => isLikelyPagePath(item.label))
    .slice(0, 10)
  const byCache = normalizeList(zoneData.byCache || [], 'cacheStatus')
  const cachedRequests = byCache
    .filter((item) => ['hit', 'stale', 'revalidated', 'updating'].includes(item.label.toLowerCase()))
    .reduce((sum, item) => sum + item.count, 0)

  return {
    configured: true,
    meta: {
      ...meta,
      generatedAt: new Date().toISOString(),
      source: 'Cloudflare GraphQL Analytics API'
    },
    totals: {
      requests: totals.count || 0,
      visits: totals.sum?.visits || 0,
      requestBytes: totals.sum?.edgeRequestBytes || 0,
      responseBytes: totals.sum?.edgeResponseBytes || 0,
      cacheRatio: totals.count ? cachedRequests / totals.count : 0
    },
    topPages,
    topPathsRaw: topPathsRaw.slice(0, 12),
    byCountry: normalizeList(zoneData.byCountry || [], 'clientCountryName'),
    byDevice: normalizeList(zoneData.byDevice || [], 'clientDeviceType'),
    byBrowser: normalizeList(zoneData.byBrowser || [], 'userAgentBrowser'),
    byCache,
    timeline: (zoneData.timeline || []).map((item) => ({
      time: item.dimensions?.datetimeHour || '',
      requests: item.count || 0,
      visits: item.sum?.visits || 0
    }))
  }
}

function normalizeList(items, dimensionName) {
  return items
    .map((item) => ({
      label: normalizeLabel(item.dimensions?.[dimensionName]),
      count: item.count || 0,
      visits: item.sum?.visits || 0
    }))
    .filter((item) => item.count > 0)
}

function normalizeLabel(value) {
  if (value === undefined || value === null || value === '') return 'Unknown'
  return String(value)
}

function isLikelyPagePath(path) {
  if (!path || path === 'Unknown') return false
  if (path.startsWith('/cdn-cgi/')) return false
  if (path.includes('/assets/')) return false
  if (path.includes('/@vite/')) return false
  if (path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.map')) return false
  if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.webp')) return false
  if (path.endsWith('.svg') || path.endsWith('.ico') || path.endsWith('.woff2')) return false
  return true
}

function missingConfig(env) {
  const missing = []
  if (!env.ANALYTICS_ACCESS_KEY) missing.push('ANALYTICS_ACCESS_KEY')
  if (!env.CLOUDFLARE_ANALYTICS_API_TOKEN) missing.push('CLOUDFLARE_ANALYTICS_API_TOKEN')
  if (!env.CLOUDFLARE_ZONE_ID) missing.push('CLOUDFLARE_ZONE_ID')
  return missing.length ? `Missing runtime secrets: ${missing.join(', ')}` : ''
}

async function readJsonBody(request) {
  try {
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return { data: {}, tooLarge: true }
    }
    return { data: text ? JSON.parse(text) : {}, tooLarge: false }
  } catch {
    return { data: {}, tooLarge: false }
  }
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function rateLimitStatus(clientId) {
  const now = Date.now()
  const entry = failedAttempts.get(clientId)
  if (!entry || now - entry.startedAt >= ATTEMPT_WINDOW_MS) {
    failedAttempts.delete(clientId)
    return 0
  }
  if (entry.count < MAX_FAILED_ATTEMPTS) return 0
  return Math.max(1, Math.ceil((ATTEMPT_WINDOW_MS - (now - entry.startedAt)) / 1000))
}

function recordFailedAttempt(clientId) {
  const now = Date.now()
  if (failedAttempts.size > 1000) {
    for (const [key, value] of failedAttempts) {
      if (now - value.startedAt >= ATTEMPT_WINDOW_MS) failedAttempts.delete(key)
    }
    if (failedAttempts.size > 1000) failedAttempts.delete(failedAttempts.keys().next().value)
  }
  const entry = failedAttempts.get(clientId)
  if (!entry || now - entry.startedAt >= ATTEMPT_WINDOW_MS) {
    failedAttempts.set(clientId, { count: 1, startedAt: now })
    return
  }
  entry.count += 1
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  })
}
