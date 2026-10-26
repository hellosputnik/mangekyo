/** Best-effort feedback, called only from an explicit answer gesture. */
export function playAnswerConfirmation() {
  try {
    navigator.vibrate?.(10);
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, start);
    oscillator.frequency.setValueAtTime(988, start + 0.055);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.025, start + 0.008);
    gain.gain.linearRampToValueAtTime(0, start + 0.13);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(start + 0.14);
    oscillator.onended = () => void audio.close();
    void audio.resume().catch(() => {});
  } catch {
    // Visual feedback remains available when audio or vibration is unsupported.
  }
}
