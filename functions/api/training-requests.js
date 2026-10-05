const MAX_ITEMS = 800
const KV_GET_BATCH = 50
const MAX_BODY_BYTES = 2048
const MIN_CONTENT = 6
const MAX_CONTENT = 500
const WINDOW_MS = 10 * 60 * 1000
const MAX_POSTS_PER_WINDOW = 3
const postTimestamps = new Map()

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...extra } })
}

async function readJsonBody(request) {
  // 先看声明的 Content-Length，超限直接拒绝，避免为超大请求体缓冲内存
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > MAX_BODY_BYTES) return { tooLarge: true, data: {} }
  const raw = await request.text()
  // 按字节而非字符数计：中文内容一个字符占 3 个 UTF-8 字节
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return { tooLarge: true, data: {} }
  try {
    const data = JSON.parse(raw)
    return { tooLarge: false, data: data && typeof data === 'object' && !Array.isArray(data) ? data : {} }
  } catch { return { tooLarge: false, data: {} } }
}

function limited(ip) {
  const now = Date.now()
  const marks = (postTimestamps.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  if (marks.length >= MAX_POSTS_PER_WINDOW) return true
  marks.push(now)
  postTimestamps.set(ip, marks)
  if (postTimestamps.size > 5000) postTimestamps.clear()
  return false
}

async function contentHash(text, ip) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text + '|' + ip))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

async function readIndex(kv) {
  const raw = await kv.get('idx')
  try { const arr = JSON.parse(raw || '[]'); return Array.isArray(arr) ? arr : [] } catch { return [] }
}

async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' } })
  }

  const kv = env.TRAINING_KV
  if (!kv) {
    if (request.method === 'GET') return json({ configured: false, items: [] })
    return json({ error: 'Storage is not configured yet', configured: false }, 503)
  }

  if (request.method === 'GET') {
    const ids = await readIndex(kv)
    const items = []
    // 分批并行读取，避免条目多时逐条串行 await 拖慢响应、逼近子请求时限
    const wanted = ids.slice(0, MAX_ITEMS)
    for (let offset = 0; offset < wanted.length; offset += KV_GET_BATCH) {
      const rows = await Promise.all(wanted.slice(offset, offset + KV_GET_BATCH).map((id) => kv.get(`req:${id}`)))
      for (const raw of rows) {
        if (!raw) continue
        try {
          const row = JSON.parse(raw)
          items.push({ id: row.id, t: row.t, c: row.c })
        } catch { /* skip malformed row */ }
      }
    }
    return json({ configured: true, total: ids.length, items })
  }

  if (request.method === 'POST') {
    const origin = request.headers.get('origin')
    if (origin && origin !== url.origin) return json({ error: 'Origin not allowed' }, 403)
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return json({ error: 'Expected application/json' }, 415)
    }
    const ip = request.headers.get('cf-connecting-ip') || 'unknown'
    if (limited(ip)) return json({ error: 'Too many requests' }, 429, { 'retry-after': '600' })

    const body = await readJsonBody(request)
    if (body.tooLarge) return json({ error: 'Request body too large' }, 413)

    const content = (typeof body.data.content === 'string' ? body.data.content : '').trim().replace(/\s+/g, ' ')
    if (content.length < MIN_CONTENT) return json({ error: '内容太短，请至少写 6 个字' }, 400)
    if (content.length > MAX_CONTENT) return json({ error: '内容超过 500 字上限' }, 400)

    const hash = await contentHash(content, ip)
    const dup = await kv.get(`d:${hash}`)
    if (dup) return json({ error: '短时间内已提交过相同内容' }, 409)

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const record = { id, t: new Date().toISOString(), c: content }

    const ids = await readIndex(kv)
    ids.unshift(id)
    const trimmed = ids.slice(0, 1000)

    await kv.put(`req:${id}`, JSON.stringify(record))
    await kv.put('idx', JSON.stringify(trimmed))
    await kv.put(`d:${hash}`, '1', { expirationTtl: 24 * 3600 })

    return json({ ok: true, id }, 201)
  }

  return json({ error: 'Method not allowed' }, 405)
}

export { onRequest }
