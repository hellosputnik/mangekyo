import { expect, it, vi } from "vitest";
import { PracticeSoundPlayer } from "./feedback";

function audioMock(initialState = "running") {
  const oscillator = {
    type: "sine",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  const gain = {
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const audio = {
    state: initialState,
    currentTime: 5,
    destination: {},
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    resume: vi.fn(async () => {
      audio.state = "running";
    }),
  };
  return { audio, oscillator, gain };
}
it("reuses a gesture-unlocked audio context for later following milestones and distinct level-up notes", () => {
  const { audio, oscillator, gain } = audioMock("suspended");
  const create = vi.fn(() => audio as unknown as AudioContext),
    vibrate = vi.fn();
  const player = new PracticeSoundPlayer(create, vibrate);
  player.unlock();
  player.play("milestone");
  player.play("level");
  expect(create).toHaveBeenCalledOnce();
  expect(audio.resume).toHaveBeenCalledOnce();
  expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledTimes(5);
  expect(oscillator.frequency.setValueAtTime).toHaveBeenLastCalledWith(
    1100,
    5.15,
  );
  expect(oscillator.stop.mock.calls.at(-1)![0] - 5).toBeLessThan(0.3);
  oscillator.onended?.();
  expect(oscillator.disconnect).toHaveBeenCalled();
  expect(gain.disconnect).toHaveBeenCalled();
});
it("keeps audio available without vibration and tolerates unavailable or rejected audio", () => {
  const { audio, oscillator } = audioMock();
  const player = new PracticeSoundPlayer(
    () => audio as unknown as AudioContext,
    () => {
      throw Error("Unsupported");
    },
  );
  expect(() => player.play("correct")).not.toThrow();
  expect(oscillator.start).toHaveBeenCalledOnce();
  expect(() =>
    new PracticeSoundPlayer(
      () => {
        throw Error("Unavailable");
      },
      () => {},
    ).play("level"),
  ).not.toThrow();
  const blocked = audioMock("suspended");
  blocked.audio.resume = vi.fn(async () => {
    throw Error("Blocked");
  });
  new PracticeSoundPlayer(
    () => blocked.audio as unknown as AudioContext,
    () => {},
  ).play("level");
  expect(blocked.oscillator.start).not.toHaveBeenCalled();
});
