import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, unlink, realpath, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { normalizeProfile } from './profile-model.mjs';

const error = (status, message) => Object.assign(new Error(message), { status });
export async function readLimitedBody(request, maximum) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximum) throw error(413, '파일 또는 입력 내용이 너무 큽니다.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function imageExtension(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR') return 'png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) return 'webp';
  throw error(415, 'JPG, PNG, WebP 이미지 파일을 선택해주세요.');
}
export function createProfileAdmin(root) {
  const dataFile = join(root, 'data', 'profile.json');
  let queue = Promise.resolve();
  return async (request, response, url, reply) => {
    if (url.pathname === '/api/admin/profile' && request.method === 'GET') {
      reply(response, 200, JSON.parse(await readFile(dataFile, 'utf8')));
    } else if (url.pathname === '/api/admin/profile' && request.method === 'PUT') {
      if (!(request.headers['content-type'] || '').startsWith('application/json')) throw error(415, 'JSON 형식이 필요합니다.');
      let input;
      try { input = JSON.parse((await readLimitedBody(request, 1024 * 1024)).toString('utf8')); }
      catch (failure) { if (failure.status) throw failure; throw error(400, '입력 내용을 읽을 수 없습니다.'); }
      const profile = normalizeProfile(input);
      const operation = queue.then(async () => {
        const previous = await readFile(dataFile, 'utf8');
        if (input.revision !== JSON.parse(previous).revision) throw error(409, '다른 창에서 변경되었습니다. 입력 내용은 유지됩니다. 새로 불러온 뒤 다시 편집해주세요.');
        const assetRoot = await realpath(join(root, 'assets', 'profile'));
        for (const image of profile.careers.flatMap(career => career.images)) {
          const file = await realpath(join(root, image.src)).catch(() => { throw error(400, '이미지 파일을 찾을 수 없습니다. 다시 첨부해주세요.'); });
          if (!file.startsWith(assetRoot + sep) || !(await stat(file)).isFile()) throw error(400, '이미지 경로를 확인해주세요.');
        }
        const saved = { ...profile, revision: input.revision + 1 };
        await mkdir(join(root, '.backups'), { recursive: true });
        await writeFile(join(root, '.backups', `profile-${Date.now()}-${randomUUID()}.json`), previous, { flag: 'wx' });
        const temporary = `${dataFile}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, JSON.stringify(saved, null, 2) + '\n', { flag: 'wx' });
          await rename(temporary, dataFile);
        } finally { await unlink(temporary).catch(() => {}); }
        return saved;
      });
      queue = operation.catch(() => {});
      reply(response, 200, await operation);
    } else if (url.pathname === '/api/admin/profile/images' && request.method === 'POST') {
      const bytes = await readLimitedBody(request, 10 * 1024 * 1024);
      const extension = imageExtension(bytes);
      const directory = join(root, 'assets', 'profile', 'uploads');
      await mkdir(directory, { recursive: true });
      const assetRoot = await realpath(join(root, 'assets', 'profile'));
      if (!(await realpath(directory)).startsWith(assetRoot + sep)) throw error(400, '이미지 저장 경로를 확인해주세요.');
      const name = `${randomUUID()}.${extension}`;
      await writeFile(join(directory, name), bytes, { flag: 'wx' });
      reply(response, 201, { src: `assets/profile/uploads/${name}` });
    } else throw error(405, '허용하지 않는 요청입니다.');
  };
}
