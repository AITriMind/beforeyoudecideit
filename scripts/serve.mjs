/**
 * A static server that behaves like a real host: gzip on text, keep-alive,
 * cache headers. The Python one-liner used during development does none of
 * that, which makes an 84KB document look like 84KB on the wire when a real
 * host would send about 15KB.
 *
 * Measure against this, not against a naked file server.
 *
 *   node scripts/serve.mjs [port]
 */
import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 4175);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

/** Text compresses; webp, png and woff2 are already compressed. */
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.xml', '.txt']);

createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let file = join(root, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
    return;
  }

  const ext = extname(file).toLowerCase();
  const headers = {
    'content-type': TYPES[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    connection: 'keep-alive'
  };

  const accepts = String(request.headers['accept-encoding'] || '').includes('gzip');
  if (accepts && COMPRESSIBLE.has(ext)) {
    const body = gzipSync(readFileSync(file), { level: 9 });
    response.writeHead(200, { ...headers, 'content-encoding': 'gzip', 'content-length': body.length });
    response.end(body);
    return;
  }

  response.writeHead(200, { ...headers, 'content-length': statSync(file).size });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} on http://127.0.0.1:${port} with gzip and keep-alive`);
});
