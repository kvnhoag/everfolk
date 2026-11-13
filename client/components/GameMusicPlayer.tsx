import { useState, useRef, useEffect, useId } from "react";
import { CLICK_SFX_CREDIT } from "../lib/audio-manager.ts";
import { useAudioManager } from "../hooks/useAudioManager.ts";
import "../styles/audio-player.css";

export default function GameMusicPlayer({ variant = "default" }: { variant?: "default" | "home" }) {
  const {
    currentTrack,
    currentTrackIndex,
    playlist,
    isPlaying,
    volume,
    muted,
    sfxEnabled,
    togglePlay,
    toggleMute,
    setVolume,
    increaseVolume,
    decreaseVolume,
    selectTrack,
    nextTrack,
    prevTrack,
    toggleSfx,
  } = useAudioManager();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playlistHeadingId = useId();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    }
    if (drawerOpen) {
      document.addEventListener("pointerdown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("pointerdown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [drawerOpen]);

  const volumePercent = Math.round((muted ? 0 : volume) * 100);
  const isAudible = isPlaying && !muted && volume > 0;

  return (
    <div className={`game-music-player variant-${variant}`} ref={containerRef}>
      <button
        type="button"
        className={`music-square-trigger${isAudible ? " is-playing" : " is-muted"}${drawerOpen ? " is-open" : ""}`}
        onClick={() => setDrawerOpen(prev => !prev)}
        aria-expanded={drawerOpen}
        aria-haspopup="dialog"
        aria-label={`Audio settings (${isAudible ? `Playing: ${currentTrack.title}` : "Muted or paused"})`}
        title={`Audio settings · ${currentTrack.title} (${volumePercent}%)`}
      >
        <span className="music-square-icon" aria-hidden="true">
          {muted ? "♪×" : isPlaying ? "♫" : "♪"}
        </span>
      </button>

      {drawerOpen && (
        <div className="music-drawer" role="dialog" aria-label="Everfolk Audio & Music Settings">
          <div className="music-drawer-header">
            <div>
              <span className="music-drawer-eyebrow">AUDIO &amp; AMBIENCE</span>
              <h4 className="music-drawer-title">Soundscapes of the Nile</h4>
            </div>
            <button
              type="button"
              className="music-drawer-close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close audio settings"
            >
              ×
            </button>
          </div>

          <div className="music-now-playing-box">
            <div className="music-now-playing-meta">
              <span className="music-now-playing-status">
                {muted ? "MUTED" : isPlaying ? "NOW PLAYING" : "PAUSED"}
              </span>
              <strong className="music-track-title">{currentTrack.title}</strong>
              <span className="music-track-origin" title={currentTrack.attribution}>
                {currentTrack.origin} · {currentTrack.attribution}
              </span>
            </div>
            <div className="music-transport-row">
              <button
                type="button"
                className={`music-action-btn${isPlaying && !muted ? " is-active" : ""}`}
                onClick={togglePlay}
                title={isPlaying ? "Pause music" : "Play music"}
              >
                {isPlaying ? "❚❚ Pause" : "▶ Play"}
              </button>
              <button
                type="button"
                className={`music-action-btn${muted ? " is-muted" : ""}`}
                onClick={toggleMute}
                title={muted ? "Unmute audio" : "Mute audio"}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
              <div className="music-stepper-btns">
                <button
                  type="button"
                  className="music-step-btn"
                  onClick={prevTrack}
                  aria-label="Previous music track"
                  title="Previous track"
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="music-step-btn"
                  onClick={nextTrack}
                  aria-label="Next music track"
                  title="Next track"
                >
                  ▶
                </button>
              </div>
            </div>
          </div>

          <div className="music-volume-row">
            <span className="music-volume-heading">VOLUME</span>
            <div className="music-volume-strip">
              <button
                type="button"
                className="music-step-btn"
                onClick={() => decreaseVolume(0.08)}
                aria-label="Decrease music volume"
                title="Volume down"
              >
                –
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={volumePercent}
                onChange={e => setVolume(Number(e.target.value) / 100)}
                className="music-volume-slider"
                aria-label="Music volume"
                title={`Music volume: ${volumePercent}%`}
              />
              <button
                type="button"
                className="music-step-btn"
                onClick={() => increaseVolume(0.08)}
                aria-label="Increase music volume"
                title="Volume up"
              >
                +
              </button>
              <span className="music-volume-label">{volumePercent}%</span>
            </div>
          </div>

          <section className="music-playlist-section" aria-labelledby={playlistHeadingId}>
            <h5 className="music-section-label" id={playlistHeadingId}>Select background track <span>({playlist.length})</span></h5>
            <ul className="music-playlist-list">
              {playlist.map((track, idx) => {
                const isActive = idx === currentTrackIndex;
                return <li key={track.id}>
                  <button
                    type="button"
                    className={`music-track-item${isActive ? " is-active" : ""}`}
                    aria-pressed={isActive}
                    onClick={() => selectTrack(idx)}
                  >
                    <span className="music-track-badge" aria-hidden="true">{isActive ? "✓" : idx + 1}</span>
                    <span className="music-track-item-info">
                      <strong>{track.title}</strong>
                      <small>{track.origin} · {track.composer} · {track.license}</small>
                      <span className="music-track-item-tag">{track.tag}</span>
                    </span>
                  </button>
                </li>;
              })}
            </ul>
          </section>

          <div className="music-drawer-footer">
            <button
              type="button"
              className={`music-sfx-toggle${sfxEnabled ? " is-on" : ""}`}
              onClick={toggleSfx}
              title="Toggle button click sound effect"
            >
              <span>✦</span>
              <span>UI Click Sound: {sfxEnabled ? "ON" : "OFF"}</span>
            </button>
            <p className="music-credits-note">
              Click SFX: {CLICK_SFX_CREDIT.attribution}.{" "}
              <a href="/assets/audio/ATTRIBUTION.md" target="_blank" rel="noreferrer">Audio notices</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
