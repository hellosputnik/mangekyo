import { initialData, type Data } from "../engine/model";
import { normalizeLanguagePreference } from "../i18n/locale";
const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("mangekyo", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function load(): Promise<Data> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("state");
    const request = transaction.objectStore("state").get("main");
    request.onsuccess = () => {
      const data = (request.result as Data | undefined) ?? initialData();
      data.preferences = {
        ...initialData().preferences,
        ...data.preferences,
        language: normalizeLanguagePreference(data.preferences?.language),
      };
      if (data.current) data.current.status = "interrupted";
      resolve(data);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}
export async function save(data: Data): Promise<void> {
  const snapshot = structuredClone(data);
  const database = await open();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("state", "readwrite");
    transaction.objectStore("state").put(snapshot, "main");
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}
