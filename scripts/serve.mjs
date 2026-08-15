import { createReadStream } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDirectory = resolve(projectDirectory, 'dist');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
};

function isWithinDirectory(filePath, directory) {
  const fromDirectory = relative(directory, filePath);
  return fromDirectory === '' || (!fromDirectory.startsWith('..') && !isAbsolute(fromDirectory));
}

function respond(response, status, headers = {}, body = '') {
  response.writeHead(status, headers);
  response.end(body);
}

export function createPreviewServer({ directory = defaultDirectory } = {}) {
  const root = resolve(directory);

  const server = createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      respond(response, 405, { Allow: 'GET, HEAD' });
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent((request.url ?? '/').split('?', 1)[0]);
    } catch {
      respond(response, 400);
      return;
    }

    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = resolve(root, `.${requestedPath}`);
    if (!isWithinDirectory(filePath, root)) {
      respond(response, 403);
      return;
    }

    try {
      const [realRoot, realFilePath] = await Promise.all([realpath(root), realpath(filePath)]);
      if (!isWithinDirectory(realFilePath, realRoot)) {
        respond(response, 403);
        return;
      }
      const file = await stat(realFilePath);
      if (!file.isFile()) {
        respond(response, 404);
        return;
      }
      const headers = {
        'Content-Length': file.size,
        'Content-Type': mimeTypes[extname(realFilePath).toLowerCase()] ?? 'application/octet-stream',
      };
      if (request.method === 'HEAD') {
        respond(response, 200, headers);
        return;
      }
      response.writeHead(200, headers);
      const stream = createReadStream(realFilePath);
      stream.on('error', () => {
        if (!response.headersSent) respond(response, 500);
        else response.destroy();
      });
      stream.pipe(response);
    } catch (error) {
      if (error?.code === 'ENOENT') respond(response, 404);
      else respond(response, 500);
    }
  });

  server.on('connect', (_request, socket) => {
    socket.end('HTTP/1.1 405 Method Not Allowed\r\nAllow: GET, HEAD\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  return server;
}

export function startPreviewServer({ directory = defaultDirectory, host = '127.0.0.1', port = 4173 } = {}) {
  const server = createPreviewServer({ directory });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await access(defaultDirectory);
  await startPreviewServer();
  console.log('Preview: http://127.0.0.1:4173');
}
