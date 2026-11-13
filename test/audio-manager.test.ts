import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AudioManager, CLICK_SFX_CREDIT, PLAYLIST } from '../client/lib/audio-manager.ts';

class MockAudio extends EventTarget {
  static instances: MockAudio[] = [];
  src = '';
  loop = false;
  preload = '';
  volume = 1;
  muted = false;
  currentTime = 0;
  playCalls = 0;
  constructor(src = '') {
    super();
    this.src = src;
    MockAudio.instances.push(this);
  }
  play() {
    this.playCalls++;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  }
  pause() { this.dispatchEvent(new Event('pause')); }
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state = 'running';
  currentTime = 1;
  destination = {};
  oscillators: Array<{ type: string; starts: number; stops: number[] }> = [];
  constructor() {
    MockAudioContext.instances.push(this);
  }
  resume() { return Promise.resolve(); }
  createOscillator() {
    const osc = {
      type: 'sine',
      starts: 0,
      stops: [] as number[],
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start: () => { osc.starts++; },
      stop: (when: number) => { osc.stops.push(when); },
    };
    this.oscillators.push(osc);
    return osc;
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }
}

async function withBrowser(settings: Record<string, string>, run: (browser: EventTarget, storage: Map<string, string>) => Promise<void>) {
  const originals = ['window', 'document', 'Audio'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const storage = new Map(Object.entries(settings));
  const browser = Object.assign(new EventTarget(), {
    AudioContext: MockAudioContext,
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
  });
  MockAudio.instances = [];
  MockAudioContext.instances = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: new EventTarget() });
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: MockAudio });
  try { await run(browser, storage); }
  finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('the first gesture starts music once and later interactions preserve Pause, volume and track', async () => {
  await withBrowser({}, async (browser, storage) => {
    const manager = new AudioManager();
    manager.init();
    manager.setVolume(0.27);
    manager.selectTrack(2);
    const music = MockAudio.instances[0];
    assert.equal(music.playCalls, 0, 'initialization and preferences do not autoplay');
    browser.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    assert.equal(music.playCalls, 1, 'repeated initialization registers a single first-gesture unlock');
    assert.equal(manager.getState().isPlaying, true);
    manager.pause();
    manager.setVolume(0.42);
    manager.nextTrack();
    browser.dispatchEvent(new Event('pointerdown'));
    browser.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    assert.equal(manager.getState().isPlaying, false, 'unrelated clicks and keys must not restart paused music');
    assert.equal(music.playCalls, 1);
    assert.equal(music.volume, 0.42);
    assert.equal(music.src, PLAYLIST[3].src);
    assert.equal(storage.get('everfolk:audio:volume'), '0.42');
    assert.equal(storage.get('everfolk:audio:track-id'), PLAYLIST[3].id);
    manager.togglePlay();
    await Promise.resolve();
    assert.equal(manager.getState().isPlaying, true, 'explicit Play still resumes');
    assert.equal(music.playCalls, 2);
  });
});

test('keyboard unlock respects saved mute and explicit unmute still works', async () => {
  await withBrowser({ 'everfolk:audio:muted': '1' }, async (browser, storage) => {
    const manager = new AudioManager();
    manager.init();
    const music = MockAudio.instances[0];
    browser.dispatchEvent(new Event('keydown'));
    browser.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    assert.equal(music.playCalls, 0);
    assert.equal(manager.getState().muted, true);
    manager.toggleMute();
    await Promise.resolve();
    assert.equal(music.playCalls, 1);
    assert.equal(manager.getState().muted, false);
    assert.equal(storage.get('everfolk:audio:muted'), '0');
    manager.pause();
    browser.dispatchEvent(new Event('keydown'));
    assert.equal(manager.getState().isPlaying, false);
  });
});

test('click sound falls back to Web Audio synthesis when bundled SFX fails to load or play', async () => {
  await withBrowser({}, async () => {
    const manager = new AudioManager();
    manager.init();
    const sfxItems = MockAudio.instances.slice(1);
    assert.equal(sfxItems.length, 4);
    sfxItems[0].play = () => Promise.reject(new Error('NotSupportedError'));
    manager.playClickSound();
    await Promise.resolve();
    assert.equal(MockAudioContext.instances.length, 1);
    assert.equal(MockAudioContext.instances[0].oscillators.length, 1);

    sfxItems[1].dispatchEvent(new Event('error'));
    await new Promise(resolve => setTimeout(resolve, 30));
    const sfx2PlayBefore = sfxItems[2].playCalls;
    manager.playClickSound();
    assert.equal(sfxItems[2].playCalls, sfx2PlayBefore, 'once click asset errors, synthesis handles clicks directly');
    assert.equal(MockAudioContext.instances[0].oscillators.length, 2);
  });
});

test('background playback falls back across tracks on load error and stops cleanly if none load', async () => {
  await withBrowser({}, async () => {
    const manager = new AudioManager();
    manager.init();
    const music = MockAudio.instances[0];
    manager.play();
    await Promise.resolve();
    assert.equal(manager.getState().isPlaying, true);
    const firstId = manager.getState().currentTrack.id;
    music.dispatchEvent(new Event('error'));
    await Promise.resolve();
    assert.notEqual(manager.getState().currentTrack.id, firstId);
    for (let i = 0; i < PLAYLIST.length; i++) {
      music.dispatchEvent(new Event('error'));
      await Promise.resolve();
    }
    assert.equal(manager.getState().isPlaying, false);
  });
});

test('every bundled audio file has verified SHA-256 provenance, license notices, and aligned credits', () => {
  const audioDir = path.resolve(process.cwd(), 'public/assets/audio');
  const audioFiles = fs.readdirSync(audioDir).filter(name => /\.(?:mp3|ogg|wav)$/i.test(name)).sort();
  const manifest = JSON.parse(fs.readFileSync(path.join(audioDir, 'manifest.json'), 'utf8')) as {
    assets: Array<{
      id: string;
      file: string;
      src: string;
      kind: 'music' | 'sfx';
      title: string;
      sourceTitle: string;
      creator: string;
      license: string;
      licenseUrl: string;
      sourcePageUrl: string;
      sourceFileUrl: string;
      attribution: string;
      bytes: number;
      sha256: string;
    }>;
  };
  const attributionDoc = fs.readFileSync(path.join(audioDir, 'ATTRIBUTION.md'), 'utf8');
  const licensesDoc = fs.readFileSync(path.join(audioDir, 'LICENSES.txt'), 'utf8');

  assert.deepEqual(
    manifest.assets.map(a => a.file).sort(),
    audioFiles,
    'every bundled audio file on disk must be recorded in manifest.json',
  );

  for (const entry of manifest.assets) {
    const buf = fs.readFileSync(path.join(audioDir, entry.file));
    const digest = crypto.createHash('sha256').update(buf).digest('hex');
    assert.equal(buf.length, entry.bytes, `${entry.file} byte size matches manifest`);
    assert.equal(digest, entry.sha256, `${entry.file} SHA-256 matches manifest`);
    assert.ok(entry.sourcePageUrl.startsWith('https://'), `${entry.file} sourcePageUrl recorded`);
    assert.ok(entry.sourceFileUrl.startsWith('https://'), `${entry.file} sourceFileUrl recorded`);
    assert.ok(entry.licenseUrl.startsWith('https://'), `${entry.file} licenseUrl recorded`);
    assert.ok(attributionDoc.includes(entry.sha256), `${entry.file} SHA-256 recorded in ATTRIBUTION.md`);
    assert.ok(attributionDoc.includes(entry.sourcePageUrl), `${entry.file} source URL recorded in ATTRIBUTION.md`);
    assert.ok(attributionDoc.includes(entry.creator), `${entry.file} creator recorded in ATTRIBUTION.md`);
  }

  assert.ok(licensesDoc.includes('Soundimage International Public License'));
  assert.ok(licensesDoc.includes('CC-BY-SA 3.0'));
  assert.ok(licensesDoc.includes('CC-BY 3.0'));
  assert.ok(licensesDoc.includes('CC0 1.0'));

  const musicEntries = manifest.assets.filter(a => a.kind === 'music');
  assert.equal(PLAYLIST.length, musicEntries.length);
  for (const track of PLAYLIST) {
    const record = musicEntries.find(a => a.id === track.id && a.src === track.src);
    assert.ok(record, `${track.id} exists in manifest`);
    assert.equal(track.composer, record.creator);
    assert.equal(track.sourceTitle, record.sourceTitle);
    assert.equal(track.license, record.license);
    assert.equal(track.attribution, record.attribution);
    assert.equal(track.sourceUrl, record.sourcePageUrl);
  }

  const sfxEntry = manifest.assets.find(a => a.kind === 'sfx');
  assert.ok(sfxEntry);
  assert.equal(CLICK_SFX_CREDIT.src, sfxEntry.src);
  assert.equal(CLICK_SFX_CREDIT.creator, sfxEntry.creator);
  assert.equal(CLICK_SFX_CREDIT.license, sfxEntry.license);
  assert.equal(CLICK_SFX_CREDIT.attribution, sfxEntry.attribution);
  assert.equal(CLICK_SFX_CREDIT.sourceUrl, sfxEntry.sourcePageUrl);
});
