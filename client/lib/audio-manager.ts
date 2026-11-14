export interface MusicTrack {
  id: string;
  title: string;
  sourceTitle: string;
  composer: string;
  src: string;
  tag: string;
  origin: string;
  license: string;
  attribution: string;
  sourceUrl: string;
}

export interface AudioSfxCredit {
  id: string;
  title: string;
  creator: string;
  src: string;
  license: string;
  attribution: string;
  sourceUrl: string;
}

export const CLICK_SFX_CREDIT: AudioSfxCredit = {
  id: "button-click",
  title: "Menu Selection Click",
  creator: "NenadSimic",
  src: "/assets/audio/button-click.mp3",
  license: "CC-BY 3.0",
  attribution: "Menu Selection Click by NenadSimic · CC-BY 3.0",
  sourceUrl: "https://opengameart.org/content/menu-selection-click",
};

// Retained only for bundled asset provenance; music uses the YouTube player.
export const PLAYLIST: readonly MusicTrack[] = [
  {
    id: "egyptian-meditation",
    title: "Egyptian Meditation",
    sourceTitle: "Egyptian meditation music",
    composer: "brandon75689",
    src: "/assets/audio/egyptian-meditation.ogg",
    tag: "Ancient Egypt",
    origin: "Nile Flute & Sacred Harp",
    license: "CC0 1.0 / OGA-BY 3.0",
    attribution: "Egyptian meditation music by brandon75689 (submitted by HaelDB, CC0 1.0 / OGA-BY 3.0)",
    sourceUrl: "https://opengameart.org/content/egyptian-meditation-music",
  },
  {
    id: "temple-of-the-mystics",
    title: "Temple of the Mystics",
    sourceTitle: "Temple of the Mystics",
    composer: "Jason Dagenet (jdagenet)",
    src: "/assets/audio/temple-of-the-mystics.mp3",
    tag: "Mystic Alexandria",
    origin: "Ambient Temple Strings",
    license: "CC-BY-SA 3.0",
    attribution: "Temple of the Mystics by Jason Dagenet (jdagenet) · CC-BY-SA 3.0",
    sourceUrl: "https://opengameart.org/content/temple-of-the-mystics",
  },
  {
    id: "hidden-oasis",
    title: "Hidden Oasis",
    sourceTitle: "Hidden Oasis",
    composer: "Trevor Lentz",
    src: "/assets/audio/hidden-oasis.mp3",
    tag: "Desert Oasis",
    origin: "Serene Palm Grove",
    license: "CC-BY-SA 3.0",
    attribution: "Hidden Oasis by Trevor Lentz · CC-BY-SA 3.0",
    sourceUrl: "https://opengameart.org/content/hidden-oasis",
  },
  {
    id: "mediterranean-breeze",
    title: "Mediterranean Breeze",
    sourceTitle: "Mediterranean Breeze (Looping)",
    composer: "Eric Matyas",
    src: "/assets/audio/mediterranean-breeze.ogg",
    tag: "Rhakotis Shore",
    origin: "Coastal Lute & Gentle Winds",
    license: "Soundimage International Public License",
    attribution: "\"Mediterranean Breeze\" by Eric Matyas · www.soundimage.org",
    sourceUrl: "https://soundimage.org/world/",
  },
  {
    id: "desert-caravan",
    title: "Desert Caravan",
    sourceTitle: "Desert theme",
    composer: "yd",
    src: "/assets/audio/desert-caravan.ogg",
    tag: "Eastern Market",
    origin: "Acoustic Oud & Percussion",
    license: "CC0 1.0",
    attribution: "Desert theme (caravan.ogg) by yd · CC0 1.0 Public Domain",
    sourceUrl: "https://opengameart.org/content/desert-theme",
  },
  {
    id: "minstrel-dance",
    title: "Medieval: Minstrel Dance",
    sourceTitle: "Medieval: Minstrel Dance",
    composer: "RandomMind",
    src: "/assets/audio/medieval-minstrel-dance.mp3",
    tag: "Harbor Tavern",
    origin: "Lively Minstrel Lute",
    license: "CC0 1.0",
    attribution: "Medieval: Minstrel Dance by RandomMind · CC0 1.0 Public Domain",
    sourceUrl: "https://opengameart.org/content/medieval-minstrel-dance",
  },
] as const;

export const BACKGROUND_MUSIC = {
  id: "ancient-macedonian-music",
  title: "Relaxing Ancient Macedonian Music & Garden Ambience",
  composer: "Atmospherious",
  src: "/assets/audio/ancient-macedonian-music.mp3",
  sourceUrl: "https://www.youtube.com/watch?v=5ZMLYtJ0KMU",
} as const;

export interface AudioState {
  muted: boolean;
  volume: number;
  sfxEnabled: boolean;
}

const STORAGE_KEY_VOLUME = "everfolk:music:volume";
const STORAGE_KEY_MUTED = "everfolk:music:muted";
const STORAGE_KEY_SFX_VOLUME = "everfolk:audio:volume";
const STORAGE_KEY_SFX = "everfolk:audio:sfx";

export class AudioManager {
  private bgmAudio: HTMLAudioElement | null = null;
  private musicStarted = false;
  private musicStarting = false;
  private unlockInstalled = false;
  private sfxVolume = 0.6;
  private sfxAudioPool: HTMLAudioElement[] = [];
  private sfxPoolIndex = 0;
  private sfxAssetUnavailable = false;
  private audioCtx: AudioContext | null = null;
  private listeners = new Set<() => void>();
  private globalClickInstalled = false;
  private lastClickTime = 0;
  private state: AudioState = { volume: 0.6, muted: false, sfxEnabled: true };

  constructor() {
    if (typeof window === "undefined") return;
    try {
      const savedVolume = window.localStorage.getItem(STORAGE_KEY_VOLUME);
      const volume = savedVolume === null ? NaN : Number(savedVolume);
      if (Number.isFinite(volume) && volume >= 0 && volume <= 1) this.state.volume = volume;
      this.state.muted = window.localStorage.getItem(STORAGE_KEY_MUTED) === "1";
      const savedSfxVolume = window.localStorage.getItem(STORAGE_KEY_SFX_VOLUME);
      const sfxVolume = savedSfxVolume === null ? NaN : Number(savedSfxVolume);
      if (Number.isFinite(sfxVolume) && sfxVolume >= 0 && sfxVolume <= 1) this.sfxVolume = sfxVolume;
      this.state.sfxEnabled = window.localStorage.getItem(STORAGE_KEY_SFX) !== "0";
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }

  private persistSettings() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_VOLUME, String(this.state.volume));
      window.localStorage.setItem(STORAGE_KEY_MUTED, this.state.muted ? "1" : "0");
      window.localStorage.setItem(STORAGE_KEY_SFX, this.state.sfxEnabled ? "1" : "0");
    } catch {
      // Sound settings still work when storage is unavailable.
    }
  }

  public init() {
    if (typeof window === "undefined") return;
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio(BACKGROUND_MUSIC.src);
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = "metadata";
      this.bgmAudio.volume = this.state.volume;
      this.bgmAudio.muted = this.state.muted;
    }
    if (this.sfxAudioPool.length === 0 && !this.sfxAssetUnavailable) {
      try {
        for (let i = 0; i < 4; i++) {
          const sfx = new Audio(CLICK_SFX_CREDIT.src);
          sfx.preload = "auto";
          sfx.volume = this.sfxVolume * 0.85;
          sfx.addEventListener("error", () => { this.sfxAssetUnavailable = true; });
          this.sfxAudioPool.push(sfx);
        }
      } catch {
        this.sfxAssetUnavailable = true;
        this.sfxAudioPool = [];
      }
    }
    this.installGlobalClickListener();
    if (!this.unlockInstalled && !this.musicStarted) {
      this.unlockInstalled = true;
      window.addEventListener("pointerdown", this.startBackgroundMusic, { passive: true });
      window.addEventListener("keydown", this.startBackgroundMusic, { passive: true });
    }
  }

  private startBackgroundMusic = () => {
    if (!this.bgmAudio || this.musicStarted || this.musicStarting) return;
    this.musicStarting = true;
    try {
      const result = this.bgmAudio.play();
      void Promise.resolve(result).then(() => {
        this.musicStarted = true;
        window.removeEventListener("pointerdown", this.startBackgroundMusic);
        window.removeEventListener("keydown", this.startBackgroundMusic);
        this.unlockInstalled = false;
      }).catch(() => {
        // Browser autoplay restrictions can require another user gesture.
      }).finally(() => { this.musicStarting = false; });
    } catch {
      this.musicStarting = false;
    }
  };


  public installGlobalClickListener() {
    if (typeof document === "undefined" || this.globalClickInstalled) return;
    this.globalClickInstalled = true;
    document.addEventListener("click", (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, [role='button'], summary, a, input[type='button'], input[type='submit']")) {
        this.playClickSound();
      }
    }, { capture: true, passive: true });
  }

  public playClickSound() {
    if (typeof window === "undefined" || !this.state.sfxEnabled || this.sfxVolume === 0) return;
    const now = Date.now();
    if (now - this.lastClickTime < 25) return;
    this.lastClickTime = now;

    if (!this.sfxAssetUnavailable && this.sfxAudioPool.length > 0) {
      const sfx = this.sfxAudioPool[this.sfxPoolIndex];
      this.sfxPoolIndex = (this.sfxPoolIndex + 1) % this.sfxAudioPool.length;
      try {
        sfx.volume = this.sfxVolume * 0.85;
        sfx.currentTime = 0;
        void sfx.play()?.catch(() => this.synthesizeClickFallback());
        return;
      } catch {
        this.sfxAssetUnavailable = true;
      }
    }
    this.synthesizeClickFallback();
  }

  private synthesizeClickFallback() {
    if (!this.state.sfxEnabled || this.sfxVolume === 0) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext
          || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === "suspended") void this.audioCtx.resume();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.audioCtx.currentTime + 0.04);
      gain.gain.setValueAtTime(this.sfxVolume * 0.25, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);
    } catch {
      // A missing audio device must not interrupt the game.
    }
  }

  public getState(): AudioState { return this.state; }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  public setVolume(volume: number) {
    if (!Number.isFinite(volume)) return;
    this.state = { ...this.state, volume: Math.max(0, Math.min(1, volume)) };
    if (this.bgmAudio) this.bgmAudio.volume = this.state.volume;
    this.persistSettings();
    this.notify();
  }

  public toggleMute() {
    this.state = { ...this.state, muted: !this.state.muted };
    if (this.bgmAudio) this.bgmAudio.muted = this.state.muted;
    if (!this.state.muted) this.startBackgroundMusic();
    this.persistSettings();
    this.notify();
  }

  public increaseVolume(step = 0.1) { this.setVolume(this.state.volume + step); }
  public decreaseVolume(step = 0.1) { this.setVolume(this.state.volume - step); }

  public toggleSfx() {
    this.state = { ...this.state, sfxEnabled: !this.state.sfxEnabled };
    this.persistSettings();
    this.notify();
  }
}

export const audioManager = new AudioManager();
