import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAdminAPI } from '../admin-api.mjs';

// A disposable data store; public assets are read from the running local preview.
export async function createFixture(port = 0) {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-hero-test-'));
  await mkdir(join(root, 'data'));
  const video = (id, youtubeId, title, heroSlots) => ({ id, type: 'youtube', youtubeId, title, category: 'game-cinematic', workType: 'showreel', description: 'Test fixture', role: '', channel: '', heroSlots, deletedAt: null });
  await writeFile(join(root, 'data/videos.json'), JSON.stringify({ version: 1, revision: 1, videos: [
    video('test-one', 'k6hnPMril98', 'TEST VIDEO ONE', [1]),
    video('test-two', 'M7lc1UVf-VE', 'TEST VIDEO TWO', [2]),
  ] }));
  const api = createAdminAPI(root);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (await api(request, response, url)) return;
      if (url.pathname === '/data/videos.json') {
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(await readFile(join(root, 'data/videos.json'))); return;
      }
      const upstream = await fetch(`http://127.0.0.1:4173${url.pathname}${url.search}`, {
        headers: request.headers.range ? { range: request.headers.range } : {},
      });
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'text/plain', 'Cache-Control': 'no-store', ...(upstream.headers.has('content-range') ? { 'Content-Range': upstream.headers.get('content-range') } : {}) });
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { response.writeHead(500); response.end('Fixture unavailable'); }
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { root, origin: `http://127.0.0.1:${server.address().port}`, async close() {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    if (dirname(root) !== tmpdir() || !basename(root).startsWith('portfolio-hero-test-')) throw new Error('Invalid fixture cleanup path');
    await rm(root, { recursive: true, force: true });
  } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await createFixture(Number(process.argv[2] || 4174));
  console.log(`Isolated hero preview: ${fixture.origin}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await fixture.close(); process.exit(); });
}
