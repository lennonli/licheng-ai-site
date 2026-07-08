const DEFAULT_HOST = 'ai.licheng.uk'
const MAX_HOURS = 24
const RANGE_OPTIONS = new Set([1, 6, 12, 24])

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return jsonResponse({}, 204)
  }

  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const configError = missingConfig(env)
  if (configError) {
    return jsonResponse({ error: configError, configured: false }, 503)
  }

  const body = request.method === 'POST' ? await readJsonBody(request) : {}
  const key = request.headers.get('x-analytics-key') || body.key || new URL(request.url).searchParams.get('key')
  if (!safeEqual(String(key || ''), String(env.ANALYTICS_ACCESS_KEY || ''))) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const url = new URL(request.url)
  const requestedRange = Number(body.rangeHours || url.searchParams.get('rangeHours') || 24)
  const rangeHours = RANGE_OPTIONS.has(requestedRange) ? requestedRange : 24
  const host = env.ANALYTICS_HOST || DEFAULT_HOST
  const now = new Date()
  const end = now.toISOString()
  const start = new Date(now.getTime() - Math.min(rangeHours, MAX_HOURS) * 60 * 60 * 1000).toISOString()

  const payload = await queryCloudflareAnalytics({
    apiToken: env.CLOUDFLARE_ANALYTICS_API_TOKEN || env.CLOUDFLARE_API_TOKEN,
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

  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      query,
      variables: {
        zoneTag: zoneId,
        host,
        start,
        end
      }
    })
  })

  const json = await response.json()
  if (!response.ok || json.errors) {
    return {
      errors: json.errors || [{ message: `Cloudflare API responded with ${response.status}` }]
    }
  }

  return json.data?.viewer?.zones?.[0] || {}
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
  if (!env.CLOUDFLARE_ANALYTICS_API_TOKEN && !env.CLOUDFLARE_API_TOKEN) {
    missing.push('CLOUDFLARE_ANALYTICS_API_TOKEN')
  }
  if (!env.CLOUDFLARE_ZONE_ID) missing.push('CLOUDFLARE_ZONE_ID')
  return missing.length ? `Missing runtime secrets: ${missing.join(', ')}` : ''
}

async function readJsonBody(request) {
  try {
    return await request.json()
  } catch {
    return {}
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

function jsonResponse(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  })
}
