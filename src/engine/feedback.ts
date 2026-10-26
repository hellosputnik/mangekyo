export type PracticeSound = "correct" | "milestone" | "level";
export interface PracticeFeedbackOptions {
  sound: boolean;
  haptics: boolean;
}

/** Unlock from a user gesture; later tracking milestones reuse that same context. */
export class PracticeSoundPlayer {
  private audio: AudioContext | null = null;
  constructor(
    private createContext: () => AudioContext = () => new AudioContext(),
    private vibrate: (milliseconds: number) => unknown = (milliseconds) =>
      navigator.vibrate?.(milliseconds),
  ) {}
  unlock() {
    try {
      if (!this.audio || this.audio.state === "closed")
        this.audio = this.createContext();
      if (this.audio.state !== "running")
        void this.audio.resume().catch(() => {});
    } catch {
      /* Optional browser support. */
    }
  }
  play(
    kind: PracticeSound,
    options: PracticeFeedbackOptions = { sound: true, haptics: true },
  ) {
    if (options.haptics) {
      try {
        this.vibrate(kind === "level" ? 16 : kind === "milestone" ? 12 : 8);
      } catch {
        /* Vibration is independently optional. */
      }
    }
    if (!options.sound) return;
    this.unlock();
    try {
      const audio = this.audio;
      if (!audio || audio.state !== "running") return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const notes =
        kind === "level"
          ? [660, 880, 1100]
          : kind === "milestone"
            ? [660, 880]
            : [740, 988];
      const interval = kind === "level" ? 0.075 : 0.055;
      const length = notes.length * interval + 0.025;
      const start = audio.currentTime;
      oscillator.type = "sine";
      notes.forEach((frequency, index) =>
        oscillator.frequency.setValueAtTime(
          frequency,
          start + index * interval,
        ),
      );
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        kind === "level" ? 0.03 : 0.02,
        start + 0.008,
      );
      gain.gain.linearRampToValueAtTime(0, start + length);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(start + length + 0.01);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      /* Visual feedback always remains available. */
    }
  }
}
const player = new PracticeSoundPlayer();
export const unlockPracticeAudio = () => player.unlock();
export const playPracticeFeedback = (
  kind: PracticeSound,
  options: PracticeFeedbackOptions,
) => player.play(kind, options);
export const playAnswerConfirmation = (options: PracticeFeedbackOptions) =>
  player.play("correct", options);
