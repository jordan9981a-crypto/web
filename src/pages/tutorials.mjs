import { tutorials } from '../data/tutorials.mjs';
import { escapeHtml, externalLink } from '../lib/html.mjs';

function tutorialCard(tutorial) {
  return `<article class="publication-card">
    <h2>${escapeHtml(tutorial.title)}</h2>
    <p>提取码：${escapeHtml(tutorial.accessCode)}</p>
    ${externalLink(tutorial.url, '打开教程', 'button-link')}
  </article>`;
}

export function renderTutorials() {
  return `<section class="page-hero"><div class="container"><p class="eyebrow">Tutorials</p><h1>科研教程</h1><p>汇集课题组常用的科研方法与工具教程。</p></div></section>
  <section class="section"><div class="container"><div class="publication-grid">${tutorials.map(tutorialCard).join('')}</div></div></section>`;
}
