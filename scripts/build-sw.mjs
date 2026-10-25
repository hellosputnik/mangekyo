import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const files = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  ...(await readdir("dist/assets")).sort().map((file) => "./assets/" + file),
];
const hash = createHash("sha256").update(
  await readFile(new URL(import.meta.url)),
);
for (const file of files.filter((file) => file !== "./")) {
  hash.update(file).update(await readFile(`dist/${file.slice(2)}`));
}
const version = hash.digest("hex").slice(0, 12);

await writeFile(
  "dist/sw.js",
  `
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = 'mangekyo:' + encodeURIComponent(SCOPE.pathname) + ':';
const CACHE = CACHE_PREFIX + '${version}';
const FILES = ${JSON.stringify(files)}.map(file => new URL(file, SCOPE).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== SCOPE.origin ||
      !url.pathname.startsWith(SCOPE.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request, {ignoreVary: true});
    if (cached) return cached;
    try {
      return await fetch(event.request);
    } catch {
      return event.request.mode === 'navigate'
        ? (await cache.match(new URL('index.html', SCOPE).href, {ignoreVary: true})) ?? Response.error()
        : Response.error();
    }
  }));
});
`,
);
