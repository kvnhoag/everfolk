import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AudioManager, BACKGROUND_MUSIC, CLICK_SFX_CREDIT, PLAYLIST } from '../client/lib/audio-manager.ts';

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
  constructor() { MockAudioContext.instances.push(this); }
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

test('first gesture starts one fixed looping music track and repeated initialization keeps one click pool', async () => {
  await withBrowser({ 'everfolk:audio:track-id': 'hidden-oasis' }, async browser => {
    const manager = new AudioManager();
    manager.init();
    manager.init();
    const music = MockAudio.instances.find(audio => audio.src === BACKGROUND_MUSIC.src);
    const clicks = MockAudio.instances.filter(audio => audio.src === CLICK_SFX_CREDIT.src);
    assert.equal(MockAudio.instances.length, 5, 'one background track plus one pool of four click sounds');
    assert.equal(clicks.length, 4);
    assert.ok(music);
    assert.equal(music.src, '/assets/audio/ancient-macedonian-music.mp3');
    assert.equal(music.loop, true);
    assert.equal(music.preload, 'metadata');
    assert.equal(music.playCalls, 0, 'music waits for a user gesture');
    browser.dispatchEvent(new Event('pointerdown'));
    browser.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    assert.equal(music.playCalls, 1, 'repeated gestures do not restart background music');
    assert.equal(music.volume, 0.6);
    assert.equal(music.muted, false);
    assert.deepEqual(manager.getState(), { volume: 0.6, muted: false, sfxEnabled: true });

    browser.dispatchEvent(new Event('pointerdown'));
    assert.equal(music.playCalls, 1);
    const click = new Event('click');
    Object.defineProperty(click, 'target', { value: { closest: () => ({}) } });
    document.dispatchEvent(click);
    await Promise.resolve();
    assert.equal(clicks.reduce((sum, audio) => sum + audio.playCalls, 0), 1, 'repeated init does not duplicate global click listeners');
  });
});

test('a rejected first playback attempt retries on the next gesture without allocating another music track', async () => {
  await withBrowser({}, async browser => {
    const manager = new AudioManager();
    manager.init();
    const music = MockAudio.instances.find(audio => audio.src === BACKGROUND_MUSIC.src);
    assert.ok(music);
    let attempts = 0;
    music.play = () => {
      attempts++;
      return attempts === 1 ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve();
    };
    browser.dispatchEvent(new Event('pointerdown'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(attempts, 1);
    browser.dispatchEvent(new Event('keydown'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(attempts, 2);
    browser.dispatchEvent(new Event('pointerdown'));
    assert.equal(attempts, 2, 'successful playback removes the gesture retry listeners');
    assert.equal(MockAudio.instances.filter(audio => audio.src === BACKGROUND_MUSIC.src).length, 1);
  });
});

test('saved music volume and mute persist independently of sound-effect settings', async () => {
  await withBrowser({
    'everfolk:music:volume': '0.27',
    'everfolk:music:muted': '1',
    'everfolk:audio:volume': '0.81',
    'everfolk:audio:sfx': '0',
    'everfolk:audio:track-id': 'hidden-oasis',
  }, async (browser, storage) => {
    const manager = new AudioManager();
    assert.deepEqual(manager.getState(), { volume: 0.27, muted: true, sfxEnabled: false });
    manager.init();
    browser.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    const music = MockAudio.instances.find(audio => audio.src === BACKGROUND_MUSIC.src);
    assert.ok(music);
    assert.equal(music.volume, 0.27);
    assert.equal(music.muted, true);
    manager.setVolume(0.42);
    manager.toggleMute();
    assert.deepEqual(manager.getState(), { volume: 0.42, muted: false, sfxEnabled: false });
    assert.equal(music.volume, 0.42);
    assert.equal(music.muted, false);
    assert.equal(storage.get('everfolk:music:volume'), '0.42');
    assert.equal(storage.get('everfolk:music:muted'), '0');
    assert.equal(storage.get('everfolk:audio:volume'), '0.81', 'music changes preserve saved SFX volume');
    assert.equal(storage.get('everfolk:audio:sfx'), '0');
    assert.deepEqual(new AudioManager().getState(), { volume: 0.42, muted: false, sfxEnabled: false });
    manager.setVolume(2);
    assert.equal(manager.getState().volume, 1);
    assert.equal(music.volume, 1);
    manager.setVolume(-1);
    assert.equal(manager.getState().volume, 0);
    assert.equal(music.volume, 0);
  });
});

test('muting or lowering music to zero preserves click sound effects', async () => {
  await withBrowser({}, async () => {
    const manager = new AudioManager();
    manager.init();
    manager.toggleMute();
    manager.setVolume(0);
    manager.playClickSound();
    const clicks = MockAudio.instances.filter(audio => audio.src === CLICK_SFX_CREDIT.src);
    assert.equal(clicks.reduce((sum, audio) => sum + audio.playCalls, 0), 1, 'music controls do not disable click sounds');
    assert.ok(clicks[0].volume > 0);
  });
});

test('saved disabled sound effects do not play bundled or synthesized audio', async () => {
  await withBrowser({ 'everfolk:audio:sfx': '0' }, async () => {
    const manager = new AudioManager();
    manager.init();
    manager.playClickSound();
    assert.equal(MockAudio.instances.reduce((sum, audio) => sum + audio.playCalls, 0), 0);
    assert.equal(MockAudioContext.instances.length, 0);
  });
});

test('click sound falls back to Web Audio synthesis when bundled SFX fails to load or play', async () => {
  await withBrowser({}, async () => {
    const manager = new AudioManager();
    manager.init();
    const sfxItems = MockAudio.instances.filter(audio => audio.src === CLICK_SFX_CREDIT.src);
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

  assert.ok(
    fs.existsSync(path.join(audioDir, path.basename(BACKGROUND_MUSIC.src))),
    'Requested background music MP3 is missing: public/assets/audio/ancient-macedonian-music.mp3',
  );
  const musicEntries = manifest.assets.filter(a => a.kind === 'music');
  assert.equal(musicEntries.length, PLAYLIST.length + 1, 'legacy tracks and the fixed local background track have provenance');
  const background = musicEntries.find(a => a.id === BACKGROUND_MUSIC.id && a.src === BACKGROUND_MUSIC.src);
  assert.ok(background, 'the new local background track is recorded in the manifest');
  assert.equal(background.creator, BACKGROUND_MUSIC.composer);
  assert.equal(background.sourcePageUrl, BACKGROUND_MUSIC.sourceUrl);
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
