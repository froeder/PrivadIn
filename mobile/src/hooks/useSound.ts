import { useCallback, useEffect, useState } from "react";
import {
  isSoundMuted,
  playFlushSound,
  playNotificationSound,
  setSoundMuted,
} from "../services/soundService";

export function useSound() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    let isMounted = true;
    isSoundMuted().then((isMuted) => {
      if (isMounted) setMutedState(isMuted);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleMuted = useCallback(async () => {
    setMutedState((prev) => {
      const next = !prev;
      void setSoundMuted(next);
      return next;
    });
  }, []);

  const playFlush = useCallback(() => {
    void playFlushSound();
  }, []);

  const playNotification = useCallback(() => {
    void playNotificationSound();
  }, []);

  return {
    muted,
    toggleMuted,
    playFlush,
    playNotification,
  };
}
