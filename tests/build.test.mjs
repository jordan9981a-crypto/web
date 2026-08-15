import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, parse, resolve } from 'node:path';
import { site } from '../src/data/site.mjs';
import { memberGroups } from '../src/data/members.mjs';
import { publications } from '../src/data/publications.mjs';
import { buildSite } from '../scripts/build.mjs';

const outputDir = await mkdtemp(join(tmpdir(), 'joint-training-lab-site-'));
const outsideOutputDir = await mkdtemp(join(tmpdir(), 'joint-training-lab-site-outside-'));

after(async () => {
  await Promise.all([
    rm(outputDir, { recursive: true, force: true }),
    rm(outsideOutputDir, { recursive: true, force: true }),
  ]);
});

test('buildSite renders the consented public site and copies its local assets', async () => {
  await buildSite(outputDir);

  const entries = await readdir(outputDir);
  assert.deepEqual(entries.filter((entry) => entry.endsWith('.html')).sort(), [
    'about.html', 'index.html', 'members.html', 'publications.html',
  ]);
  for (const directory of ['styles', 'scripts', 'assets']) {
    assert.equal((await stat(join(outputDir, directory))).isDirectory(), true);
  }
  assert.equal((await stat(join(outputDir, 'styles', 'site.css'))).isFile(), true);
  assert.equal((await stat(join(outputDir, 'scripts', 'site.js'))).isFile(), true);
  assert.equal((await stat(join(outputDir, 'assets', 'SOURCES.md'))).isFile(), true);
  for (const asset of ['ncepu-logo.png', 'syuct-logo.png']) {
    const copiedAsset = await stat(join(outputDir, 'assets', asset));
    assert.equal(copiedAsset.isFile(), true, asset);
    assert.ok(copiedAsset.size > 0, asset);
  }

  const pages = await Promise.all(['index.html', 'about.html', 'members.html', 'publications.html']
    .map(async (file) => [file, await readFile(join(outputDir, file), 'utf8')]));
  const htmlByFile = Object.fromEntries(pages);
  const combined = pages.map(([, html]) => html).join('\n');

  for (const [pageFile, html] of pages) {
    for (const [, value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(?:https:|mailto:|#)/.test(value)) continue;
      const target = resolve(outputDir, pageFile === 'index.html' ? '.' : '.', value);
      assert.equal((await stat(target)).isFile(), true, `${pageFile} references emitted ${value}`);
    }
  }

  assert.match(combined, new RegExp(site.name));
  for (const direction of site.directions) assert.match(combined, new RegExp(direction.name));

  const consentedNames = memberGroups.flatMap(({ names }) => names);
  assert.equal(consentedNames.length, 17);
  const renderedNames = [...htmlByFile['members.html'].matchAll(/<ul class="name-grid">([\s\S]*?)<\/ul>/g)]
    .flatMap(([, list]) => [...list.matchAll(/<li>([^<]*)<\/li>/g)].map(([, name]) => name));
  assert.deepEqual(renderedNames, consentedNames);

  const occurrences = (html, value) => html.split(value).length - 1;
  for (const publication of publications) {
    assert.equal(occurrences(htmlByFile['publications.html'], publication.url), 1, publication.url);
    assert.equal(occurrences(htmlByFile['publications.html'], publication.title), 1, publication.title);
    assert.equal(occurrences(htmlByFile['publications.html'], publication.authors.join('; ')), 1, publication.authors.join('; '));
    assert.equal(occurrences(htmlByFile['publications.html'], `>${publication.doi} <span class="external-indicator"`), 1, publication.doi);
    const issue = publication.issue ? `(${publication.issue})` : '';
    const formattedCitation = `${publication.journal} ${publication.year}, ${publication.volume}${issue}, ${publication.pages}.`;
    assert.equal(occurrences(htmlByFile['publications.html'], formattedCitation), 1, formattedCitation);
  }
  for (const publication of publications.slice(0, 3)) assert.equal(occurrences(htmlByFile['index.html'], publication.title), 1);
  for (const publication of publications.slice(3)) assert.equal(occurrences(htmlByFile['index.html'], publication.title), 0);
  assert.doesNotMatch(combined, /\.pdf\b|pdf(?:Url|Link)?/i);
  assert.doesNotMatch(combined, /phone|telephone|mobile|\btel\b|电话|手机/i);
  const mainlandMobile = /(?:\+?86[-\s]?)?1[3-9](?:[-\s]?\d){9}/;
  const mainlandLandline = /(?:\+?86[-\s]?)?(?:\(\s?0\d{2,3}\s?\)|0\d{2,3})(?:[-\s]?\d){7,8}/;
  assert.doesNotMatch(combined, mainlandMobile);
  assert.doesNotMatch(combined, mainlandLandline);
  for (const forbiddenNumber of ['15140123456', '151-4012-3456', '151 4012 3456', '0312-7521234', '03127521234', '0312 7521234', '(0312)7521234']) {
    assert.equal(combined.includes(forbiddenNumber), false, forbiddenNumber);
  }
  assert.equal((combined.match(/<img\b/g) ?? []).length, 8);

  for (const [file, html] of pages) {
    assert.match(html, /<header class="site-header">/);
    assert.match(html, /<main id="main-content">/);
    assert.match(html, /<footer class="site-footer">/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1, file);
    for (const href of ['index.html', 'about.html', 'members.html', 'publications.html']) {
      assert.match(html, new RegExp(`href="${href}"`), `${file} -> ${href}`);
    }
  }

  assert.match(htmlByFile['index.html'], /North China Electric Power University × Shenyang University of Chemical Technology/);
  assert.match(htmlByFile['members.html'], /class="container member-sections"/);
  assert.match(htmlByFile['publications.html'], /class="year-filters" role="group" aria-label="按年份筛选论文"/);
  assert.match(htmlByFile['publications.html'], /class="publication-years"/);
  assert.match(htmlByFile['publications.html'], /class="publication-year" data-year="2026"/);
  assert.match(htmlByFile['publications.html'], /class="publication-entry"/);
  assert.match(htmlByFile['publications.html'], /class="publication-authors"/);
  assert.match(htmlByFile['publications.html'], /论文按年份排列，链接指向 DOI 正式出版页面。/);
  assert.match(htmlByFile['publications.html'], /DOI: <a[^>]*>10\.1016\/j\.est\.2026\.123706/);
  assert.match(htmlByFile['publications.html'], /data-year-filter="all" aria-pressed="true">全部/);
  assert.match(htmlByFile['publications.html'], /data-year-filter="2026" aria-pressed="false">2026/);
  assert.match(htmlByFile['publications.html'], /Journal of Energy Storage 2026, 178, 123706\./);
  assert.match(htmlByFile['publications.html'], /CrystEngComm 2025, 27\(5\), 687-694\./);

  assert.match(htmlByFile['index.html'], /<p class="eyebrow">Research<\/p><h2>研究方向<\/h2>/);
  assert.match(htmlByFile['index.html'], /<div class="section-heading"><div><p class="eyebrow">Publications<\/p><h2>最新论文<\/h2><\/div><a href="publications\.html">全部论文 →<\/a><\/div>/);
  assert.match(htmlByFile['index.html'], /<p class="eyebrow">Contact<\/p><h2>联系导师<\/h2>/);
  assert.match(htmlByFile['index.html'], /<p class="eyebrow">2026 · Journal of Energy Storage<\/p>/);
  assert.match(htmlByFile['index.html'], /查看论文 <span class="external-indicator"/);
  for (const advisor of site.advisors) {
    assert.match(htmlByFile['index.html'], new RegExp(`<h3>${advisor.name} <small>${advisor.englishName}<\\/small><\\/h3>`));
    assert.match(htmlByFile['about.html'], new RegExp(`<p class="eyebrow">${advisor.school}<\\/p>`));
    assert.match(htmlByFile['about.html'], new RegExp(`<h3>${advisor.name} <small>${advisor.englishName}<\\/small><\\/h3>`));
    assert.match(htmlByFile['about.html'], new RegExp(`${advisor.title} · ${advisor.department}`));
  }
});

test('buildSite rejects unsafe output destinations without touching the project', async () => {
  for (const destination of ['.', 'src', parse(outputDir).root]) {
    await assert.rejects(() => buildSite(destination), TypeError);
  }
  assert.equal((await stat('src')).isDirectory(), true);
});

test('buildSite creates a nested dist destination when its parent does not exist', async () => {
  const nestedOutput = join(outputDir, 'nested', 'site');
  await buildSite(nestedOutput);
  assert.equal((await stat(join(nestedOutput, 'index.html'))).isFile(), true);
});

test('buildSite rejects a nested destination through a linked directory', async () => {
  const linkedDirectory = join(outputDir, 'linked');
  const externalMarker = join(outsideOutputDir, 'marker.txt');
  await writeFile(externalMarker, 'keep');
  await symlink(outsideOutputDir, linkedDirectory, 'junction');

  await assert.rejects(() => buildSite(join(linkedDirectory, 'nested', 'site')), TypeError);
  assert.equal(await readFile(externalMarker, 'utf8'), 'keep');
});
