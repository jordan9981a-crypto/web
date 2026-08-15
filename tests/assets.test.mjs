import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';

const assets = [
  {
    file: 'ncepu-logo.png',
    source: 'https://www.ncepu.edu.cn/images/logo.png',
    homepage: 'https://www.ncepu.edu.cn/index.htm',
    byteLength: 5433,
    width: 292,
    height: 70,
    sha256: '78658D131C6B27A96778718A86EE15944741149C3610C3F0E6B49A5B3E8EB7BE',
  },
  {
    file: 'syuct-logo.png',
    source: 'https://www.syuct.edu.cn/images/logo.png',
    homepage: 'https://www.syuct.edu.cn/',
    byteLength: 33853,
    width: 332,
    height: 70,
    sha256: '2751BF6684008A7AD06460CBA029BF5FCF2537AC7388BADBAB46BB06D7C8823B',
  },
];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function pngDimensions(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'must have a PNG signature');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', 'must start with an IHDR chunk');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('partner university marks are present as valid PNG assets with official source provenance', async () => {
  const provenance = await readFile(new URL('../src/assets/SOURCES.md', import.meta.url), 'utf8');
  const actualHashes = [];

  for (const asset of assets) {
    const file = new URL(`../src/assets/${asset.file}`, import.meta.url);
    assert.equal(await exists(file), true, `missing local official asset: ${asset.file}`);
    const bytes = await readFile(file);
    assert.equal(bytes.length, asset.byteLength, `${asset.file} byte length`);
    const { width, height } = pngDimensions(bytes);
    assert.equal(width, asset.width, `${asset.file} IHDR width`);
    assert.equal(height, asset.height, `${asset.file} IHDR height`);
    const actualHash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    actualHashes.push(actualHash);
    assert.equal(actualHash, asset.sha256, `${asset.file} SHA-256`);
    assert.match(provenance, new RegExp(`File ${asset.file}`));
    assert.match(provenance, new RegExp(asset.source.replace(/[.?]/g, '\\$&')));
    assert.match(provenance, new RegExp(asset.homepage.replace(/[.?]/g, '\\$&')));
  }

  assert.notEqual(actualHashes[0], actualHashes[1], 'each school must retain its own official mark');
  assert.match(provenance, /without recoloring, cropping, or aspect-ratio change/i);
  assert.match(provenance, /visual-identity and authorization requirements should be confirmed/i);
});
