import { initialData, validate, type Data } from "../engine/model";
import { normalizeLanguagePreference } from "../i18n/locale";
import { resetTouchRun } from "../exercises/touch-challenge";
import { parsePracticePreferences } from "../engine/practice";
import { validAttentionRound } from "../exercises/attention-validation";
import { parseSavedSetups } from "../engine/saved-setups";
import { validPracticeProfiles } from "../adaptive/validation";
import { flagPresentation } from "../adaptive/quality";
import { clearPendingEvidence } from "../adaptive/practice";
const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("mangekyo", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
async function readData(): Promise<{ data: Data; revision: number }> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("state");
    const store = transaction.objectStore("state");
    const versionRequest = store.get("revision");
    let revision = 0;
    versionRequest.onsuccess = () => {
      revision = versionRequest.result ?? 0;
    };
    const request = store.get("main");
    request.onsuccess = () => {
      const data = (request.result as Data | undefined) ?? initialData();
      data.preferences = {
        ...initialData().preferences,
        ...data.preferences,
        language: normalizeLanguagePreference(data.preferences?.language),
      };
      data.levels = { ...initialData().levels, ...data.levels };
      data.practice = parsePracticePreferences(data.practice) ?? undefined;
      data.savedSetups = parseSavedSetups(data.savedSetups ?? []) ?? [];
      if (!validPracticeProfiles(data.practiceProfiles ?? []))
        data.practiceProfiles = [];
      if (
        data.lastExportedAt !== undefined &&
        (typeof data.lastExportedAt !== "string" ||
          !Number.isFinite(Date.parse(data.lastExportedAt)))
      )
        delete data.lastExportedAt;
      for (const session of [
        ...data.sessions,
        ...(data.current ? [data.current] : []),
        ...(data.statisticsReset?.sessions ?? []),
      ])
        session.configuration = validate(session.configuration);
      if (data.statisticsReset?.levels)
        data.statisticsReset.levels = {
          ...initialData().levels,
          ...data.statisticsReset.levels,
        };
      if (data.current?.kind === "follow") {
        data.current.awaitingTouch = false;
        if (data.current.follow) data.current.follow.currentRunMilliseconds = 0;
      }
      if (data.current) {
        data.current.status = "interrupted";
        flagPresentation(data.current, "interruption");
        clearPendingEvidence(data.current);
        if (data.current.presentationQuality)
          data.current.presentationQuality.presented = false;
        if (
          data.current.attentionRound &&
          !validAttentionRound(
            data.current.attentionRound,
            data.current.kind,
            data.current.activeMilliseconds,
          )
        )
          delete data.current.attentionRound;
        resetTouchRun(data.current);
      }
      resolve({ data, revision });
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}
export class SnapshotConflict extends Error {
  constructor() {
    super("A newer snapshot exists in another tab");
    this.name = "SnapshotConflict";
  }
}

/** Compare and replace inside one IndexedDB transaction, across all tabs. */
export function createSnapshotStore() {
  let revision: number | null = null;
  let pending: Promise<void> = Promise.resolve();
  const writer = crypto.randomUUID();
  return {
    async load() {
      await pending.catch(() => {});
      const result = await readData();
      revision = result.revision;
      return result.data;
    },
    save(data: Data) {
      const snapshot = structuredClone(data);
      pending = pending
        .catch(() => {})
        .then(async () => {
          const database = await open();
          return new Promise<void>((resolve, reject) => {
            const transaction = database.transaction("state", "readwrite");
            const store = transaction.objectStore("state");
            const request = store.get("revision");
            let nextRevision = 0;
            let conflict = false;
            request.onsuccess = () => {
              const current = request.result ?? 0;
              if ((revision ?? 0) !== current) {
                conflict = true;
                transaction.abort();
                return;
              }
              nextRevision = current + 1;
              store.put(snapshot, "main");
              store.put(nextRevision, "revision");
            };
            transaction.oncomplete = () => {
              revision = nextRevision;
              database.close();
              try {
                const channel = new BroadcastChannel("mangekyo-snapshots");
                channel.postMessage({ writer, revision });
                channel.close();
              } catch {
                /* Atomic revision checks work without BroadcastChannel. */
              }
              resolve();
            };
            transaction.onabort = () => {
              database.close();
              reject(conflict ? new SnapshotConflict() : transaction.error);
            };
            transaction.onerror = () => {
              /* onabort reports the transaction failure. */
            };
          });
        });
      return pending;
    },
    subscribe(onConflict: () => void) {
      let channel: BroadcastChannel;
      try {
        channel = new BroadcastChannel("mangekyo-snapshots");
      } catch {
        return () => {};
      }
      channel.onmessage = (event) => {
        if (
          revision !== null &&
          event.data?.writer !== writer &&
          typeof event.data?.revision === "number" &&
          event.data.revision > revision
        )
          onConflict();
      };
      return () => channel.close();
    },
  };
}
const store = createSnapshotStore();
export const load = store.load;
export const save = store.save;
export const subscribeToWrites = store.subscribe;
