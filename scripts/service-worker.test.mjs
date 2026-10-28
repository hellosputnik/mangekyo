import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { runInNewContext } from "node:vm";

let temporaryDirectory;
let workerSource;
beforeAll(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "mangekyo-pages-"));
  await mkdir(join(temporaryDirectory, "dist/assets"), { recursive: true });
  for (const file of [
    "index.html",
    "manifest.webmanifest",
    "manifest.vi.webmanifest",
    "icon-192.png",
    "icon-512.png",
    "brand-mark.svg",
    "icon.svg",
    "favicon-32.png",
    "apple-touch-icon.png",
    "assets/app.js",
  ]) {
    await writeFile(join(temporaryDirectory, "dist", file), file);
  }
  execFileSync(process.execPath, [resolve("scripts/build-sw.mjs")], {
    cwd: temporaryDirectory,
  });
  workerSource = await readFile(join(temporaryDirectory, "dist/sw.js"), "utf8");
});
afterAll(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

function worker(scope) {
  const listeners = new Map();
  const entries = new Map();
  const opened = new Set();
  const cache = {
    addAll: vi.fn(async (urls) => {
      for (const url of urls) entries.set(url, new Response(url));
    }),
    match: vi.fn(async (request) =>
      entries.get(typeof request === "string" ? request : request.url),
    ),
  };
  const caches = {
    open: vi.fn(async (name) => {
      opened.add(name);
      return cache;
    }),
    keys: vi.fn(async () => [
      "mangekyo:%2Fmangekyo%2F:old",
      "mangekyo:%2Fother%2F:old",
      "another-app-cache",
      ...opened,
    ]),
    delete: vi.fn(async () => true),
  };
  const fetch = vi.fn(async () => {
    throw Error("offline");
  });
  const self = {
    registration: { scope },
    clients: { claim: vi.fn() },
    addEventListener: (name, listener) => listeners.set(name, listener),
    skipWaiting: vi.fn(),
  };
  runInNewContext(workerSource, { self, caches, fetch, URL, Response });
  return {
    entries,
    cache,
    caches,
    fetch,
    checkFiles: async (type = "CHECK_OFFLINE_FILES") => {
      let pending;
      let reply;
      listeners.get("message")({
        data: { type },
        ports: [
          {
            postMessage: (value) => {
              reply = value;
            },
          },
        ],
        waitUntil: (promise) => {
          pending = promise;
        },
      });
      await pending;
      return reply;
    },
    install: async () => {
      let pending;
      listeners.get("install")({ waitUntil: (promise) => (pending = promise) });
      await pending;
    },
    activate: async () => {
      let pending;
      listeners.get("activate")({
        waitUntil: (promise) => (pending = promise),
      });
      await pending;
    },
    request: (url, mode = "cors") => {
      let response;
      listeners.get("fetch")({
        request: { url, mode, method: "GET" },
        respondWith: (promise) => (response = promise),
      });
      return response;
    },
  };
}

describe("GitHub Pages offline deployment", () => {
  it("reports readiness only when every asset for the active scoped version exists", async () => {
    const scope = "https://example.github.io/mangekyo/";
    const instance = worker(scope);
    expect((await instance.checkFiles()).ready).toBe(false);
    await instance.install();
    expect((await instance.checkFiles()).ready).toBe(true);
    instance.entries.delete(scope + "assets/app.js");
    expect((await instance.checkFiles()).ready).toBe(false);
    expect((await instance.checkFiles("DOWNLOAD_OFFLINE_FILES")).ready).toBe(
      true,
    );
    expect(instance.entries.has(scope + "assets/app.js")).toBe(true);
  });
  it.each([
    "https://example.github.io/",
    "https://example.github.io/mangekyo/",
  ])("resolves precached assets within %s", async (scope) => {
    const instance = worker(scope);
    await instance.install();
    expect(instance.cache.addAll.mock.calls[0][0]).toContain(
      scope + "assets/app.js",
    );
    expect(instance.cache.addAll.mock.calls[0][0]).toContain(
      scope + "brand-mark.svg",
    );
    expect(instance.cache.addAll.mock.calls[0][0]).toContain(
      scope + "apple-touch-icon.png",
    );
    const response = await instance.request(scope + "assets/app.js");
    expect(await response.text()).toBe(scope + "assets/app.js");
    expect(instance.fetch).not.toHaveBeenCalled();
    expect(instance.cache.match.mock.calls[0][1]).toEqual({ ignoreVary: true });
  });
  it("falls back to the scoped app shell for offline navigation", async () => {
    const scope = "https://example.github.io/mangekyo/";
    const instance = worker(scope);
    await instance.install();
    const response = await instance.request(scope + "?offline=1", "navigate");
    expect(await response.text()).toBe(scope + "index.html");
  });
  it("preserves other Pages projects' caches during activation", async () => {
    const instance = worker("https://example.github.io/mangekyo/");
    await instance.activate();
    expect(instance.caches.delete.mock.calls).toEqual([
      ["mangekyo:%2Fmangekyo%2F:old"],
    ]);
  });
  it("does not intercept requests outside the project path", async () => {
    const instance = worker("https://example.github.io/mangekyo/");
    expect(
      instance.request("https://example.github.io/another-project/"),
    ).toBeUndefined();
    expect(
      instance.request("https://another.example/mangekyo/"),
    ).toBeUndefined();
  });
});
