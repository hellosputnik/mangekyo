import type { Data } from "../engine/model";
export type Durability =
  "checking" | "persistent" | "best-effort" | "unsupported";
export async function checkDurability(
  storage?: Pick<StorageManager, "persisted">,
): Promise<Durability> {
  if (!storage?.persisted) return "unsupported";
  try {
    return (await storage.persisted()) ? "persistent" : "best-effort";
  } catch {
    return "unsupported";
  }
}
export async function requestDurability(
  storage?: Pick<StorageManager, "persisted" | "persist">,
): Promise<Durability> {
  if (!storage?.persist) return "unsupported";
  try {
    await storage.persist();
    return await checkDurability(storage);
  } catch {
    return "best-effort";
  }
}
export function backupReminderDue(data: Data, now = Date.now()) {
  if (!data.preferences.backupReminder) return false;
  const since = data.lastExportedAt ? Date.parse(data.lastExportedAt) : 0;
  const dismissed = data.backupReminderDismissedAt
    ? Date.parse(data.backupReminderDismissedAt)
    : 0;
  const week = 7 * 86400000;
  if (now - Math.max(since, dismissed) < week) return false;
  return data.sessions.some(
    (session) =>
      session.activeMilliseconds > 0 &&
      Date.parse(session.endedAt ?? session.startedAt) > since,
  );
}
