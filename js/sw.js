const CACHE_NAME = 'bcvworld-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/css/index.css',
  '/js/index.js',
  '/assets/images/logo.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return Promise.all(
          ASSETS.map(asset => {
            return fetch(asset)
              .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch ${asset}`);
                return cache.put(asset, response);
              })
              .catch(err => {
                console.log('Failed to cache:', asset, err);
              });
          })
        );
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => cachedResponse || fetch(event.request))
  );
});