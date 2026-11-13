import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

// Tiny self-contained DOM implementation sufficient to mount React 19 createRoot
// and verify real focus, Escape, Close button, Space keydown preventDefault, and outside-click behavior.
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

  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)); }
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

function keyEvent(type: string, key: string, repeat = false): Event {
  return Object.assign(new Event(type, { bubbles: true, cancelable: true }), { key, repeat });
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

test('audio settings drawer moves focus in, prevents Space scroll, allows nonmodal outside click, and restores focus on Escape and Close', async () => {
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
    const { audioManager, PLAYLIST } = await import('../client/lib/audio-manager.ts');

    const outsideButton = new FakeElement('button', doc);
    doc.body.appendChild(outsideButton);
    const mount = new FakeElement('div', doc);
    doc.body.appendChild(mount);
    const root = createRoot(mount as unknown as Element);

    await act(async () => {
      root.render(createElement(GameMusicPlayer));
    });

    const trigger = mount.querySelector('.music-square-trigger');
    assert.ok(trigger);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');

    // Open with trigger -> focus moves into the opened settings panel.
    trigger.focus();
    await act(async () => {
      trigger.dispatchEvent(new Event('click', { bubbles: true }));
    });
    const drawer = mount.querySelector('.music-drawer');
    const closeBtn = mount.querySelector('.music-drawer-close');
    assert.ok(drawer);
    assert.ok(closeBtn);
    assert.equal(drawer.getAttribute('aria-modal'), 'false');
    assert.equal(doc.activeElement === closeBtn, true, 'focus moves into opened drawer without trapping keyboard navigation');

    // Selecting a playlist option with Space calls preventDefault (no page scroll) and selects track.
    const tracks = mount.querySelectorAll('.music-track-item');
    assert.equal(tracks.length, PLAYLIST.length);
    tracks[2].focus();
    const spaceKeydown = keyEvent('keydown', ' ');
    await act(async () => {
      tracks[2].dispatchEvent(spaceKeydown);
    });
    assert.equal(spaceKeydown.defaultPrevented, true, 'Space keydown prevents default scroll');
    assert.equal(audioManager.getState().currentTrack.id, PLAYLIST[2].id);
    assert.equal(tracks[2].getAttribute('aria-pressed'), 'true');

    // Pressing Escape closes drawer and restores focus to trigger.
    const escapeKeydown = keyEvent('keydown', 'Escape');
    await act(async () => {
      doc.dispatchEvent(escapeKeydown);
    });
    assert.equal(escapeKeydown.defaultPrevented, true);
    assert.equal(mount.querySelector('.music-drawer') === null, true, 'Escape closes drawer');
    assert.equal(doc.activeElement === trigger, true, 'Escape restores focus to trigger');

    // Reopen and close via Close button -> restores focus to trigger.
    await act(async () => {
      trigger.dispatchEvent(new Event('click', { bubbles: true }));
    });
    const closeBtn2 = mount.querySelector('.music-drawer-close');
    assert.ok(closeBtn2);
    assert.equal(doc.activeElement === closeBtn2, true, 'Reopening moves focus into drawer');
    await act(async () => {
      closeBtn2.dispatchEvent(new Event('click', { bubbles: true }));
    });
    assert.equal(mount.querySelector('.music-drawer') === null, true, 'Close button closes drawer');
    assert.equal(doc.activeElement === trigger, true, 'Close button restores focus to trigger');

    // Nonmodal outside click closes the drawer without hijacking focus away from outside control.
    await act(async () => {
      trigger.dispatchEvent(new Event('click', { bubbles: true }));
    });
    assert.ok(mount.querySelector('.music-drawer'));
    outsideButton.focus();
    await act(async () => {
      outsideButton.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    assert.equal(mount.querySelector('.music-drawer') === null, true, 'outside click closes nonmodal drawer');
    assert.equal(doc.activeElement === outsideButton, true, 'nonmodal outside click leaves focus on outside target');

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
