// WeChat/QQ in-app webviews capture document.title on first page load and do
// not re-read it during SPA navigation, so forwarded link cards keep showing
// the entry page's title. Force a refresh after every title change.
(function () {
  if (!/(MicroMessenger|wxwork)/i.test(navigator.userAgent)) return;

  var last = '';

  function viaBridge(title) {
    if (!window.WeixinJSBridge || !window.WeixinJSBridge.invoke) return false;
    try {
      window.WeixinJSBridge.invoke('setDocumentTitle', { title: title });
      return true;
    } catch (e) {
      return false;
    }
  }

  function refresh(title) {
    last = title;
    document.title = title;
    if (viaBridge(title)) return;
    var f = document.createElement('iframe');
    f.src = '/favicon.svg';
    f.style.display = 'none';
    var done = function () { if (f.parentNode) f.parentNode.removeChild(f); };
    f.onload = done;
    f.onerror = done;
    (document.body || document.documentElement).appendChild(f);
  }

  document.addEventListener('WeixinJSBridgeReady', function () {
    if (document.title && document.title !== last) refresh(document.title);
  }, false);

  new MutationObserver(function () {
    var t = document.title;
    if (t && t !== last) refresh(t);
  }).observe(document.head, { subtree: true, childList: true, characterData: true });
})();
