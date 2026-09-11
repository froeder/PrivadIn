import { useCallback, useState } from "react";

export function useSound() {
  const [muted, setMuted] = useState(() => localStorage.getItem("privadin-muted") === "true");

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      localStorage.setItem("privadin-muted", String(!current));
      return !current;
    });
  }, []);

  const playFlush = useCallback(() => {
    if (muted) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(180, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(70, context.currentTime + 0.28);
    gain.gain.setValueAtTime(0.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
  }, [muted]);

  const playNotification = useCallback(() => {
    if (muted) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(587.33, context.currentTime);
      oscillator.frequency.setValueAtTime(880, context.currentTime + 0.09);
      gain.gain.setValueAtTime(0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.38);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.38);
    } catch {
      // Audio context might be restricted before interaction
    }
  }, [muted]);

  return { muted, toggleMuted, playFlush, playNotification };
}
