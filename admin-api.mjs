import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { categories, normalizeVideo, youtubeId, assignHeroSlots, getWorkTypes, normalizeWorkTypeTitle } from './content-model.mjs';
import { createProfileAdmin } from './profile-admin.mjs';

export function createAdminAPI(root) {
  const profileAdmin = createProfileAdmin(root);
  const token = randomBytes(32).toString('hex');
  const dataFile = join(root, 'data', 'videos.json');
  let queue = Promise.resolve();
  const read = async () => JSON.parse(await readFile(dataFile, 'utf8'));
  const reply = (response, status, value) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify(value));
  };
  const error = (status, message) => Object.assign(new Error(message), { status });
  async function body(request) {
    if (!(request.headers['content-type'] || '').startsWith('application/json')) throw error(415, 'JSON 형식이 필요합니다.');
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 65536) throw error(413, '입력 내용이 너무 큽니다.');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw error(400, '입력 내용을 읽을 수 없습니다.'); }
  }
  async function commit(input, change) {
    const operation = queue.then(async () => {
      const store = await read();
      if (input.revision !== store.revision) throw error(409, '다른 창에서 목록이 변경되었습니다. 최신 목록을 확인한 뒤 다시 저장해주세요.');
      await change(store);
      store.revision += 1;
      const backupDir = join(root, '.backups');
      await mkdir(backupDir, { recursive: true });
      await writeFile(join(backupDir, `videos-${Date.now()}-${randomUUID()}.json`), await readFile(dataFile), { flag: 'wx' });
      const temporary = `${dataFile}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(store, null, 2) + '\n', { flag: 'wx' });
        await rename(temporary, dataFile);
      } finally { await unlink(temporary).catch(() => {}); }
      return store;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return async function adminAPI(request, response, url) {
    if (!url.pathname.startsWith('/api/admin/')) return false;
    try {
      const origin = `http://${request.headers.host}`;
      if (request.headers['sec-fetch-site'] === 'cross-site') throw error(403, '이 컴퓨터의 관리 화면에서 실행해주세요.');
      const writing = !['GET', 'HEAD'].includes(request.method);
      if (writing && (request.headers.origin !== origin || request.headers['x-portfolio-token'] !== token)) throw error(403, '관리 화면을 새로고침한 뒤 다시 시도해주세요.');
      if (url.pathname === '/api/admin/profile' || url.pathname === '/api/admin/profile/images') {
        await profileAdmin(request, response, url, reply);
      } else if (request.method === 'GET' && url.pathname === '/api/admin/session') {
        reply(response, 200, { token, categories });
      } else if (request.method === 'GET' && url.pathname === '/api/admin/videos') {
        reply(response, 200, await read());
      } else if (request.method === 'POST' && url.pathname === '/api/admin/work-types') {
        const input = await body(request);
        const store = await commit(input, store => {
          const availableTypes = getWorkTypes(store);
          const title = normalizeWorkTypeTitle(input.title, availableTypes);
          store.workTypes = [...availableTypes, { id: `work-${randomUUID()}`, title }];
        });
        reply(response, 201, store);
      } else if (request.method === 'GET' && url.pathname === '/api/admin/youtube') {
        const id = youtubeId(url.searchParams.get('url'));
        if (!id) throw error(400, 'YouTube 주소를 확인해주세요.');
        const endpoint = new URL('https://www.youtube.com/oembed');
        endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${id}`);
        endpoint.searchParams.set('format', 'json');
        const result = await fetch(endpoint, { signal: AbortSignal.timeout(7000) });
        if (!result.ok) throw error(422, '제목을 자동으로 가져올 수 없습니다. 직접 입력해 저장할 수 있습니다.');
        const metadata = await result.json();
        reply(response, 200, { title: String(metadata.title || '').slice(0, 120), channel: String(metadata.author_name || '').slice(0, 200) });
      } else if (url.pathname === '/api/admin/videos/order' && request.method === 'PATCH') {
        const input = await body(request);
        const category = input.category || '';
        if (category && !categories.some(item => item.id === category)) throw error(400, '카테고리를 확인해주세요.');
        if (!Array.isArray(input.ids) || input.ids.some(id => typeof id !== 'string') || new Set(input.ids).size !== input.ids.length) throw error(400, '영상 순서가 올바르지 않습니다.');
        const store = await commit(input, store => {
          const inScope = video => !video.deletedAt && (!category || video.category === category);
          const records = new Map(store.videos.filter(inScope).map(video => [video.id, video]));
          if (input.ids.length !== records.size || input.ids.some(id => !records.has(id))) throw error(400, '현재 목록의 모든 영상을 포함해 순서를 저장해주세요.');
          let index = 0;
          store.videos = store.videos.map(video => inScope(video) ? records.get(input.ids[index++]) : video);
        });
        reply(response, 200, store);
      } else if (url.pathname === '/api/admin/videos' && request.method === 'POST') {
        const input = await body(request);
        const now = new Date().toISOString();
        const store = await commit(input, store => {
          const video = normalizeVideo(input.video, getWorkTypes(store));
          const created = { ...video, id: randomUUID(), createdAt: now, updatedAt: now, deletedAt: null };
          assignHeroSlots(store.videos, created, video.heroSlots, now);
          store.videos.unshift(created);
        });
        reply(response, 201, store);
      } else {
        const match = /^\/api\/admin\/videos\/([\w-]+)(\/restore)?$/.exec(url.pathname);
        if (!match || !['PATCH', 'DELETE', 'POST'].includes(request.method)) throw error(404, '요청한 기능을 찾을 수 없습니다.');
        if ((request.method === 'POST') !== Boolean(match[2])) throw error(405, '허용하지 않는 요청입니다.');
        const input = await body(request);
        const store = await commit(input, store => {
          const record = request.method === 'PATCH' ? normalizeVideo(input.video, getWorkTypes(store)) : null;
          const video = store.videos.find(item => item.id === match[1]);
          if (!video) throw error(404, '영상을 찾을 수 없습니다.');
          const now = new Date().toISOString();
          if (record) {
            if (video.deletedAt) throw error(400, '영상을 복원한 뒤 수정해주세요.');
            Object.assign(video, record);
            assignHeroSlots(store.videos, video, record.heroSlots, now);
          } else {
            video.deletedAt = match[2] ? null : now;
            video.heroSlots = [];
          }
          video.updatedAt = now;
        });
        reply(response, 200, store);
      }
    } catch (failure) {
      const status = failure.status || (failure.code === 'ENOENT' ? 400 : 400);
      reply(response, status, { error: failure.status ? failure.message : failure.name === 'TimeoutError' ? '영상 정보 요청이 지연되고 있습니다. 제목을 직접 입력해주세요.' : failure.code ? '파일을 저장하지 못했습니다. 서버와 파일을 확인해주세요.' : failure.message });
    }
    return true;
  };
}
