import test from 'node:test';
import assert from 'node:assert/strict';
import { site } from '../src/data/site.mjs';
import { escapeHtml, externalLink, mailLink, safeHttpsUrl } from '../src/lib/html.mjs';
import { renderPage } from '../src/lib/render-page.mjs';

test('escapeHtml escapes HTML-significant characters', () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>&'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;',
  );
  assert.equal(escapeHtml("'"), '&#39;');
});

test('externalLink renders safe new-window attributes', () => {
  const link = externalLink('https://doi.org/10.1000/example', '查看 DOI');

  assert.match(link, /target="_blank"/);
  assert.match(link, /rel="noopener noreferrer"/);
  assert.match(link, /aria-hidden="true">↗<\/span>/);
});

test('safeHttpsUrl accepts only credential-free absolute HTTPS URLs', () => {
  assert.equal(
    safeHttpsUrl('https://doi.org/10.1000/example?q=a&ref="citation"'),
    'https://doi.org/10.1000/example?q=a&ref=%22citation%22',
  );

  for (const value of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://example.com',
    'not a URL',
    'https://user:password@example.com',
  ]) {
    assert.throws(() => safeHttpsUrl(value), TypeError, value);
  }
});

test('externalLink validates URLs and escapes label and class values', () => {
  assert.throws(() => externalLink('javascript:alert(1)', 'unsafe'), TypeError);
  assert.equal(
    externalLink('https://example.com/?a=1&b=2', '<label>', 'link "wide"'),
    '<a class="link &quot;wide&quot;" href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">&lt;label&gt; <span class="external-indicator" aria-hidden="true">↗</span></a>',
  );
});

test('mailLink escapes the email in its URL and visible text', () => {
  assert.equal(
    mailLink('name"@example.com'),
    '<a class="text-link" href="mailto:name&quot;@example.com">name&quot;@example.com</a>',
  );
});

test('renderPage provides the accessible shared document shell', () => {
  const html = renderPage({
    title: '测试页',
    description: '测试描述',
    activePath: 'members.html',
    body: '<h1>成员</h1>',
  });

  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /<meta property="og:title" content="测试页｜/);
  assert.match(html, /<a class="skip-link" href="#main-content">跳到主要内容<\/a>/);
  assert.match(html, /<main id="main-content"><h1>成员<\/h1><\/main>/);
  assert.match(html, /<header class="site-header">/);
  assert.match(html, /class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-navigation"/);
  assert.match(html, /<nav id="main-navigation" class="main-navigation" aria-label="主导航">/);
  assert.match(html, /href="members\.html" aria-current="page">成员<\/a>/);
  assert.match(html, /<footer class="site-footer"><div class="container footer-grid">/);
});

test('renderPage escapes page metadata and marks school links as safe external links', () => {
  const html = renderPage({
    title: '<测试>',
    description: '描述 & "引号"',
    activePath: 'index.html',
    body: '<p>可信内容</p>',
  });

  assert.match(html, /<title>&lt;测试&gt;｜/);
  assert.match(html, /content="描述 &amp; &quot;引号&quot;"/);
  assert.equal((html.match(/class="school-mark"/g) ?? []).length, 2);
  assert.equal((html.match(/class="school-mark"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/g) ?? []).length, 2);
  assert.equal((html.match(/class="external-indicator" aria-hidden="true">↗/g) ?? []).length, 4);
  for (const school of site.schools) {
    assert.match(html, new RegExp(`<img src="${school.logo}" alt="${school.name}标识"`));
    assert.match(html, new RegExp(`<span aria-hidden="true">${school.name}<\\/span>`));
  }
});

test('renderPage assigns exactly one active navigation link for every route', () => {
  for (const activePath of ['index.html', 'about.html', 'members.html', 'publications.html']) {
    const html = renderPage({ title: '页面', description: '描述', activePath, body: '<p>可信内容</p>' });
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1, activePath);
    assert.match(html, new RegExp(`href="${activePath}" aria-current="page"`), activePath);
  }
});

test('renderPage uses each official mark’s intrinsic width and height attributes', () => {
  const html = renderPage({ title: site.name, description: 'test', activePath: 'index.html', body: '<p>trusted</p>' });

  for (const school of site.schools) {
    assert.match(html, new RegExp(`<img src="${school.logo}"[^>]*width="${school.logoWidth}" height="${school.logoHeight}">`));
  }
});

test('renderPage does not duplicate the site name in the home title and retains trusted body markup', () => {
  const html = renderPage({
    title: site.name,
    description: '描述',
    activePath: 'index.html',
    body: '<section data-trusted="yes">内容</section>',
  });

  assert.ok(html.includes(`<title>${site.name}</title>`));
  assert.doesNotMatch(html, /｜.*｜/);
  assert.match(html, /<main id="main-content"><section data-trusted="yes">内容<\/section><\/main>/);
});
