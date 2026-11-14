import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

// Tiny self-contained DOM implementation sufficient to mount React 19 createRoot
// and verify accessible inline music controls, focus, state updates, and preserved click effects.
class FakeNode extends EventTarget {
  nodeType: number;
  ownerDocument: FakeDocument;
  parentNode: FakeNode | null = null;
  childNodes: FakeNode[] = [];
  style: Record<string, string> = {};
  tabIndex = 0;

  constructor(nodeType: number, ownerDocument: FakeDocument) {
    super();
    this.nodeType = nodeType;
    this.ownerDocument = ownerDocument;
  }

  appendChild(child: FakeNode): FakeNode {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(child: FakeNode, ref: FakeNode | null): FakeNode {
    if (!ref) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child);
    const idx = this.childNodes.indexOf(ref);
    if (idx === -1) return this.appendChild(child);
    child.parentNode = this;
    this.childNodes.splice(idx, 0, child);
    return child;
  }

  removeChild(child: FakeNode): FakeNode {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  contains(other: FakeNode | null): boolean {
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx >= 0 ? this.parentNode.childNodes[idx + 1] ?? null : null;
  }
  get textContent(): string {
    return this.childNodes.map(c => c.textContent).join('');
  }
  set textContent(value: string) {
    this.childNodes = [];
    if (value) this.appendChild(new FakeText(value, this.ownerDocument));
  }
}

class FakeText extends FakeNode {
  data: string;
  constructor(data: string, doc: FakeDocument) {
    super(3, doc);
    this.data = data;
  }
  get nodeValue() { return this.data; }
  set nodeValue(v: string) { this.data = v; }
  get textContent() { return this.data; }
  set textContent(v: string) { this.data = v; }
}

class FakeComment extends FakeNode {
  data: string;
  constructor(data: string, doc: FakeDocument) {
    super(8, doc);
    this.data = data;
  }
  get textContent() { return ''; }
}

class FakeElement extends FakeNode {
  tagName: string;
  nodeName: string;
  namespaceURI = 'http://www.w3.org/1999/xhtml';
  attributes = new Map<string, string>();
  type = '';
  value = '';
  disabled = false;
  focusOptions: Array<FocusOptions | undefined> = [];

  constructor(tagName: string, doc: FakeDocument) {
    super(1, doc);
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
  }

  get className() { return this.attributes.get('class') ?? ''; }
  set className(v: string) { this.attributes.set('class', v); }
  get id() { return this.attributes.get('id') ?? ''; }
  set id(v: string) { this.attributes.set('id', v); }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
    if (name === 'type') this.type = String(value);
  }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string) { this.attributes.delete(name); }
  hasAttribute(name: string) { return this.attributes.has(name); }

  focus(options?: FocusOptions) {
    this.focusOptions.push(options);
    this.ownerDocument.activeElement = this;
  }

  blur() {
    if (this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = this.ownerDocument.body;
    }
  }

  override dispatchEvent(event: Event): boolean {
    if (!event.target) {
      Object.defineProperty(event, 'target', { configurable: true, value: this });
    }
    const ok = super.dispatchEvent(event);
    const parent = this.parentNode;
    if (event.bubbles && parent) {
      return parent.dispatchEvent(event) && ok;
    }
    return ok;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const out: FakeElement[] = [];
    const visit = (node: FakeNode) => {
      for (const child of node.childNodes) {
        if (child instanceof FakeElement) {
          if (matches(child, selector)) out.push(child);
          visit(child);
        }
      }
    };
    visit(this);
    return out;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  closest(selector: string): FakeElement | null {
    let cur: FakeNode | null = this;
    while (cur) {
      if (cur instanceof FakeElement && matches(cur, selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
}

function matches(el: FakeElement, selector: string): boolean {
  return selector.split(',').map(part => part.trim()).some(part => {
    if (!part) return false;
    if (part.startsWith('.')) return el.className.split(/\s+/).includes(part.slice(1));
    const attrMatch = /^([a-zA-Z0-9_-]+)?\[([a-zA-Z0-9_-]+)=['"]([^'"]*)['"]\]$/.exec(part);
    if (attrMatch) {
      const [, tag, attr, val] = attrMatch;
      if (tag && el.tagName !== tag.toUpperCase()) return false;
      return el.getAttribute(attr) === val || (attr === 'type' && el.type === val);
    }
    return el.tagName === part.toUpperCase();
  });
}

class FakeDocument extends FakeNode {
  documentElement: FakeElement;
  body: FakeElement;
  activeElement: FakeElement | null = null;
  defaultView: unknown = null;
  oninput = null;

  constructor() {
    super(9, null as unknown as FakeDocument);
    this.ownerDocument = this;
    this.documentElement = new FakeElement('html', this);
    this.body = new FakeElement('body', this);
    this.appendChild(this.documentElement);
    this.documentElement.appendChild(this.body);
    this.activeElement = this.body;
  }

  createElement(tag: string) { return new FakeElement(tag, this); }
  createElementNS(_ns: string, tag: string) { return new FakeElement(tag, this); }
  createTextNode(text: string) { return new FakeText(text, this); }
  createComment(text: string) { return new FakeComment(text, this); }
}

class MockAudio extends EventTarget {
  src = '';
  loop = false;
  preload = '';
  volume = 1;
  muted = false;
  currentTime = 0;
  play() { this.dispatchEvent(new Event('play')); return Promise.resolve(); }
  pause() { this.dispatchEvent(new Event('pause')); }
}

test('inline music controls expose one native volume slider and mute while preserving focus and click effects', async () => {
  const originals = [
    'window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLIFrameElement', 'Audio', 'IS_REACT_ACT_ENVIRONMENT',
  ].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const);

  const storage = new Map<string, string>();
  const doc = new FakeDocument();
  class FakeIframe {}
  const browser = Object.assign(new EventTarget(), {
    document: doc,
    HTMLIFrameElement: FakeIframe,
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
  });
  doc.defaultView = browser;
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'Node', { configurable: true, value: FakeNode });
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: FakeElement });
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: FakeElement });
  Object.defineProperty(globalThis, 'HTMLIFrameElement', { configurable: true, value: FakeIframe });
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: MockAudio });

  const hooks = registerHooks({
    load(url, context, nextLoad) {
      if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true };
      if (url.endsWith('.tsx')) {
        return {
          format: 'module',
          shortCircuit: true,
          source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
            fileName: new URL(url).pathname,
          }).outputText,
        };
      }
      return nextLoad(url, context);
    },
  });

  try {
    const { act, createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { default: GameMusicPlayer } = await import('../client/components/GameMusicPlayer.tsx');
    const { audioManager } = await import('../client/lib/audio-manager.ts');

    const mount = new FakeElement('div', doc);
    doc.body.appendChild(mount);
    const root = createRoot(mount as unknown as Element);
    await act(async () => { root.render(createElement(GameMusicPlayer)); });

    const controls = mount.querySelector('[aria-label="Music controls"]');
    assert.ok(controls);
    assert.equal(controls.getAttribute('role'), 'group');
    assert.equal(mount.querySelectorAll('.music-square-trigger').length, 0, 'no popover trigger');
    assert.equal(mount.querySelectorAll('.music-drawer').length, 0, 'no settings drawer');
    assert.equal(mount.querySelectorAll('.music-track-item').length, 0, 'the old six-track selector is removed');
    assert.equal(mount.querySelectorAll('.music-playlist-section').length, 0);
    assert.equal(mount.querySelectorAll('.music-stepper-btns').length, 0, 'no previous/next controls');
    assert.equal(mount.querySelectorAll('.music-sfx-toggle').length, 0, 'click effects do not need a visible toggle');
    assert.equal(mount.querySelectorAll('iframe').length, 0, 'no visible YouTube player');
    assert.equal(mount.querySelectorAll('audio, video').length, 0, 'background playback is owned outside the UI');
    assert.equal(controls.querySelectorAll('button').length, 1, 'mute is the only button');

    const sliders = controls.querySelectorAll('input[type="range"]');
    assert.equal(sliders.length, 1, 'one native keyboard-accessible volume slider');
    const slider = sliders[0];
    assert.equal(slider.getAttribute('aria-label'), 'Music volume');
    assert.equal(slider.getAttribute('min'), '0');
    assert.equal(slider.getAttribute('max'), '100');
    slider.focus();
    assert.equal(doc.activeElement, slider);

    const mute = controls.querySelector('button[aria-label="Mute music"]');
    assert.ok(mute);
    assert.equal(mute.getAttribute('aria-pressed'), 'false');
    const sfxBeforeMute = audioManager.getState().sfxEnabled;
    mute.focus();
    await act(async () => { mute.dispatchEvent(new Event('click', { bubbles: true })); });
    const unmute = controls.querySelector('button[aria-label="Unmute music"]');
    assert.ok(unmute);
    assert.equal(unmute, mute, 'toggle keeps the same keyboard focus target');
    assert.equal(doc.activeElement, mute);
    assert.equal(unmute.getAttribute('aria-pressed'), 'true');
    assert.equal(audioManager.getState().muted, true);
    assert.equal(audioManager.getState().sfxEnabled, sfxBeforeMute, 'muting music preserves sound effects');

    slider.value = '25';
    await act(async () => { slider.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(audioManager.getState().volume, 0.25, 'the slider updates music volume');
    assert.equal(audioManager.getState().muted, true, 'changing volume preserves mute');
    await act(async () => { unmute.dispatchEvent(new Event('click', { bubbles: true })); });
    assert.equal(audioManager.getState().muted, false);
    assert.equal(audioManager.getState().sfxEnabled, sfxBeforeMute);

    await act(async () => { root.unmount(); });
    await new Promise(resolve => setTimeout(resolve, 20));
  } finally {
    hooks.deregister();
    for (const [k, d] of originals) {
      if (d) Object.defineProperty(globalThis, k, d);
      else Reflect.deleteProperty(globalThis, k);
    }
  }
});
