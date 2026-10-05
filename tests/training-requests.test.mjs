import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest } from '../functions/api/training-requests.js'

function fakeKv() {
  const store = new Map()
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null },
    async put(key, value) { store.set(key, value) }
  }
}

function context(method, { kv = fakeKv(), body, headers = {}, ip = '192.0.2.1' } = {}) {
  return {
    env: kv ? { TRAINING_KV: kv } : {},
    request: new Request('https://ai.licheng.uk/api/training-requests', {
      method,
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  }
}

test('GET reports unconfigured without KV binding and lists stored rows otherwise', async () => {
  const unconfigured = await onRequest(context('GET', { kv: null }))
  assert.equal(unconfigured.status, 200)
  assert.deepEqual(await unconfigured.json(), { configured: false, items: [] })

  const kv = fakeKv()
  kv.store.set('idx', JSON.stringify(['a', 'b', 'gone']))
  kv.store.set('req:a', JSON.stringify({ id: 'a', t: '2026-09-28T00:00:00.000Z', c: '第一条' }))
  kv.store.set('req:b', '{broken json')
  const response = await onRequest(context('GET', { kv }))
  const data = await response.json()
  assert.equal(data.configured, true)
  assert.equal(data.total, 3)
  assert.deepEqual(data.items, [{ id: 'a', t: '2026-09-28T00:00:00.000Z', c: '第一条' }])
})

test('POST rejects cross-origin, wrong content type, oversized and too-short bodies', async () => {
  assert.equal((await onRequest(context('POST', { body: { content: '合法的内容' }, headers: { origin: 'https://evil.example' } }))).status, 403)
  assert.equal((await onRequest(context('POST', { body: { content: '合法的内容' }, headers: { 'content-type': 'text/plain' } }))).status, 415)
  assert.equal((await onRequest(context('POST', { body: { content: 'x'.repeat(3000) } }))).status, 413)
  assert.equal((await onRequest(context('POST', { body: { content: '太短' } }))).status, 400)
})

test('POST stores submission, writes index and dedupes identical content', async () => {
  const kv = fakeKv()
  const ip = '192.0.2.20'
  const first = await onRequest(context('POST', { kv, body: { content: '请问培训回放哪里可以下载？' }, ip }))
  assert.equal(first.status, 201)
  const { id } = await first.json()
  assert.equal(kv.store.get('idx'), JSON.stringify([id]))
  assert.deepEqual(JSON.parse(kv.store.get(`req:${id}`)), { id, t: JSON.parse(kv.store.get(`req:${id}`)).t, c: '请问培训回放哪里可以下载？' })

  const duplicate = await onRequest(context('POST', { kv, body: { content: '请问培训回放哪里可以下载？' }, ip }))
  assert.equal(duplicate.status, 409)
})

test('POST rate-limits per client IP after three submissions per window', async () => {
  const ip = '192.0.2.77'
  for (let index = 0; index < 3; index += 1) {
    const response = await onRequest(context('POST', { body: { content: `第${index}条不同的留言内容` }, ip }))
    assert.equal(response.status, 201)
  }
  const limited = await onRequest(context('POST', { body: { content: '第四条留言应该被限流' }, ip }))
  assert.equal(limited.status, 429)
  assert.ok(limited.headers.get('retry-after'))
})

test('unsupported methods get 405 and preflight returns 204', async () => {
  assert.equal((await onRequest(context('DELETE'))).status, 405)
  const preflight = await onRequest(context('OPTIONS'))
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS')
})
