import { useAudioManager } from "../hooks/useAudioManager.ts";
import "../styles/audio-player.css";

export default function GameMusicPlayer({ variant = "default" }: { variant?: "default" | "home" }) {
  const { volume, muted, setVolume, toggleMute } = useAudioManager();
  const volumePercent = Math.round(volume * 100);

  return (
    <div className={`game-music-player variant-${variant}`} role="group" aria-label="Music controls">
      <input
        type="range"
        min="0"
        max="100"
        value={volumePercent}
        onChange={event => setVolume(Number(event.target.value) / 100)}
        className="music-volume-slider"
        aria-label="Music volume"
        title={`Music volume: ${volumePercent}%`}
      />
      <button
        type="button"
        className={`music-mute-toggle${muted ? " is-muted" : ""}`}
        onClick={toggleMute}
        aria-label={muted ? "Unmute music" : "Mute music"}
        aria-pressed={muted}
        title={muted ? "Unmute music" : "Mute music"}
      >
        {muted ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m16 9 6 6m0-6-6 6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
          </svg>
        )}
      </button>
    </div>
  );
}
