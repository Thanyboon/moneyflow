// MoneyFlow Service Worker
// Offline app shell, not offline financial data

const CACHE_NAME = "moneyflow-shell-v1";
const APP_PATH = "/moneyflow/";

const PRECACHE = [
  APP_PATH,
  APP_PATH + "index.html",
  APP_PATH + "manifest.webmanifest",
  APP_PATH + "icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache แต่ละไฟล์โดยไม่ให้ไฟล์หนึ่งที่ผิดพลาด
      // ทำให้การติดตั้ง Service Worker ล้มเหลวทั้งหมด
      await Promise.allSettled(
        PRECACHE.map(url => cache.add(url))
      );
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith("moneyflow-shell-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// ห้าม Cache ข้อมูล Google และ OAuth
function isPrivateRequest(url) {
  return (
    url.hostname === "sheets.googleapis.com" ||
    url.hostname === "accounts.google.com" ||
    url.hostname === "oauth2.googleapis.com" ||
    url.hostname === "www.googleapis.com" ||
    url.hostname === "script.google.com"
  );
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (isPrivateRequest(url)) return;

  // ไม่แตะคำขอข้ามโดเมน
  if (url.origin !== self.location.origin) {
    return;
  }

  // ทำงานเฉพาะภายใน /moneyflow/
  if (!url.pathname.startsWith(APP_PATH)) {
    return;
  }

  // หน้า HTML: ลองออนไลน์ก่อน
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache =
              await caches.open(CACHE_NAME);

            await cache.put(
              APP_PATH,
              response.clone()
            );
          }

          return response;
        } catch {
          const cached =
            await caches.match(APP_PATH);

          if (cached) return cached;

          return new Response(
            "MoneyFlow ยังไม่พร้อมใช้งานออฟไลน์ กรุณาเชื่อมอินเทอร์เน็ตและเปิดแอปอีกครั้ง",
            {
              status: 503,
              headers: {
                "Content-Type":
                  "text/plain; charset=utf-8"
              }
            }
          );
        }
      })()
    );
    return;
  }

  // ไฟล์ JavaScript, CSS, รูปภาพ:
  // ใช้ Cache ก่อน แล้วค่อยลองเครือข่าย
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      if (cached) return cached;

      const response = await fetch(request);

      if (
        response.ok &&
        response.type === "basic"
      ) {
        const cache =
          await caches.open(CACHE_NAME);

        await cache.put(
          request,
          response.clone()
        );
      }

      return response;
    })()
  );
});
