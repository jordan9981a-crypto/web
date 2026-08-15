import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';

let createPreviewServer;
try {
  ({ createPreviewServer } = await import('../scripts/serve.mjs'));
} catch {
  // The assertion below creates the intended RED failure before the module exists.
}

const fixture = await mkdtemp(join(tmpdir(), 'joint-training-preview-'));
const outsideFixture = await mkdtemp(join(tmpdir(), 'joint-training-preview-outside-'));
after(async () => Promise.all([
  rm(fixture, { recursive: true, force: true }),
  rm(outsideFixture, { recursive: true, force: true }),
]));

function request(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ agent: false, host: '127.0.0.1', port, path, method }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function connect(port) {
  return new Promise((resolve) => {
    const req = httpRequest({ agent: false, host: '127.0.0.1', port, path: 'example.test:443', method: 'CONNECT' });
    req.on('connect', (response, socket) => {
      socket.resume();
      socket.once('close', () => resolve({ headers: response.headers, status: response.statusCode }));
    });
    req.on('error', (error) => resolve({ error }));
    req.end();
  });
}

test('preview server safely serves built files and HTTP semantics', async () => {
  assert.equal(typeof createPreviewServer, 'function');
  await buildSite(fixture);
  await writeFile(join(fixture, 'sample.png'), 'PNG');
  await writeFile(join(fixture, 'notes.md'), '# Notes');
  const outsideFile = join(outsideFixture, 'private.txt');
  await writeFile(outsideFile, 'private');
  await symlink(outsideFile, join(fixture, 'private.txt'), 'file');

  const server = createPreviewServer({ directory: fixture });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const home = await request(port, '/');
    assert.equal(home.status, 200);
    assert.match(home.headers['content-type'], /^text\/html/);
    assert.match(home.body, /<main id="main-content">/);

    const asset = await request(port, '/styles/site.css');
    assert.equal(asset.status, 200);
    assert.match(asset.headers['content-type'], /^text\/css/);
    assert.match((await request(port, '/scripts/site.js')).headers['content-type'], /^text\/javascript/);
    assert.match((await request(port, '/sample.png')).headers['content-type'], /^image\/png/);
    assert.match((await request(port, '/notes.md')).headers['content-type'], /^text\/markdown/);
    for (const asset of ['ncepu-logo.png', 'syuct-logo.png']) {
      const response = await request(port, `/assets/${asset}`);
      assert.equal(response.status, 200, asset);
      assert.match(response.headers['content-type'], /^image\/png/, asset);
    }

    assert.equal((await request(port, '/missing')).status, 404);
    assert.equal((await request(port, '/%2e%2e/package.json')).status, 403);
    assert.equal((await request(port, '/private.txt')).status, 403);
    const head = await request(port, '/', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal((await request(port, '/', 'POST')).status, 405);
    const connectResponse = await connect(port);
    assert.equal(connectResponse.status, 405);
    assert.equal(connectResponse.headers.allow, 'GET, HEAD');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
