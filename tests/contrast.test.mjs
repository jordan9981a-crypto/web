import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles/site.css', import.meta.url), 'utf8');
const variables = Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?)/gi)].map(([, name, value]) => [name, value]));

function relativeLuminance(hex) {
  const normalized = hex.length === 4 ? `#${[...hex.slice(1)].map((channel) => channel.repeat(2)).join('')}` : hex;
  const channels = normalized.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(left, right) {
  const [brightest, darkest] = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (brightest + 0.05) / (darkest + 0.05);
}

test('accent-strong has accessible contrast on the light design surfaces', () => {
  assert.match(variables['--accent-strong'] ?? '', /^#[0-9a-f]{6}$/i);
  assert.ok(contrastRatio(variables['--accent-strong'], variables['--paper']) >= 4.5);
  assert.ok(contrastRatio(variables['--accent-strong'], variables['--mist']) >= 4.5);
});

test('small light-surface accents and focus use accent-strong while dark heroes retain accent', () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--accent-strong\)/s);
  for (const selector of ['\\.eyebrow', '\\.external-indicator', '\\.direction-number']) {
    assert.match(css, new RegExp(`${selector}\\s*\\{[^}]*color:\\s*var\\(--accent-strong\\)`, 's'));
  }
  assert.match(css, /\.hero \.eyebrow, \.page-hero \.eyebrow\s*\{[^}]*color:\s*var\(--accent\)/s);
  assert.match(css, /\.site-footer \.external-indicator\s*\{[^}]*color:\s*var\(--accent\)/s);
});

test('dark surfaces use a contrasting scoped focus outline', () => {
  assert.ok(contrastRatio(variables['--paper'], variables['--brand']) >= 3);
  assert.ok(contrastRatio(variables['--paper'], variables['--brand-dark']) >= 3);
  assert.match(css, /\.main-navigation :focus-visible, \.hero :focus-visible, \.page-hero :focus-visible, \.site-footer :focus-visible\s*\{[^}]*outline-color:\s*var\(--paper\)/s);
});
