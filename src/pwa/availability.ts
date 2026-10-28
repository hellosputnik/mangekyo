export type OfflineAvailability =
  "checking" | "ready" | "not-ready" | "unsupported";

export function queryOfflineFiles(
  worker: Pick<ServiceWorker, "postMessage">,
  createChannel: () => MessageChannel = () => new MessageChannel(),
  timeoutMilliseconds = 3000,
  messageType = "CHECK_OFFLINE_FILES",
): Promise<boolean> {
  return new Promise((resolve) => {
    let channel: MessageChannel;
    try {
      channel = createChannel();
    } catch {
      resolve(false);
      return;
    }
    let finished = false;
    const finish = (ready: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      channel.port1.close();
      channel.port2.close();
      resolve(ready);
    };
    const timeout = setTimeout(() => finish(false), timeoutMilliseconds);
    channel.port1.onmessage = (event) =>
      finish(event.data?.type === "OFFLINE_FILES" && event.data.ready === true);
    try {
      worker.postMessage({ type: messageType }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

export function downloadOfflineFiles(
  worker: Pick<ServiceWorker, "postMessage">,
) {
  return queryOfflineFiles(
    worker,
    () => new MessageChannel(),
    15000,
    "DOWNLOAD_OFFLINE_FILES",
  );
}
