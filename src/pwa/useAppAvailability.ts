import { useEffect, useRef, useState } from "react";
import {
  queryOfflineFiles,
  downloadOfflineFiles,
  type OfflineAvailability,
} from "./availability";

export function useAppAvailability(enabled: boolean) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const downloadingRef = useRef(false);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [offlineAvailability, setOfflineAvailability] =
    useState<OfflineAvailability>("checking");
  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) {
      setOfflineAvailability("unsupported");
      return;
    }
    let stopped = false;
    let registration: ServiceWorkerRegistration | undefined;
    let checking = false;
    const workers = new Set<ServiceWorker>();
    const check = async () => {
      if (
        stopped ||
        checking ||
        downloadingRef.current ||
        !registration?.active
      )
        return;
      checking = true;
      const ready = await queryOfflineFiles(registration.active);
      checking = false;
      if (!stopped && !downloadingRef.current)
        setOfflineAvailability(ready ? "ready" : "not-ready");
    };
    const changed = () => {
      if (stopped) return;
      if (registration?.waiting) setUpdate(registration.waiting);
      for (const worker of workers)
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          setUpdate(worker);
      if (registration?.active?.state === "activated") void check();
    };
    const watch = () => {
      const worker = registration?.installing;
      if (worker && !workers.has(worker)) {
        workers.add(worker);
        worker.addEventListener("statechange", changed);
      }
      changed();
    };
    const visible = () => {
      if (!document.hidden) void check();
    };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", visible);
    void navigator.serviceWorker
      .register("./sw.js")
      .then((value) => {
        if (stopped) return;
        registration = value;
        registrationRef.current = value;
        value.addEventListener("updatefound", watch);
        watch();
        // A previously active worker can verify files while a newer version installs.
        if (value.active) void check();
      })
      .catch(() => {
        if (!stopped) setOfflineAvailability("not-ready");
      });
    return () => {
      stopped = true;
      registrationRef.current = null;
      registration?.removeEventListener("updatefound", watch);
      for (const worker of workers)
        worker.removeEventListener("statechange", changed);
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled]);
  const downloadOffline = async () => {
    const worker = registrationRef.current?.active;
    if (!worker || !navigator.onLine) {
      setOfflineAvailability("not-ready");
      return;
    }
    setOfflineAvailability("checking");
    downloadingRef.current = true;
    const ready = await downloadOfflineFiles(worker).catch(() => false);
    downloadingRef.current = false;
    setOfflineAvailability(ready ? "ready" : "not-ready");
  };
  return { update, offlineAvailability, downloadOffline };
}
