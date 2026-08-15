import { site } from '../data/site.mjs';
import { escapeHtml, mailLink } from '../lib/html.mjs';

function advisorCard(advisor) {
  return `<article class="advisor-card">
    <p class="eyebrow">${escapeHtml(advisor.school)}</p>
    <h3>${escapeHtml(advisor.name)} <small>${escapeHtml(advisor.englishName)}</small></h3>
    <p>${escapeHtml(advisor.title)} · ${escapeHtml(advisor.department)}</p>
    <p>${mailLink(advisor.email)}</p>
  </article>`;
}

function directionCard(direction) {
  return `<article class="direction-card"><h3>${escapeHtml(direction.name)}</h3><p>${escapeHtml(direction.summary)}</p></article>`;
}

export function renderAbout() {
  return `<section class="page-hero"><div class="container"><p class="eyebrow">About</p><h1>课题组简介</h1><p>${escapeHtml(site.description)}</p></div></section>
  <section class="section"><div class="container prose"><h2>联合培养</h2><p>课题组依托华北电力大学与沈阳化工大学的学科与科研平台，围绕功能配合物和先进储能材料开展联合培养与协同研究。</p></div></section>
  <section class="section"><div class="container"><h2>导师</h2><div class="advisor-grid">${site.advisors.map(advisorCard).join('')}</div></div></section>
  <section class="section"><div class="container"><h2>研究方向</h2><div class="card-grid">${site.directions.map(directionCard).join('')}</div></div></section>`;
}
