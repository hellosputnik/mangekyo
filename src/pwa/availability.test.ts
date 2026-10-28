import { afterEach, expect, it, vi } from "vitest";
import { queryOfflineFiles } from "./availability";
afterEach(() => vi.useRealTimers());
function channel() {
  const value = {
    port1: {
      onmessage: null as ((event: MessageEvent) => void) | null,
      close: vi.fn(),
    },
    port2: { close: vi.fn() },
  };
  return { value, factory: () => value as unknown as MessageChannel };
}
it("shows readiness only after a complete worker response and closes both ports", async () => {
  const mock = channel();
  const worker = {
    postMessage: vi.fn(() =>
      queueMicrotask(() =>
        mock.value.port1.onmessage?.({
          data: { type: "OFFLINE_FILES", ready: true },
        } as MessageEvent),
      ),
    ),
  };
  expect(await queryOfflineFiles(worker, mock.factory)).toBe(true);
  expect(worker.postMessage).toHaveBeenCalledWith(
    { type: "CHECK_OFFLINE_FILES" },
    [mock.value.port2],
  );
  expect(mock.value.port1.close).toHaveBeenCalledOnce();
  expect(mock.value.port2.close).toHaveBeenCalledOnce();
});
it("does not assume readiness from installation, unsupported workers or a failed cache check", async () => {
  vi.useFakeTimers();
  const mock = channel();
  const result = queryOfflineFiles({ postMessage: vi.fn() }, mock.factory, 100);
  await vi.advanceTimersByTimeAsync(100);
  expect(await result).toBe(false);
  const failed = channel();
  expect(
    await queryOfflineFiles(
      {
        postMessage: () => {
          throw Error("unsupported");
        },
      },
      failed.factory,
    ),
  ).toBe(false);
  expect(failed.value.port1.close).toHaveBeenCalledOnce();
});
it("handles an unavailable MessageChannel without assuming cached files exist", async () => {
  expect(
    await queryOfflineFiles({ postMessage: vi.fn() }, () => {
      throw Error("not supported");
    }),
  ).toBe(false);
});
