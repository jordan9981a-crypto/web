import { site } from '../data/site.mjs';
import { escapeHtml, externalLink, safeHttpsUrl } from './html.mjs';

const navigation = [
  ['index.html', '首页'],
  ['about.html', '课题组简介'],
  ['members.html', '成员'],
  ['publications.html', '论文'],
];

function schoolMark({ name, url, logo, logoWidth, logoHeight }) {
  const safeUrl = safeHttpsUrl(url);
  return `<a class="school-mark" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(logo)}" alt="${escapeHtml(name)}标识" width="${logoWidth}" height="${logoHeight}"><span aria-hidden="true">${escapeHtml(name)}</span><span class="external-indicator" aria-hidden="true">↗</span></a>`;
}

function navigationLink([path, label], activePath) {
  const currentPage = path === activePath ? ' aria-current="page"' : '';
  return `<a href="${escapeHtml(path)}"${currentPage}>${escapeHtml(label)}</a>`;
}

export function renderPage({ title, description, activePath, body }) {
  const fullTitle = title === site.name ? title : `${title}｜${site.name}`;
  const safeTitle = escapeHtml(fullTitle);
  const safeDescription = escapeHtml(description);
  // Body must be trusted pre-rendered HTML.
  const trustedBody = body;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${safeDescription}">
  <meta name="theme-color" content="#0b5d5b">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="styles/site.css">
  <script src="scripts/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <header class="site-header">
    <div class="brand-bar container">
      <div class="school-marks">${site.schools.map(schoolMark).join('')}</div>
      <a class="site-name" href="index.html">${escapeHtml(site.name)}</a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-navigation">菜单</button>
    </div>
    <nav id="main-navigation" class="main-navigation" aria-label="主导航">
      <div class="container">${navigation.map((item) => navigationLink(item, activePath)).join('')}</div>
    </nav>
  </header>
  <main id="main-content">${trustedBody}</main>
  <footer class="site-footer"><div class="container footer-grid">
      <div>
        <p>${escapeHtml(site.name)}</p>
        <p>${escapeHtml(site.description)}</p>
      </div>
      <div>
        <h2>合作单位</h2>
        <p>${site.schools.map(({ name, url }) => externalLink(url, name)).join('、')}</p>
      </div>
    </div>
  </footer>
</body>
</html>`;
}
