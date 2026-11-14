/**
 * Miras Platform - Progressive Web App Service Worker
 * مخزن الخدمة والتشغيل عند انقطاع الإنترنت لمنصة مِـرَاس (حضرموت)
 */

const CACHE_NAME = 'miras-app-shell-v1';

const STATIC_SHELL_ASSETS = [
  './',
  './index.html',
  './explore.html',
  './support.html',
  './offline.html',
  './manifest.webmanifest',
  './assets/logo.png',
  './supabase/config.js',
  './supabase/auth-router.js',
  './supabase/miras-api.js',
  './js/pwa-helper.js'
];

// 1. Install Event: Cache Core Static Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network-First with Offline Fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // لا نقوم بتخزين طلبات المصادقة الحساسة وكلمات المرور في Cache مطلقاً
  if (url.pathname.includes('/auth/v1') || req.method !== 'GET') {
    return;
  }

  // لصفحات التنقل (HTML Navigation Requests): نحاول الشبكة أولاً، وعند الفشل نعود للكاش أو صفحة offline.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cachedResp = await caches.match(req);
        if (cachedResp) return cachedResp;
        return caches.match('./offline.html');
      })
    );
    return;
  }

  // للملفات الثابتة والصور: Cache First with Network Revalidation
  if (
    url.origin === location.origin &&
    (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.webmanifest'))
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((networkRes) => {
          if (networkRes.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(req, networkRes.clone()));
          }
          return networkRes;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // لبقية الطلبات العادية
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

