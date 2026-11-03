import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminAPI } from './admin-api.mjs';

const root = await realpath(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.argv[2] || 4173);
const adminAPI = createAdminAPI(root);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Choose a port between 1 and 65535.');
  process.exit(1);
}

const server = createServer(async (request, response) => {
  const sendError = (status, message) => {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : message);
  };
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host)) return sendError(403, 'Local access only');
  let requestedURL;
  try { requestedURL = new URL(request.url, `http://${request.headers.host}`); }
  catch { return sendError(400, 'Invalid URL'); }
  if (await adminAPI(request, response, requestedURL)) return;
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.setHeader('Allow', 'GET, HEAD');
    return sendError(405, 'Method not allowed');
  }
  try {
    let pathname;
    try {
      pathname = decodeURIComponent(requestedURL.pathname);
    } catch {
      return sendError(400, 'Invalid URL');
    }
    if (pathname.split('/').some(part => part.startsWith('.')) || /\.(?:part|log|cmd|tmp)$/.test(pathname) || /^\/(?:tests|scripts)(?:\/|$)/.test(pathname) || ['/preview-server.mjs', '/admin-api.mjs', '/profile-admin.mjs'].includes(pathname)) return sendError(404, 'Not found');
    let file = resolve(root, `.${pathname}`);
    const insideRoot = candidate => candidate === root || candidate.startsWith(root + sep);
    if (!insideRoot(file)) return sendError(403, 'Forbidden');
    let details = await stat(file);
    if (details.isDirectory()) {
      file = resolve(file, 'index.html');
      details = await stat(file);
    }
    file = await realpath(file);
    if (!insideRoot(file) || !details.isFile()) return sendError(403, 'Forbidden');

    const headers = {
      'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': details.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    };
    let status = 200;
    let range;
    if (request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (!match || (!match[1] && !match[2]) || !details.size) {
        response.setHeader('Content-Range', `bytes */${details.size}`);
        return sendError(416, 'Range not satisfiable');
      }
      const start = match[1] ? Number(match[1]) : Math.max(0, details.size - Number(match[2]));
      const end = match[1] && match[2] ? Math.min(Number(match[2]), details.size - 1) : details.size - 1;
      if (start > end || start >= details.size) {
        response.setHeader('Content-Range', `bytes */${details.size}`);
        return sendError(416, 'Range not satisfiable');
      }
      range = { start, end };
      status = 206;
      headers['Content-Length'] = end - start + 1;
      headers['Content-Range'] = `bytes ${start}-${end}/${details.size}`;
    }
    response.writeHead(status, headers);
    if (request.method === 'HEAD') return response.end();
    const stream = createReadStream(file, range);
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  } catch (error) {
    sendError(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, 'File unavailable');
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Open http://127.0.0.1:${port}/ or choose another port.`
    : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Portfolio preview: http://127.0.0.1:${port}/`);
  console.log('Press Ctrl+C to stop.');
});
