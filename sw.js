/* 训练中枢 · Service Worker
 * ------------------------------------------------------------------
 * 策略：
 *   HTML / 导航  → network-first
 *       有网时永远拿最新版本，离线时回退缓存。
 *       这样"改完页面"不再依赖手动改版本号，从根上消除内容陈旧问题。
 *   静态资源      → stale-while-revalidate
 *       先给缓存（快），后台同时拉新并更新缓存。
 *
 * CACHE 版本号只在"缓存结构本身变了"（例如增删了预缓存列表）时才需要改。
 */
const CACHE = 'zx-v28';
const CORE = ['./', 'index.html', '训练中枢.html', 'manifest.json', 'icon.svg', 'icon-192.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return Promise.allSettled(CORE.map(function (u) { return c.add(u); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

function isHTML(req) {
  return req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0;
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isHTML(req)) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          const c = res.clone();
          caches.open(CACHE).then(function (x) { x.put(req, c); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('index.html'); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (cached) {
      const net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          const c = res.clone();
          caches.open(CACHE).then(function (x) { x.put(req, c); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
