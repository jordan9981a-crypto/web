import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles/site.css', import.meta.url), 'utf8');

test('text links remain readable on light surfaces and use white only in the hero', () => {
  assert.match(css, /\.text-link\s*\{[^}]*color:\s*var\(--brand\)/s);
  assert.match(css, /\.hero \.text-link\s*\{[^}]*color:\s*var\(--paper\)/s);
  assert.doesNotMatch(css, /(?:^|\n)\.text-link\s*\{[^}]*color:\s*var\(--paper\)/ms);
});

test('responsive brand layouts protect the 901px and 320px logo widths without hiding site identity', () => {
  const medium = css.match(/@media \(max-width: 1180px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const tablet = css.match(/@media \(max-width: 900px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const narrow = css.match(/@media \(max-width: 420px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.match(medium, /\.brand-bar\s*\{[^}]*grid-template-areas:\s*"site"\s*"marks"/s);
  assert.match(medium, /\.school-marks\s*\{[^}]*grid-area:\s*marks[^}]*grid-template-columns:\s*repeat\(2, max-content\)/s);
  assert.match(medium, /\.school-mark img\s*\{[^}]*height:\s*30px[^}]*width:\s*auto[^}]*max-width:\s*none/s);
  assert.match(tablet, /\.brand-bar\s*\{[^}]*grid-template-areas:\s*"site toggle"\s*"marks marks"/s);
  assert.match(tablet, /\.site-name\s*\{[^}]*display:\s*block[^}]*grid-area:\s*site/s);
  assert.match(tablet, /\.nav-toggle\s*\{[^}]*grid-area:\s*toggle/s);
  assert.match(tablet, /\.school-marks\s*\{[^}]*grid-area:\s*marks/s);
  assert.doesNotMatch(tablet, /\.site-name\s*\{[^}]*display:\s*none/s);
  assert.match(narrow, /\.school-marks\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
});

test('official school marks retain their wide intrinsic aspect ratios at a shared visual height', () => {
  const medium = css.match(/@media \(max-width: 1180px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(css, /\.brand-bar\s*\{[^}]*grid-template-columns:\s*minmax\(420px, 1fr\)/s);
  assert.match(css, /\.school-mark img\s*\{[^}]*height:\s*38px[^}]*width:\s*auto[^}]*object-fit:\s*contain[^}]*max-width:\s*none[^}]*background:\s*var\(--brand-dark\)/s);
  assert.match(medium, /\.school-mark img\s*\{[^}]*height:\s*30px[^}]*width:\s*auto[^}]*object-fit:\s*contain[^}]*max-width:\s*none/s);
  assert.match(css, /\.school-mark span:nth-child\(2\)\s*\{[^}]*display:\s*none/s);
});

test('Chinese headings consistently use the serif heading stack', () => {
  assert.match(css, /h2,\s*h3\s*\{[^}]*font-family:\s*"Noto Serif SC", "Songti SC", serif/s);
});
