import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'design', 'reference');
const port = Number(process.argv[process.argv.indexOf('--port') + 1] || process.env.REFERENCE_PORT || 4100);
const names = new Set(['courses-listing.html', 'final-countries-list.html', 'final-country-detail.html', 'subjects-listing.html', 'subject-detail.html', 'subject-specializations.html']);

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname).replace(/^\//, '');
  const filename = names.has(requestPath) ? requestPath : 'courses-listing.html';
  const file = path.join(root, filename);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () => console.log(`Reference server listening on http://127.0.0.1:${port}`));
