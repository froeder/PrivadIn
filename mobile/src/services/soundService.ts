import { Platform } from "react-native";
import { Audio } from "expo-av";

let soundObject: Audio.Sound | null = null;

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

    // Native audio playback via expo-av
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      if (soundObject) {
        await soundObject.unloadAsync().catch(() => undefined);
        soundObject = null;
      }

      // Load and play flush.mp3
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/sounds/flush.mp3"),
        { shouldPlay: true, volume: 1.0 }
      );
      soundObject = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => undefined);
        }
      });
    } catch (nativeErr) {
      console.warn("Could not play native flush sound with expo-av:", nativeErr);
    }
  } catch (error) {
    console.warn("Error in playFlushSound:", error);
  }
}
