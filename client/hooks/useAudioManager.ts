import { useEffect, useSyncExternalStore } from "react";
import { audioManager, type AudioState } from "../lib/audio-manager.ts";

export function useAudioManager() {
  const state = useSyncExternalStore(
    listener => audioManager.subscribe(listener),
    () => audioManager.getState(),
    () => audioManager.getState(),
  );

  useEffect(() => { audioManager.init(); }, []);

  return {
    ...state,
    toggleMute: () => audioManager.toggleMute(),
    setVolume: (volume: number) => audioManager.setVolume(volume),
    increaseVolume: (step?: number) => audioManager.increaseVolume(step),
    decreaseVolume: (step?: number) => audioManager.decreaseVolume(step),
    toggleSfx: () => audioManager.toggleSfx(),
    playClickSound: () => audioManager.playClickSound(),
  };
}

export type { AudioState };
