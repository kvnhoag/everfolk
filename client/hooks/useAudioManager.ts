import { useEffect, useSyncExternalStore } from "react";
import { audioManager, PLAYLIST, type AudioState, type MusicTrack } from "../lib/audio-manager.ts";

export function useAudioManager() {
  const state = useSyncExternalStore(
    listener => audioManager.subscribe(listener),
    () => audioManager.getState(),
    () => audioManager.getState(),
  );

  useEffect(() => {
    audioManager.init();
  }, []);

  return {
    ...state,
    playlist: PLAYLIST,
    play: () => audioManager.play(),
    pause: () => audioManager.pause(),
    togglePlay: () => audioManager.togglePlay(),
    toggleMute: () => audioManager.toggleMute(),
    setVolume: (vol: number) => audioManager.setVolume(vol),
    increaseVolume: (step?: number) => audioManager.increaseVolume(step),
    decreaseVolume: (step?: number) => audioManager.decreaseVolume(step),
    selectTrack: (idOrIndex: string | number) => audioManager.selectTrack(idOrIndex),
    nextTrack: () => audioManager.nextTrack(),
    prevTrack: () => audioManager.prevTrack(),
    toggleSfx: () => audioManager.toggleSfx(),
    playClickSound: () => audioManager.playClickSound(),
  };
}

export type { MusicTrack, AudioState };
