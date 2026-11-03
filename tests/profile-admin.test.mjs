import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createFixture } from './hero-preview-server.mjs';
import { normalizeProfile, renderCareers, renderProfilePage } from '../profile-model.mjs';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=', 'base64');
test('profile edits, uploads, order and removal persist with backups and conflict protection', async t => {
  const fixture = await createFixture();
  t.after(() => fixture.close());
  await mkdir(join(fixture.root, 'assets/profile'), { recursive: true });
  await writeFile(join(fixture.root, 'assets/profile/original.png'), pixel);
  const profile = { revision: 1, name: 'JO JUNGHO', specialty: 'Rigging, CFX', careers: [{ id: 'krafton', company: 'KRAFTON Inc.', location: '서울', team: '', start: '2022-03', end: '', current: true, role: 'Rigging', position: '파트장', projects: ['시네마틱 제작'], layout: 'video', images: [{ id: 'original', src: 'assets/profile/original.png', title: 'Original', alt: 'Original', width: 1, height: 1 }] }] };
  await writeFile(join(fixture.root, 'data/profile.json'), JSON.stringify(profile));
  const session = await (await fetch(`${fixture.origin}/api/admin/session`)).json();
  const headers = { origin: fixture.origin, 'X-Portfolio-Token': session.token };
  const get = async () => (await fetch(`${fixture.origin}/api/admin/profile`)).json();
  assert.equal((await get()).careers[0].images.length, 1);
  const upload = await fetch(`${fixture.origin}/api/admin/profile/images`, { method: 'POST', headers, body: pixel });
  assert.equal(upload.status, 201);
  const { src } = await upload.json();
  assert.match(src, /^assets\/profile\/uploads\/[\w-]+\.png$/);
  assert.deepEqual(await readFile(join(fixture.root, src)), pixel);
  for (const [body, override, status] of [
    [Buffer.from('<svg onload="alert(1)"></svg>'), {}, 415],
    [pixel, { 'X-Portfolio-Token': 'invalid' }, 403],
    [pixel, { origin: 'https://example.com' }, 403],
    [Buffer.alloc(10 * 1024 * 1024 + 1), {}, 413],
  ]) {
    const response = await fetch(`${fixture.origin}/api/admin/profile/images`, { method: 'POST', headers: { ...headers, ...override }, body });
    assert.equal(response.status, status);
    await response.arrayBuffer();
  }
  const save = async (value, status = 200) => {
    const response = await fetch(`${fixture.origin}/api/admin/profile`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  };
  profile.careers[0].company = 'Edited company';
  profile.careers[0].images.unshift({ id: 'uploaded', src, title: '<script>unsafe</script> & Title', alt: 'New work', width: 1, height: 1 });
  let saved = await save(profile);
  assert.equal(saved.revision, 2);
  await save(profile, 409);
  const disk = JSON.parse(await readFile(join(fixture.root, 'data/profile.json'), 'utf8'));
  assert.deepEqual(await get(), disk);
  assert.equal(disk.careers[0].images[0].title, profile.careers[0].images[0].title);
  const rendered = renderCareers(saved);
  assert.ok(rendered.includes('&lt;script&gt;unsafe&lt;/script&gt; &amp; Title'));
  assert.ok(!rendered.includes('<script>unsafe'));
  const source = '<h1 id="profile-name">Old</h1><p class="profile-specialty">Old</p><ol class="career-list">Old</ol>';
  assert.ok(renderProfilePage(source, saved).includes('Edited company'));
  const bad = structuredClone(saved);
  bad.careers[0].images[0].src = 'assets/profile/../../admin-api.mjs';
  await save(bad, 400);
  bad.careers[0].images[0].src = 'assets/profile/missing.png';
  await save(bad, 400);
  saved.careers[0].images.pop();
  saved = await save(saved);
  assert.equal((await get()).careers[0].images.length, 1);
  assert.ok((await stat(join(fixture.root, 'assets/profile/original.png'))).isFile(), 'removing a gallery entry keeps the original asset');
  const backups = (await readdir(join(fixture.root, '.backups'))).filter(name => name.startsWith('profile-'));
  assert.equal(backups.length, 2);
  const invalidDate = structuredClone(saved);
  invalidDate.careers[0].current = false;
  invalidDate.careers[0].end = '2020-01';
  assert.throws(() => normalizeProfile(invalidDate), /기간/);
});
