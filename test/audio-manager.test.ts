import assert from 'node:assert/strict';
import test from 'node:test';
import { AudioManager, PLAYLIST } from '../client/lib/audio-manager.ts';

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

async function withBrowser(settings: Record<string, string>, run: (browser: EventTarget, storage: Map<string, string>) => Promise<void>) {
  const originals = ['window', 'document', 'Audio'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const storage = new Map(Object.entries(settings));
  const browser = Object.assign(new EventTarget(), {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
  });
  MockAudio.instances = [];
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
