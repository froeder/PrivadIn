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

  return { muted, toggleMuted, playFlush };
}
