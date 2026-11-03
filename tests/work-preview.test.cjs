const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'work-preview.js'), 'utf8');

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(handler);
    this.listeners.set(type, listeners);
  }
  dispatch(type, properties = {}) {
    const event = {
      type, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...properties,
    };
    for (const handler of this.listeners.get(type) || []) handler(event);
    return event;
  }
}

function setup({ apiLoaded = true, hover = true, reducedMotion = false, height = 240 } = {}) {
  const card = new Events();
  const frame = { height, getBoundingClientRect() { return { height: this.height }; } };
  const mount = {};
  card.dataset = { previewVideo: 'k6hnPMril98' };
  card.querySelector = (selector) => selector === '.work-study__image' ? frame : mount;
  card.matches = () => true;
  const document = new Events();
  document.hidden = false;
  document.querySelectorAll = () => [card];
  const scripts = [];
  document.head = { append(script) { scripts.push(script); } };
  document.createElement = () => ({});
  const window = new Events();
  window.location = { origin: 'http://127.0.0.1:4173' };
  const hoverMedia = Object.assign(new Events(), { matches: hover });
  const reducedMedia = Object.assign(new Events(), { matches: reducedMotion });
  window.matchMedia = (query) => query.includes('reduced-motion') ? reducedMedia : hoverMedia;
  const players = [];
  const PlayerState = { PLAYING: 1, ENDED: 0, PAUSED: 2 };
  class Player {
    constructor(target, options) {
      this.target = target;
      this.options = options;
      this.calls = [];
      this.iframe = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
      players.push(this);
    }
    mute() { this.calls.push('mute'); }
    seekTo(time, allowSeekAhead) { this.calls.push(`seek:${time}:${allowSeekAhead}`); }
    playVideo() { this.calls.push('play'); }
    pauseVideo() { this.calls.push('pause'); }
    destroy() { this.calls.push('destroy'); }
    getIframe() { return this.iframe; }
    ready() { this.options.events.onReady({ target: this }); }
    state(data) { this.options.events.onStateChange({ target: this, data }); }
    blocked() { this.options.events.onAutoplayBlocked({ target: this }); }
    error() { this.options.events.onError({ target: this, data: 101 }); }
    count(name) { return this.calls.filter((call) => call === name).length; }
  }
  const api = { Player, PlayerState };
  if (apiLoaded) window.YT = api;
  const observers = [];
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  let timerId = 0;
  const timers = new Map();
  const context = {
    window, document, IntersectionObserver,
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(source, context, { filename: 'work-preview.js' });
  return {
    card, frame, document, window, players, scripts, observers, hoverMedia, reducedMedia,
    async flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); },
    visible(ratio = 1) { observers[0].callback([{ target: card, intersectionRatio: ratio }]); },
    enter(pointerType = 'mouse') { return card.dispatch('pointerenter', { pointerType }); },
    leave() { return card.dispatch('pointerleave'); },
    resolveApi() { window.YT = api; window.onYouTubeIframeAPIReady(); },
    expire(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay === delay) { timers.delete(id); timer.callback(); }
      }
    },
  };
}

async function readyPreview(options) {
  const harness = setup(options);
  harness.visible();
  await harness.flush();
  harness.players[0].ready();
  return harness;
}

test('hover mutes before play, uses the intended video, and reveals only confirmed playback', async () => {
  const h = await readyPreview();
  const player = h.players[0];
  const before = player.calls.length;
  h.enter();
  assert.equal(h.card.dataset.previewState, 'loading');
  assert.deepEqual(player.calls.slice(before), ['mute', 'seek:0:true', 'play']);
  assert.equal(player.options.videoId, 'k6hnPMril98');
  assert.equal(player.options.playerVars.autoplay, 0);
  assert.equal(player.options.playerVars.origin, 'http://127.0.0.1:4173');
  assert.equal(player.iframe.tabIndex, -1);
  assert.equal(player.iframe.attributes['aria-hidden'], 'true');
  assert.match(player.iframe.attributes.allow, /autoplay/);
  player.state(1);
  assert.equal(h.card.dataset.previewState, 'playing');
});

test('leaving before the API resolves never starts delayed playback', async () => {
  const h = setup({ apiLoaded: false });
  h.visible();
  h.enter();
  h.leave();
  assert.equal(h.scripts.length, 1);
  h.resolveApi();
  await h.flush();
  h.players[0].ready();
  assert.equal(h.players[0].count('play'), 0);
  assert.equal(h.card.dataset.previewState, 'idle');
});

test('leaving after player construction but before ready never starts playback', async () => {
  const h = setup();
  h.visible();
  await h.flush();
  h.enter();
  h.leave();
  h.players[0].ready();
  assert.equal(h.players[0].count('play'), 0);
  assert.equal(h.card.dataset.previewState, 'idle');
});

test('normal leave pauses, restores the poster, and rehover reuses the player', async () => {
  const h = await readyPreview();
  const player = h.players[0];
  h.enter();
  player.state(1);
  const pauses = player.count('pause');
  h.leave();
  assert.equal(player.count('pause'), pauses + 1);
  assert.equal(h.card.dataset.previewState, 'idle');
  h.enter();
  player.state(1);
  assert.equal(h.players.length, 1);
  assert.equal(player.count('play'), 2);
  assert.equal(h.card.dataset.previewState, 'playing');
});

test('late PLAYING notification after leave is immediately paused', async () => {
  const h = await readyPreview();
  const player = h.players[0];
  h.enter();
  h.leave();
  const pauses = player.count('pause');
  player.state(1);
  assert.equal(player.count('pause'), pauses + 1);
  assert.equal(h.card.dataset.previewState, 'idle');
});

test('hidden document, leaving viewport, window blur, and resize pause playback', async () => {
  const h = await readyPreview();
  const player = h.players[0];
  for (const stop of [
    () => { h.document.hidden = true; h.document.dispatch('visibilitychange'); },
    () => h.visible(0),
    () => h.window.dispatch('blur'),
    () => h.window.dispatch('resize'),
  ]) {
    h.document.hidden = false;
    h.visible();
    h.enter();
    player.state(1);
    const pauses = player.count('pause');
    stop();
    assert.equal(player.count('pause'), pauses + 1);
    assert.equal(h.card.dataset.previewState, 'idle');
  }
});

test('pagehide preserves bfcache player but disposes it for actual navigation', async () => {
  const h = await readyPreview();
  const player = h.players[0];
  h.enter();
  h.window.dispatch('pagehide', { persisted: true });
  assert.equal(player.count('destroy'), 0);
  assert.equal(h.card.dataset.previewState, 'idle');
  h.enter();
  h.window.dispatch('pagehide', { persisted: false });
  assert.equal(player.count('destroy'), 1);
  assert.equal(h.observers[0].disconnected, true);
  const plays = player.count('play');
  h.enter();
  assert.equal(player.count('play'), plays);
});

test('pagehide before API completion does not create a player afterward', async () => {
  const h = setup({ apiLoaded: false });
  h.visible();
  h.enter();
  h.window.dispatch('pagehide', { persisted: false });
  h.resolveApi();
  await h.flush();
  assert.equal(h.players.length, 0);
});

test('touch pointer never requests preview playback', async () => {
  const h = await readyPreview();
  h.enter('touch');
  assert.equal(h.players[0].count('play'), 0);
  assert.equal(h.card.dataset.previewState, 'idle');
});

for (const [name, options] of [
  ['non-hover input', { hover: false }],
  ['reduced motion', { reducedMotion: true }],
  ['player shorter than 200 pixels', { height: 199 }],
]) {
  test(`${name} does not load or play a preview`, async () => {
    const h = setup(options);
    h.visible();
    h.enter();
    await h.flush();
    assert.equal(h.players.length, 0);
    assert.equal(h.scripts.length, 0);
    assert.notEqual(h.card.dataset.previewState, 'playing');
  });
}

test('autoplay block or player error falls back to thumbnail without disabling navigation', async () => {
  const h = await readyPreview();
  const player = h.players[0];
  for (const fail of [() => player.blocked(), () => player.error()]) {
    h.enter();
    fail();
    assert.equal(h.card.dataset.previewState, 'unavailable');
    const click = h.card.dispatch('click');
    assert.equal(click.defaultPrevented, false);
    assert.equal(h.card.dataset.previewState, 'idle');
  }
});

test('click during active playback pauses without preventing link navigation', async () => {
  const h = await readyPreview();
  h.enter();
  h.players[0].state(1);
  const event = h.card.dispatch('click');
  assert.equal(event.defaultPrevented, false);
  assert.equal(h.card.dataset.previewState, 'idle');
});

test('playback timeout and API load failure leave a usable thumbnail', async () => {
  const h = await readyPreview();
  h.enter();
  h.expire(12000);
  assert.equal(h.card.dataset.previewState, 'unavailable');
  const unloaded = setup({ apiLoaded: false });
  unloaded.visible();
  unloaded.enter();
  unloaded.scripts[0].onerror();
  await unloaded.flush();
  assert.equal(unloaded.card.dataset.previewState, 'unavailable');
  assert.equal(unloaded.players.length, 0);
  assert.equal(unloaded.card.dispatch('click').defaultPrevented, false);
});

test('motion preference change pauses an active preview', async () => {
  const h = await readyPreview();
  h.enter();
  h.players[0].state(1);
  h.reducedMedia.matches = true;
  h.reducedMedia.dispatch('change');
  assert.equal(h.card.dataset.previewState, 'idle');
  const plays = h.players[0].count('play');
  h.enter();
  assert.equal(h.players[0].count('play'), plays);
});
