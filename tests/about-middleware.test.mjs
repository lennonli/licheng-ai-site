import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest } from '../functions/_middleware.js'

function makeContext(url, method = 'GET') {
  const fetched = []
  let nextCalled = false
  return {
    fetched,
    wasNextCalled: () => nextCalled,
    context: {
      request: new Request(url, { method }),
      env: {
        ASSETS: {
          fetch: async (req) => {
            fetched.push(new URL(req.url).pathname)
            return new Response('ok', { status: 200 })
          }
        }
      },
      next: async () => {
        nextCalled = true
        return new Response('next', { status: 200 })
      }
    }
  }
}

test('ai.licheng.uk passes through middleware untouched', async () => {
  const harness = makeContext('https://ai.licheng.uk/about/')
  const res = await onRequest(harness.context)
  assert.equal(res.status, 200)
  assert.equal(harness.wasNextCalled(), true)
  assert.deepEqual(harness.fetched, [])
})

test('about.licheng.uk maps root and static assets to /about/*', async () => {
  for (const [input, expected] of [
    ['https://about.licheng.uk/', '/about/'],
    ['https://about.licheng.uk/style.css', '/about/style.css'],
    ['https://about.licheng.uk/site.js', '/about/site.js'],
    ['https://about.licheng.uk/robots.txt', '/about/robots.txt'],
    ['https://about.licheng.uk/assets/display.woff2', '/about/assets/display.woff2'],
    ['https://about.licheng.uk/wechat-li-cheng.jpg', '/about/assets/wechat-li-cheng.jpg']
  ]) {
    const harness = makeContext(input)
    const res = await onRequest(harness.context)
    assert.equal(res.status, 200)
    assert.deepEqual(harness.fetched, [expected])
  }
})

test('about.licheng.uk canonicalizes /about/ and www subdomain with 301', async () => {
  const aboutPath = makeContext('https://about.licheng.uk/about/')
  const res1 = await onRequest(aboutPath.context)
  assert.equal(res1.status, 301)
  assert.equal(res1.headers.get('location'), 'https://about.licheng.uk/')

  const wwwHost = makeContext('https://www.about.licheng.uk/')
  const res2 = await onRequest(wwwHost.context)
  assert.equal(res2.status, 301)
  assert.equal(res2.headers.get('location'), 'https://about.licheng.uk/')
})

test('about.licheng.uk rejects non-GET/HEAD methods and unknown routes', async () => {
  const postRes = await onRequest(makeContext('https://about.licheng.uk/', 'POST').context)
  assert.equal(postRes.status, 405)

  const unknownRes = await onRequest(makeContext('https://about.licheng.uk/api/site-analytics').context)
  assert.equal(unknownRes.status, 404)
})
