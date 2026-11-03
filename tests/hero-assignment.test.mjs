import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFixture } from './hero-preview-server.mjs';

test('hero assignments persist, replace per slot, clear on uncheck/delete, and validate writes', async t => {
  const fixture = await createFixture();
  t.after(() => fixture.close());
  const session = await (await fetch(`${fixture.origin}/api/admin/session`)).json();
  let store = await (await fetch(`${fixture.origin}/api/admin/videos`)).json();
  async function write(path, method, body, expected = 200) {
    const response = await fetch(`${fixture.origin}/api/admin/${path}`, { method,
      headers: { origin: fixture.origin, 'Content-Type': 'application/json', 'X-Portfolio-Token': session.token }, body: JSON.stringify(body) });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    if (response.ok) store = result;
    return result;
  }
  const item = id => store.videos.find(video => video.id === id);
  await write('videos/test-one', 'PATCH', { revision: store.revision, video: { ...item('test-one'), heroSlots: [1, 2, 2] } });
  assert.deepEqual(item('test-one').heroSlots, [1, 2]);
  assert.deepEqual(item('test-two').heroSlots, []);
  await write('videos/test-two', 'PATCH', { revision: store.revision, video: { ...item('test-two'), heroSlots: [2] } });
  assert.deepEqual(item('test-one').heroSlots, [1]);
  assert.deepEqual(item('test-two').heroSlots, [2]);
  const saved = JSON.parse(await readFile(join(fixture.root, 'data/videos.json'), 'utf8'));
  assert.deepEqual(saved.videos, store.videos);
  const revision = store.revision;
  await write('videos/test-one', 'PATCH', { revision, video: { ...item('test-one'), heroSlots: [3] } }, 400);
  await write('videos/test-one', 'PATCH', { revision: 1, video: { ...item('test-one'), heroSlots: [2] } }, 409);
  assert.equal((await (await fetch(`${fixture.origin}/api/admin/videos`)).json()).revision, revision);
  await write('videos/test-one', 'PATCH', { revision, video: { ...item('test-one'), heroSlots: [] } });
  assert.deepEqual(item('test-one').heroSlots, []);
  await write('videos/test-two', 'DELETE', { revision: store.revision });
  assert.deepEqual(item('test-two').heroSlots, []);
  assert.ok(item('test-two').deletedAt);
  await write('videos/test-two/restore', 'POST', { revision: store.revision });
  assert.equal(item('test-two').deletedAt, null);
  assert.deepEqual(item('test-two').heroSlots, []);
  await write('videos', 'POST', { revision: store.revision, video: { ...item('test-two'), title: 'New hero', heroSlots: [1, 2] } }, 201);
  assert.deepEqual(store.videos[0].heroSlots, [1, 2]);
  assert.ok(store.videos.slice(1).every(video => !video.heroSlots.length));
});
