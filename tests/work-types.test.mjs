import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFixture } from './hero-preview-server.mjs';
import { getWorkTypes, normalizeVideo } from '../content-model.mjs';

test('WORKS types persist, reject duplicates and work in video edits, details and hero selection', async t => {
  const fixture = await createFixture();
  t.after(() => fixture.close());
  const session = await (await fetch(`${fixture.origin}/api/admin/session`)).json();
  let store = await (await fetch(`${fixture.origin}/api/admin/videos`)).json();
  const originalVideos = structuredClone(store.videos);
  assert.deepEqual(getWorkTypes(store).map(type => type.id), ['showreel', 'rigging']);
  async function write(path, body, expected = 201, method = 'POST') {
    const response = await fetch(`${fixture.origin}/api/admin/${path}`, { method,
      headers: { origin: fixture.origin, 'Content-Type': 'application/json', 'X-Portfolio-Token': session.token }, body: JSON.stringify(body) });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    if (response.ok) store = result;
    return result;
  }
  await write('work-types', { revision: store.revision, title: '  CFX  ' });
  const cfx = getWorkTypes(store).find(type => type.title === 'CFX');
  assert.ok(cfx.id.startsWith('work-'));
  assert.deepEqual(store.videos, originalVideos, 'adding a type must not edit videos');
  for (const title of ['', '  ', 'cfx', 'Ｒｉｇｇｉｎｇ', 'ALL', '전체', 'x'.repeat(41)]) {
    await write('work-types', { revision: store.revision, title }, 400);
  }
  await write('work-types', { revision: 1, title: 'Stale update' }, 409);
  await write('work-types', { revision: store.revision, title: '시뮬레이션' });
  assert.deepEqual(getWorkTypes(store).map(type => type.title), ['ShowReel', 'Rigging', 'CFX', '시뮬레이션']);
  await write('videos/test-one', { revision: store.revision, video: { ...store.videos[0], workType: cfx.id } }, 200, 'PATCH');
  assert.equal(store.videos[0].workType, cfx.id);
  assert.deepEqual(store.videos[0].heroSlots, [1]);
  await write('videos', { revision: store.revision, video: { ...store.videos[0], title: 'New CFX work', heroSlots: [] } });
  assert.equal(store.videos[0].workType, cfx.id);
  await write('videos/test-one', { revision: store.revision, video: { ...store.videos[0], workType: 'work-nonexistent' } }, 400, 'PATCH');
  const disk = JSON.parse(await readFile(join(fixture.root, 'data/videos.json'), 'utf8'));
  const publicStore = await (await fetch(`${fixture.origin}/data/videos.json`)).json();
  assert.deepEqual(publicStore, disk);
  assert.deepEqual(disk.workTypes, store.workTypes);
  const normalized = disk.videos.map(video => normalizeVideo(video, getWorkTypes(disk)));
  assert.equal(normalized.length, 3, 'custom types must not hide videos in public readers');
  assert.ok(normalized.some(video => video.workType === cfx.id && video.heroSlots.includes(1)));
});
