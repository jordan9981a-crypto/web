import { publications } from '../data/publications.mjs';
import { escapeHtml, externalLink } from '../lib/html.mjs';

function citation(publication) {
  const issue = publication.issue ? `(${publication.issue})` : '';
  const volume = publication.volume ? `, ${publication.volume}${issue}` : '';
  return `${publication.journal} ${publication.year}${volume}, ${publication.pages}.`;
}

function publicationItem(publication, sequence) {
  return `<li class="publication-entry">
    <span class="publication-number">${escapeHtml(sequence)}.</span>
    <div class="publication-record">
      <p class="publication-authors">${escapeHtml(publication.authors.join('; '))}</p>
      <h3>${escapeHtml(publication.title)}</h3>
      <p>${escapeHtml(citation(publication))}</p>
      <p>DOI: ${externalLink(publication.url, publication.doi)}</p>
    </div>
  </li>`;
}

export function renderPublications() {
  const years = [...new Set(publications.map(({ year }) => year))].sort((left, right) => right - left);
  const numberedPublications = publications.map((publication, index) => ({ publication, sequence: index + 1 }));
  return `<section class="page-hero"><div class="container"><p class="eyebrow">Publications</p><h1>论文</h1><p>论文按年份排列，链接指向 DOI 正式出版页面。</p></div></section>
  <section class="section"><div class="container">
    <div class="year-filters" role="group" aria-label="按年份筛选论文"><button type="button" data-year-filter="all" aria-pressed="true">全部</button>${years.map((year) => `<button type="button" data-year-filter="${escapeHtml(year)}" aria-pressed="false">${escapeHtml(year)}</button>`).join('')}</div>
    <div class="publication-years">${years.map((year) => `<section class="publication-year" data-year="${escapeHtml(year)}"><h2>${escapeHtml(year)}</h2><ol>${numberedPublications.filter(({ publication }) => publication.year === year).map(({ publication, sequence }) => publicationItem(publication, sequence)).join('')}</ol></section>`).join('')}</div>
  </div></section>`;
}
