const ABOUT_HOSTS = new Set(['about.licheng.uk', 'www.about.licheng.uk'])

const EXACT_REWRITES = new Map([
  ['/', '/about/'],
  ['/style.css', '/about/style.css'],
  ['/site.js', '/about/site.js'],
  ['/robots.txt', '/about/robots.txt'],
  ['/wechat-li-cheng.jpg', '/about/assets/wechat-li-cheng.jpg']
])

export async function onRequest(context) {
  const { request, env, next } = context
  const url = new URL(request.url)

  if (!ABOUT_HOSTS.has(url.hostname)) {
    return next()
  }

  if (url.hostname === 'www.about.licheng.uk') {
    const canonical = new URL(request.url)
    canonical.hostname = 'about.licheng.uk'
    return Response.redirect(canonical.toString(), 301)
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { allow: 'GET, HEAD' }
    })
  }

  if (
    url.pathname === '/index.html' ||
    url.pathname === '/about' ||
    url.pathname === '/about/' ||
    url.pathname === '/about/index.html'
  ) {
    const rootUrl = new URL(`/${url.search}`, url.origin)
    return Response.redirect(rootUrl.toString(), 301)
  }

  let mappedPath = EXACT_REWRITES.get(url.pathname)
  if (!mappedPath && url.pathname.startsWith('/assets/') && !url.pathname.includes('..')) {
    mappedPath = `/about${url.pathname}`
  }

  if (!mappedPath) {
    return new Response(
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>404｜李成律师</title><p>页面不存在，请访问 <a href="/">个人主页</a> 或 <a href="https://ai.licheng.uk/">法律 AI 工作站</a>。</p></html>',
      {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      }
    )
  }

  const targetUrl = new URL(mappedPath + url.search, url.origin)
  return env.ASSETS.fetch(new Request(targetUrl, request))
}
