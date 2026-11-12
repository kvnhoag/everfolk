export interface MusicTrack {
  id: string;
  title: string;
  composer: string;
  src: string;
  tag: string;
  origin: string;
}

export const PLAYLIST: readonly MusicTrack[] = [
  {
    id: "egyptian-meditation",
    title: "Egyptian Meditation",
    composer: "cynicmusic",
    src: "/assets/audio/egyptian-meditation.ogg",
    tag: "Ancient Egypt",
    origin: "Nile Flute & Sacred Harp",
  },
  {
    id: "temple-of-the-mystics",
    title: "Temple of the Mystics",
    composer: "Matthew Pablo",
    src: "/assets/audio/temple-of-the-mystics.mp3",
    tag: "Mystic Alexandria",
    origin: "Ambient Temple Strings",
  },
  {
    id: "hidden-oasis",
    title: "Hidden Oasis",
    composer: "Trevor Lentz",
    src: "/assets/audio/hidden-oasis.mp3",
    tag: "Desert Oasis",
    origin: "Serene Palm Grove",
  },
  {
    id: "mediterranean-breeze",
    title: "Mediterranean Breeze",
    composer: "Eric Matyas",
    src: "/assets/audio/mediterranean-breeze.ogg",
    tag: "Rhakotis Shore",
    origin: "Coastal Lute & Gentle Winds",
  },
  {
    id: "desert-caravan",
    title: "Desert Caravan",
    composer: "Rezoner",
    src: "/assets/audio/desert-caravan.ogg",
    tag: "Eastern Market",
    origin: "Acoustic Oud & Percussion",
  },
  {
    id: "minstrel-dance",
    title: "Medieval: Minstrel Dance",
    composer: "RandomMind",
    src: "/assets/audio/medieval-minstrel-dance.mp3",
    tag: "Harbor Tavern",
    origin: "Lively Minstrel Lute",
  },
] as const;

export interface AudioState {
  currentTrackIndex: number;
  currentTrack: MusicTrack;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  sfxEnabled: boolean;
}

const STORAGE_KEY_TRACK = "everfolk:audio:track-id";
const STORAGE_KEY_VOLUME = "everfolk:audio:volume";
const STORAGE_KEY_MUTED = "everfolk:audio:muted";
const STORAGE_KEY_SFX = "everfolk:audio:sfx";

const CLICK_SFX_SRC = "/assets/audio/button-click.mp3";
const DEFAULT_VOLUME = 0.35;

class AudioManager {
  private bgmAudio: HTMLAudioElement | null = null;
  private sfxAudioPool: HTMLAudioElement[] = [];
  private sfxPoolIndex = 0;
  private audioCtx: AudioContext | null = null;
  private listeners = new Set<() => void>();
  private globalClickInstalled = false;
  private lastClickTime = 0;

  private state: AudioState = {
    currentTrackIndex: 0,
    currentTrack: PLAYLIST[0],
    isPlaying: false,
    volume: DEFAULT_VOLUME,
    muted: false,
    sfxEnabled: true,
  };

  constructor() {
    this.restoreSettings();
  }

  private restoreSettings() {
    if (typeof window === "undefined") return;
    try {
      const savedTrackId = window.localStorage.getItem(STORAGE_KEY_TRACK);
      if (savedTrackId) {
        const found = PLAYLIST.findIndex(t => t.id === savedTrackId);
        if (found !== -1) {
          this.state.currentTrackIndex = found;
          this.state.currentTrack = PLAYLIST[found];
        }
      }
      const savedVol = window.localStorage.getItem(STORAGE_KEY_VOLUME);
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.state.volume = parsed;
        }
      }
      const savedMuted = window.localStorage.getItem(STORAGE_KEY_MUTED);
      if (savedMuted === "1") {
        this.state.muted = true;
      }
      const savedSfx = window.localStorage.getItem(STORAGE_KEY_SFX);
      if (savedSfx === "0") {
        this.state.sfxEnabled = false;
      }
    } catch {
      // Ignore storage errors
    }
  }

  private persistSettings() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_TRACK, this.state.currentTrack.id);
      window.localStorage.setItem(STORAGE_KEY_VOLUME, this.state.volume.toString());
      window.localStorage.setItem(STORAGE_KEY_MUTED, this.state.muted ? "1" : "0");
      window.localStorage.setItem(STORAGE_KEY_SFX, this.state.sfxEnabled ? "1" : "0");
    } catch {
      // Ignore storage errors
    }
  }

  public init() {
    if (typeof window === "undefined") return;
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio();
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = "auto";
      this.bgmAudio.src = this.state.currentTrack.src;
      this.bgmAudio.volume = this.state.volume;
      this.bgmAudio.muted = this.state.muted;

      this.bgmAudio.addEventListener("play", () => {
        if (!this.state.isPlaying) {
          this.state = { ...this.state, isPlaying: true };
          this.notify();
        }
      });
      this.bgmAudio.addEventListener("pause", () => {
        if (this.state.isPlaying) {
          this.state = { ...this.state, isPlaying: false };
          this.notify();
        }
      });
      this.bgmAudio.addEventListener("ended", () => {
        this.nextTrack();
      });
    }

    if (this.sfxAudioPool.length === 0) {
      for (let i = 0; i < 4; i++) {
        const sfx = new Audio(CLICK_SFX_SRC);
        sfx.preload = "auto";
        sfx.volume = Math.min(1, this.state.volume * 0.9);
        this.sfxAudioPool.push(sfx);
      }
    }

    this.installGlobalClickListener();
    this.installUserUnlockListener();
  }

  private installUserUnlockListener() {
    if (typeof window === "undefined") return;
    const unlock = () => {
      if (!this.state.muted && !this.state.isPlaying && this.bgmAudio) {
        this.play();
      }
      if (!this.audioCtx) {
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            this.audioCtx = new AudioContextClass();
          }
        } catch {
          // Ignore
        }
      } else if (this.audioCtx.state === "suspended") {
        void this.audioCtx.resume();
      }
    };

    window.addEventListener("pointerdown", unlock, { passive: true, once: false });
    window.addEventListener("keydown", unlock, { passive: true, once: false });
  }

  public installGlobalClickListener() {
    if (typeof window === "undefined" || this.globalClickInstalled) return;
    this.globalClickInstalled = true;

    document.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const clickable = target.closest("button, [role='button'], summary, a, input[type='button'], input[type='submit']");
      if (clickable) {
        this.playClickSound();
      }
    }, { capture: true, passive: true });
  }

  public playClickSound() {
    if (typeof window === "undefined" || !this.state.sfxEnabled) return;
    const now = Date.now();
    if (now - this.lastClickTime < 25) return; // Debounce rapid multi-events
    this.lastClickTime = now;

    // Use audio pool
    if (this.sfxAudioPool.length > 0) {
      const sfx = this.sfxAudioPool[this.sfxPoolIndex];
      this.sfxPoolIndex = (this.sfxPoolIndex + 1) % this.sfxAudioPool.length;
      if (sfx) {
        sfx.volume = Math.min(1, Math.max(0.1, this.state.volume * 0.85));
        sfx.currentTime = 0;
        void sfx.play().catch(() => {
          this.synthesizeClickFallback();
        });
        return;
      }
    }

    this.synthesizeClickFallback();
  }

  private synthesizeClickFallback() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === "suspended") void this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(this.state.volume * 0.25, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);
    } catch {
      // Audio fallback failed silently
    }
  }

  public getState(): AudioState {
    return this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Ignore listener error
      }
    }
  }

  public play() {
    this.init();
    if (!this.bgmAudio) return;
    this.bgmAudio.muted = false;
    this.bgmAudio.volume = this.state.volume;
    void this.bgmAudio.play().then(() => {
      this.state = { ...this.state, isPlaying: true, muted: false };
      this.persistSettings();
      this.notify();
    }).catch(() => {
      this.state = { ...this.state, isPlaying: false };
      this.notify();
    });
  }

  public pause() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
    this.state = { ...this.state, isPlaying: false };
    this.notify();
  }

  public togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public toggleMute() {
    this.init();
    const nextMuted = !this.state.muted;
    if (this.bgmAudio) {
      this.bgmAudio.muted = nextMuted;
      if (nextMuted) {
        this.bgmAudio.pause();
      } else {
        this.bgmAudio.volume = this.state.volume;
        void this.bgmAudio.play().catch(() => {});
      }
    }
    this.state = {
      ...this.state,
      muted: nextMuted,
      isPlaying: !nextMuted,
    };
    this.persistSettings();
    this.notify();
  }

  public setVolume(vol: number) {
    this.init();
    const clamped = Math.max(0, Math.min(1, vol));
    if (this.bgmAudio) {
      this.bgmAudio.volume = clamped;
      if (clamped > 0 && this.state.muted) {
        this.bgmAudio.muted = false;
      }
    }
    this.state = {
      ...this.state,
      volume: clamped,
      muted: clamped === 0,
    };
    this.persistSettings();
    this.notify();
  }

  public increaseVolume(step = 0.1) {
    this.setVolume(this.state.volume + step);
  }

  public decreaseVolume(step = 0.1) {
    this.setVolume(this.state.volume - step);
  }

  public selectTrack(indexOrId: number | string) {
    this.init();
    let index: number;
    if (typeof indexOrId === "number") {
      index = (indexOrId + PLAYLIST.length) % PLAYLIST.length;
    } else {
      index = PLAYLIST.findIndex(t => t.id === indexOrId);
      if (index === -1) index = 0;
    }

    const nextTrack = PLAYLIST[index];
    const wasPlaying = this.state.isPlaying;

    this.state = {
      ...this.state,
      currentTrackIndex: index,
      currentTrack: nextTrack,
    };
    this.persistSettings();

    if (this.bgmAudio) {
      this.bgmAudio.src = nextTrack.src;
      this.bgmAudio.currentTime = 0;
      if (wasPlaying && !this.state.muted) {
        void this.bgmAudio.play().catch(() => {});
      }
    }

    this.notify();
  }

  public nextTrack() {
    this.selectTrack(this.state.currentTrackIndex + 1);
  }

  public prevTrack() {
    this.selectTrack(this.state.currentTrackIndex - 1);
  }

  public toggleSfx() {
    this.state = { ...this.state, sfxEnabled: !this.state.sfxEnabled };
    this.persistSettings();
    this.notify();
  }
}

export const audioManager = new AudioManager();
