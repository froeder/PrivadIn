import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";

let soundPlayer: AudioPlayer | null = null;

export async function playFlushSound(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // In web browser environment, attempt Web Audio API synthesis / Audio object
      if (typeof window !== "undefined") {
        const AudioContextClass =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          try {
            const ctx = new AudioContextClass();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(180, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
            return;
          } catch {
            // Web Audio might need user gesture
          }
        }
      }
    }

    // Native audio playback via expo-audio
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "mixWithOthers",
      });

      if (soundPlayer) {
        try {
          soundPlayer.remove();
        } catch {
          // ignore
        }
        soundPlayer = null;
      }

      // Load and play flush.mp3
      const player = createAudioPlayer(require("../../assets/sounds/flush.mp3"));
      soundPlayer = player;

      player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          try {
            player.remove();
          } catch {
            // ignore
          }
          if (soundPlayer === player) {
            soundPlayer = null;
          }
        }
      });

      player.play();
    } catch (nativeErr) {
      console.warn("Could not play native flush sound with expo-audio:", nativeErr);
    }
  } catch (error) {
    console.warn("Error in playFlushSound:", error);
  }
}
