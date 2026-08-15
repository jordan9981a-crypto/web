import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../scripts/build.mjs';
import { verifyBuild } from '../scripts/verify-build.mjs';

const execFile = promisify(execFileCallback);
const projectDirectory = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const fixtureRoot = await mkdtemp(join(tmpdir(), 'joint-training-verify-'));
const validOutput = join(fixtureRoot, 'valid');

before(async () => {
  await buildSite(validOutput);
});

after(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

async function copiedOutput(label) {
  const directory = join(fixtureRoot, label);
  await cp(validOutput, directory, { recursive: true });
  return directory;
}

async function changeHtml(directory, file, change) {
  const path = join(directory, file);
  const original = await readFile(path, 'utf8');
  await writeFile(path, change(original), 'utf8');
}

async function changeTextFile(directory, file, change) {
  const path = join(directory, file);
  const original = await readFile(path, 'utf8');
  await writeFile(path, change(original), 'utf8');
}

function hasFailure(code) {
  return (error) => {
    assert.equal(error?.name, 'BuildVerificationError');
    assert.ok(error.failures.some((failure) => failure.code === code), `${code}: ${error.message}`);
    return true;
  };
}

test('verifyBuild accepts a complete generated output', async () => {
  const result = await verifyBuild(validOutput);
  assert.deepEqual(result, { outputDir: validOutput, pages: 4 });
});

test('verifyBuild reports a required local asset that is missing', async () => {
  const directory = await copiedOutput('missing-asset');
  await rm(join(directory, 'styles', 'site.css'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('MISSING_REQUIRED_ASSET'));
});

test('verifyBuild rejects unapproved files in the deployable output', async () => {
  const directory = await copiedOutput('extra-output-file');
  await writeFile(join(directory, 'assets', 'advisor.png'), 'not an approved image', 'utf8');
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNEXPECTED_OUTPUT_FILE'));
});

test('verifyBuild rejects CSS URL references because this site has no approved CSS images', async () => {
  const directory = await copiedOutput('css-image');
  await changeTextFile(directory, join('styles', 'site.css'), (css) => `${css}\nbody { background-image: url(assets/advisor.png); }`);
  await assert.rejects(() => verifyBuild(directory), hasFailure('CSS_URL_REFERENCE'));
});

test('verifyBuild rejects CSS-escaped URL references and imports', async () => {
  const escapedDirectory = await copiedOutput('css-escaped-image');
  await changeTextFile(escapedDirectory, join('styles', 'site.css'), (css) => `${css}\nbody { background-image: u\\72l(https://example.org/advisor.png); }`);
  await assert.rejects(() => verifyBuild(escapedDirectory), hasFailure('CSS_URL_REFERENCE'));

  const importDirectory = await copiedOutput('css-import');
  await changeTextFile(importDirectory, join('styles', 'site.css'), (css) => `${css}\n@import "https://example.org/advisor.css";`);
  await assert.rejects(() => verifyBuild(importDirectory), hasFailure('CSS_URL_REFERENCE'));
});

test('verifyBuild rejects inline and embedded HTML styles', async () => {
  const inlineDirectory = await copiedOutput('inline-style-image');
  await changeHtml(inlineDirectory, 'index.html', (html) => html.replace('<main id="main-content">', '<main id="main-content" style="background-image: url(https://example.org/advisor.png)">'));
  await assert.rejects(() => verifyBuild(inlineDirectory), hasFailure('UNAPPROVED_EMBEDDED_CONTENT'));

  const styleDirectory = await copiedOutput('style-tag-image');
  await changeHtml(styleDirectory, 'about.html', (html) => html.replace('</head>', '<style>body { background-image: url(https://example.org/advisor.png); }</style></head>'));
  await assert.rejects(() => verifyBuild(styleDirectory), hasFailure('UNAPPROVED_EMBEDDED_CONTENT'));
});

test('verifyBuild rejects additional external stylesheets', async () => {
  const directory = await copiedOutput('external-stylesheet');
  await changeHtml(directory, 'index.html', (html) => html.replace('</head>', '<link rel="stylesheet" href="https://example.org/advisor.css"></head>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNAPPROVED_STYLESHEET'));
});

test('verifyBuild rejects dynamic stylesheet links and inline event handlers', async () => {
  const directory = await copiedOutput('dynamic-stylesheet');
  await changeHtml(directory, 'index.html', (html) => html.replace('</head>', '<link rel="preload" as="style" href="https://example.org/advisor.css" onload="this.rel=\'stylesheet\'"></head>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNAPPROVED_LINK_RESOURCE'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNSAFE_INLINE_EVENT_HANDLER'));
});

test('verifyBuild rejects base elements that could rewrite deployed links', async () => {
  const directory = await copiedOutput('external-base');
  await changeHtml(directory, 'index.html', (html) => html.replace('</head>', '<base href="https://example.org/"></head>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNAPPROVED_BASE_ELEMENT'));
});

test('verifyBuild rejects stylesheet changes that could hide publication DOI text', async () => {
  const directory = await copiedOutput('hidden-doi-css');
  await changeTextFile(directory, join('styles', 'site.css'), (css) => `${css}\n.publication-entry a { font-size: 0; color: transparent; }`);
  await assert.rejects(() => verifyBuild(directory), hasFailure('STYLESHEET_HASH_MISMATCH'));
});

test('verifyBuild rejects SVG and embedded image bypass constructs', async () => {
  const svgDirectory = await copiedOutput('svg-image');
  await changeHtml(svgDirectory, 'about.html', (html) => html.replace('</main>', '<svg><image href="https://example.org/advisor.png"></image></svg></main>'));
  await assert.rejects(() => verifyBuild(svgDirectory), hasFailure('UNAPPROVED_EMBEDDED_CONTENT'));

  const objectDirectory = await copiedOutput('embedded-object');
  await changeHtml(objectDirectory, 'about.html', (html) => html.replace('</main>', '<object data="https://example.org/advisor.png"></object></main>'));
  await assert.rejects(() => verifyBuild(objectDirectory), hasFailure('UNAPPROVED_EMBEDDED_CONTENT'));
});

test('verifyBuild rejects legacy image-bearing input and background attributes', async () => {
  const inputDirectory = await copiedOutput('input-image');
  await changeHtml(inputDirectory, 'about.html', (html) => html.replace('</main>', '<input type="image" src="https://example.org/advisor.png"></main>'));
  await assert.rejects(() => verifyBuild(inputDirectory), hasFailure('UNAPPROVED_EMBEDDED_CONTENT'));

  const backgroundDirectory = await copiedOutput('body-background');
  await changeHtml(backgroundDirectory, 'about.html', (html) => html.replace('<body>', '<body background="https://example.org/advisor.png">'));
  await assert.rejects(() => verifyBuild(backgroundDirectory), hasFailure('UNAPPROVED_EMBEDDED_CONTENT'));
});

test('verifyBuild rejects phone values in generated text', async () => {
  const directory = await copiedOutput('phone');
  await changeHtml(directory, 'index.html', (html) => html.replace('</body>', '<p>电话：151-4012-3456</p></body>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('PROHIBITED_PHONE_CONTENT'));
});

test('verifyBuild rejects phone values encoded as HTML entities', async () => {
  const directory = await copiedOutput('encoded-phone');
  await changeHtml(directory, 'index.html', (html) => html.replace('</body>', '<p>&#49;51-4012-3456</p></body>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('PROHIBITED_PHONE_CONTENT'));
});

test('verifyBuild rejects semicolonless decimal and hexadecimal phone entities', async () => {
  const decimalDirectory = await copiedOutput('semicolonless-decimal-phone');
  await changeHtml(decimalDirectory, 'index.html', (html) => html.replace('</body>', '<p>&#49 51-4012-3456</p></body>'));
  await assert.rejects(() => verifyBuild(decimalDirectory), hasFailure('PROHIBITED_PHONE_CONTENT'));

  const hexadecimalDirectory = await copiedOutput('semicolonless-hex-phone');
  await changeHtml(hexadecimalDirectory, 'index.html', (html) => html.replace('</body>', '<p>&#x31 51-4012-3456</p></body>'));
  await assert.rejects(() => verifyBuild(hexadecimalDirectory), hasFailure('PROHIBITED_PHONE_CONTENT'));
});

test('verifyBuild rejects phone values in deployed JavaScript', async () => {
  const directory = await copiedOutput('script-phone');
  await changeTextFile(directory, join('scripts', 'site.js'), (script) => `${script}\nconst forbiddenPhone = '15140123456';`);
  await assert.rejects(() => verifyBuild(directory), hasFailure('PROHIBITED_PHONE_CONTENT'));
});

test('verifyBuild rejects PDF-like terms in deployed provenance text', async () => {
  const directory = await copiedOutput('sources-pdf');
  await changeTextFile(directory, join('assets', 'SOURCES.md'), (source) => `${source}\nPDF download`);
  await assert.rejects(() => verifyBuild(directory), hasFailure('PROHIBITED_PDF_REFERENCE'));
});

test('verifyBuild rejects an extra member name', async () => {
  const directory = await copiedOutput('extra-member');
  await changeHtml(directory, 'members.html', (html) => html.replace('</ul>', '<li>未授权成员</li></ul>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('MEMBER_LIST_MISMATCH'));
});

test('verifyBuild rejects PDF links', async () => {
  const directory = await copiedOutput('pdf-link');
  await changeHtml(directory, 'index.html', (html) => html.replace('</body>', '<a href="https://example.org/paper.pdf">PDF</a></body>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('PROHIBITED_PDF_REFERENCE'));
});

test('verifyBuild rejects PDF links encoded as HTML entities', async () => {
  const directory = await copiedOutput('encoded-pdf-link');
  await changeHtml(directory, 'index.html', (html) => html.replace('</body>', '<a href="https://example.org/p&#100;f">paper</a></body>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('PROHIBITED_PDF_REFERENCE'));
});

test('verifyBuild rejects traversing local links', async () => {
  const directory = await copiedOutput('traversal');
  await changeHtml(directory, 'about.html', (html) => html.replace('href="styles/site.css"', 'href="../private.txt"'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNSAFE_LOCAL_REFERENCE'));
});

test('verifyBuild reports a missing DOI publication field', async () => {
  const directory = await copiedOutput('missing-doi');
  await changeHtml(directory, 'publications.html', (html) => html.replaceAll('10.1016/j.est.2026.123706', 'missing-doi'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('PUBLICATION_METADATA_MISMATCH'));
});

test('verifyBuild rejects publication records when DOI destinations are swapped between entries', async () => {
  const directory = await copiedOutput('swapped-publication-dois');
  await changeHtml(directory, 'publications.html', (html) => html
    .replace('https://doi.org/10.1016/j.est.2026.123706', 'temporary-doi-url')
    .replace('https://doi.org/10.1016/j.electacta.2026.149500', 'https://doi.org/10.1016/j.est.2026.123706')
    .replace('temporary-doi-url', 'https://doi.org/10.1016/j.electacta.2026.149500'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('PUBLICATION_ENTRY_MISMATCH'));
});

test('verifyBuild rejects extra list items in publication years', async () => {
  const directory = await copiedOutput('extra-publication-list-item');
  await changeHtml(directory, 'publications.html', (html) => html.replace('</ol>', '<li>unapproved publication</li></ol>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('PUBLICATION_ENTRY_MISMATCH'));
});

test('verifyBuild requires the expected DOI anchor to display its own DOI text', async () => {
  const directory = await copiedOutput('hidden-doi-text');
  await changeHtml(directory, 'publications.html', (html) => html
    .replace('>10.1016/j.est.2026.123706 <span class="external-indicator"', '>View record <span class="external-indicator"')
    .replace('</li>', '<span aria-hidden="true">10.1016/j.est.2026.123706 <span class="external-indicator"></span></span></li>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('PUBLICATION_ENTRY_MISMATCH'));
});

test('verifyBuild rejects extra publication content outside publication years', async () => {
  const articleDirectory = await copiedOutput('extra-publication-article');
  await changeHtml(articleDirectory, 'publications.html', (html) => html.replace('</main>', '<article><h2>Unauthorized extra publication</h2></article></main>'));
  await assert.rejects(() => verifyBuild(articleDirectory), hasFailure('PUBLICATION_BODY_MISMATCH'));

  const blockDirectory = await copiedOutput('extra-publication-block');
  await changeHtml(blockDirectory, 'publications.html', (html) => html.replace('</main>', '<p class="publication-entry">Unauthorized extra publication</p></main>'));
  await assert.rejects(() => verifyBuild(blockDirectory), hasFailure('PUBLICATION_BODY_MISMATCH'));

  const plainBlockDirectory = await copiedOutput('plain-extra-publication-block');
  await changeHtml(plainBlockDirectory, 'publications.html', (html) => html.replace('</main>', '<div>Unauthorized extra publication</div></main>'));
  await assert.rejects(() => verifyBuild(plainBlockDirectory), hasFailure('PUBLICATION_BODY_MISMATCH'));

  const singleQuotedBlockDirectory = await copiedOutput('single-quoted-publication-block');
  await changeHtml(singleQuotedBlockDirectory, 'publications.html', (html) => html.replace('</main>', "<div class='publication-entry'>Unauthorized extra publication</div></main>"));
  await assert.rejects(() => verifyBuild(singleQuotedBlockDirectory), hasFailure('PUBLICATION_BODY_MISMATCH'));
});

test('verifyBuild rejects images other than the two official marks', async () => {
  const directory = await copiedOutput('advisor-image');
  await changeHtml(directory, 'about.html', (html) => html.replace('</main>', '<img src="assets/advisor.png" alt="advisor photo"></main>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNAPPROVED_IMAGE'));
});

test('verifyBuild rejects responsive advisor image sources', async () => {
  const directory = await copiedOutput('advisor-srcset');
  await changeHtml(directory, 'about.html', (html) => html.replace('</main>', '<picture><source srcset="assets/advisor.png"></picture></main>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNAPPROVED_IMAGE'));
});

test('verifyBuild rejects member list items outside the consented grids', async () => {
  const directory = await copiedOutput('extra-member-list');
  await changeHtml(directory, 'members.html', (html) => html.replace('</main>', '<ul><li>未授权成员</li></ul></main>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('MEMBER_LIST_MISMATCH'));
});

test('verifyBuild rejects changed confirmed member-group labels', async () => {
  const directory = await copiedOutput('renamed-member-group');
  await changeHtml(directory, 'members.html', (html) => html.replace('<h2>在读成员</h2>', '<h2>成员</h2>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('MEMBER_SECTION_MISMATCH'));
});

test('verifyBuild rejects extra member text outside approved list items', async () => {
  const directory = await copiedOutput('extra-member-text');
  await changeHtml(directory, 'members.html', (html) => html.replace('</main>', '<p>未授权成员</p></main>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('MEMBER_SECTION_MISMATCH'));
});

test('verifyBuild decodes target entities before enforcing new-window protection', async () => {
  const directory = await copiedOutput('encoded-target');
  await changeHtml(directory, 'index.html', (html) => html.replace('target="_blank" rel="noopener noreferrer"', 'target="_&#98;lank"'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNSAFE_TARGET_BLANK'));
});

test('verifyBuild requires the active navigation item to be in the main navigation', async () => {
  const directory = await copiedOutput('active-nav-outside-nav');
  await changeHtml(directory, 'index.html', (html) => html
    .replace(' aria-current="page"', '')
    .replace('</main>', '<span aria-current="page">not navigation</span></main>'));
  await assert.rejects(() => verifyBuild(directory), hasFailure('NAVIGATION_ACTIVE_MISMATCH'));
});

test('verifyBuild detects a changed official logo hash', async () => {
  const directory = await copiedOutput('wrong-logo-hash');
  const path = join(directory, 'assets', 'ncepu-logo.png');
  const bytes = await readFile(path);
  bytes[bytes.length - 1] ^= 1;
  await writeFile(path, bytes);
  await assert.rejects(() => verifyBuild(directory), hasFailure('LOGO_HASH_MISMATCH'));
});

test('verifyBuild rejects unexpected HTML nested in the output tree', async () => {
  const directory = await copiedOutput('nested-html');
  await writeFile(join(directory, 'assets', 'draft.html'), '<p>staging residue</p>', 'utf8');
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNEXPECTED_HTML_OUTPUT'));
});

test('verifyBuild rejects unexpected HTML regardless of filename casing', async () => {
  const directory = await copiedOutput('nested-uppercase-html');
  await writeFile(join(directory, 'assets', 'draft.HTML'), '<p>staging residue</p>', 'utf8');
  await assert.rejects(() => verifyBuild(directory), hasFailure('UNEXPECTED_HTML_OUTPUT'));
});

test('verifyBuild CLI succeeds and emits concise success output', async () => {
  const { stdout, stderr } = await execFile(process.execPath, ['scripts/verify-build.mjs', validOutput], { cwd: projectDirectory });
  assert.match(stdout, /^Verified 4 HTML pages in .+\r?\n$/);
  assert.equal(stderr, '');
});

test('verifyBuild CLI exits nonzero and reports a specific failure', async () => {
  const directory = await copiedOutput('cli-failure');
  await rm(join(directory, 'styles', 'site.css'));
  await assert.rejects(
    () => execFile(process.execPath, ['scripts/verify-build.mjs', directory], { cwd: projectDirectory }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /MISSING_REQUIRED_ASSET: styles\/site\.css/);
      return true;
    },
  );
});
