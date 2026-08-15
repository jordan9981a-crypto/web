import { site } from '../data/site.mjs';
import { publications } from '../data/publications.mjs';
import { escapeHtml, externalLink, mailLink } from '../lib/html.mjs';

function directionCard(direction, index) {
  return `<article class="direction-card">
    <p class="direction-number">${String(index + 1).padStart(2, '0')}</p>
    <h3>${escapeHtml(direction.name)}</h3>
    <p>${escapeHtml(direction.summary)}</p>
  </article>`;
}

function publicationCard(publication) {
  return `<article class="publication-card">
    <p class="eyebrow">${escapeHtml(publication.year)} · ${escapeHtml(publication.journal)}</p>
    <h3>${escapeHtml(publication.title)}</h3>
    <p>${escapeHtml(publication.authors.join('; '))}</p>
    ${externalLink(publication.url, '查看论文', 'button-link')}
  </article>`;
}

function advisorCard(advisor) {
  return `<article class="advisor-card">
    <h3>${escapeHtml(advisor.name)} <small>${escapeHtml(advisor.englishName)}</small></h3>
    <p>${escapeHtml(advisor.title)}</p>
    <p>${escapeHtml(advisor.school)} · ${escapeHtml(advisor.department)}</p>
    <p>${mailLink(advisor.email)}</p>
  </article>`;
}

export function renderHome() {
  return `<section class="hero">
    <div class="container hero-grid">
      <div>
        <p class="eyebrow">North China Electric Power University × Shenyang University of Chemical Technology</p>
        <h1>${escapeHtml(site.name)}</h1>
        <p class="hero-lead">${escapeHtml(site.description)}</p>
        <p class="hero-actions"><a class="button-link" href="about.html">了解课题组</a> <a class="text-link" href="publications.html">查看论文</a></p>
      </div>
      <div class="molecule-visual" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <p class="eyebrow">Research</p><h2>研究方向</h2>
      <div class="card-grid">${site.directions.map(directionCard).join('')}</div>
    </div>
  </section>
  <section class="section section-tint">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Publications</p><h2>最新论文</h2></div><a href="publications.html">全部论文 →</a></div>
      <div class="publication-grid">${publications.slice(0, 3).map(publicationCard).join('')}</div>
    </div>
  </section>
  <section class="section contact-section">
    <div class="container">
      <p class="eyebrow">Contact</p><h2>联系导师</h2>
      <div class="advisor-grid">${site.advisors.map(advisorCard).join('')}</div>
    </div>
  </section>`;
}
