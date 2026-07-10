import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest } from '../functions/api/site-analytics.js'

const env = {
  ANALYTICS_ACCESS_KEY: 'a-strong-test-key',
  CLOUDFLARE_ANALYTICS_API_TOKEN: 'test-token',
  CLOUDFLARE_ZONE_ID: 'test-zone',
  ANALYTICS_HOST: 'ai.licheng.uk'
}

function context(method, key = '', ip = '192.0.2.1', body = { rangeHours: 24 }, query = '') {
  return {
    env,
    request: new Request(`https://ai.licheng.uk/api/site-analytics${query}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-analytics-key': key, 'cf-connecting-ip': ip },
      body: method === 'POST' ? JSON.stringify(body) : undefined
    })
  }
}

test('analytics API rejects GET and does not accept query credentials', async () => {
  const response = await onRequest(context('GET', '', '192.0.2.1', {}, '?key=a-strong-test-key'))
  assert.equal(response.status, 405)
})

test('analytics API accepts credentials only in the request header', async () => {
  const response = await onRequest(context('POST', '', '192.0.2.2', { key: env.ANALYTICS_ACCESS_KEY }))
  assert.equal(response.status, 401)
})

test('analytics API rejects oversized request bodies', async () => {
  const response = await onRequest(context('POST', env.ANALYTICS_ACCESS_KEY, '192.0.2.3', { value: 'x'.repeat(3000) }))
  assert.equal(response.status, 413)
})

test('analytics API rate-limits repeated invalid credentials', async () => {
  const ip = '192.0.2.55'
  for (let index = 0; index < 5; index += 1) {
    const response = await onRequest(context('POST', 'wrong', ip))
    assert.equal(response.status, 401)
  }
  const limited = await onRequest(context('POST', 'wrong', ip))
  assert.equal(limited.status, 429)
  assert.ok(Number(limited.headers.get('retry-after')) > 0)
})

test('analytics preflight declares only POST', async () => {
  const response = await onRequest(context('OPTIONS'))
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS')
})
