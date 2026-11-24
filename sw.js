// Offline support + installability. Same-origin files are fetched fresh when
// online (so updates appear right away) and served from cache when offline.
const CACHE = 'old-possum-v12';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/scene.css',
  'js/main.js', 'js/store.js', 'js/timer.js', 'js/util.js', 'js/sound.js', 'js/coats.js', 'js/room.js', 'js/pip.js',
  'js/planner.js', 'js/ui/planner-view.js', 'js/ui/session.js', 'js/ui/stats.js', 'js/ui/settings.js', 'js/ui/toast.js',
  'js/scene/scene.js', 'js/scene/art.js', 'js/cards.js', 'js/ui/cards-view.js', 'js/pig.js', 'js/ui/pig-view.js', 'js/notes-sort.js', 'js/claude-sort.js', 'js/native.js', 'js/mac-sort.js',
  'assets/art/possum-writing.svg', 'assets/art/possum-snout.svg', 'assets/art/possum-paw.svg', 'assets/art/paw.svg', 'assets/art/cat-writing.svg', 'assets/art/vault.svg',
  'assets/art/margins/top-left.png', 'assets/art/margins/top-right.png', 'assets/art/margins/bottom-left.png', 'assets/art/margins/bottom-sprig.png',
  'assets/icons/favicon.svg', 'assets/icons/mark.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const put = (req, res) => {
  if (res.ok || res.type === 'opaque') {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => put(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
    );
    return;
  }
  // Fonts and the (version-pinned) buddy-room library rarely change: cache first.
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$|^cdn\.jsdelivr\.net$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
  }
});
