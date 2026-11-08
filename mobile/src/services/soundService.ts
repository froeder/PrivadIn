import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SOUND_MUTED_STORAGE_KEY = "@privadin:sound_muted";

let soundPlayer: AudioPlayer | null = null;
let cachedMuted: boolean | null = null;

export async function isSoundMuted(): Promise<boolean> {
  if (cachedMuted !== null) return cachedMuted;
  try {
    const raw = await AsyncStorage.getItem(SOUND_MUTED_STORAGE_KEY);
    cachedMuted = raw === "true";
    return cachedMuted;
  } catch {
    return false;
  }
}

export async function setSoundMuted(muted: boolean): Promise<void> {
  cachedMuted = muted;
  try {
    await AsyncStorage.setItem(SOUND_MUTED_STORAGE_KEY, String(muted));
  } catch (err) {
    console.warn("Could not save sound mute preference:", err);
  }
}

export async function toggleSoundMuted(): Promise<boolean> {
  const current = await isSoundMuted();
  const next = !current;
  await setSoundMuted(next);
  return next;
}

export async function playFlushSound(): Promise<void> {
  try {
    const muted = await isSoundMuted();
    if (muted) return;

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

export async function playNotificationSound(): Promise<void> {
  try {
    const muted = await isSoundMuted();
    if (muted) return;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        try {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.09); // A5
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.38);
          return;
        } catch {
          // Audio context might be restricted before interaction
        }
      }
    }

    // On native platforms, fallback tone or silent gracefully if native chime file isn't present
  } catch (err) {
    console.warn("Error in playNotificationSound:", err);
  }
}
