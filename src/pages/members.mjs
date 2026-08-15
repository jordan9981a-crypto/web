import { memberGroups } from '../data/members.mjs';
import { escapeHtml } from '../lib/html.mjs';

function memberGroup(group) {
  return `<section class="member-group"><h2>${escapeHtml(group.label)}</h2><ul class="name-grid">${group.names.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul></section>`;
}

export function renderMembers() {
  return `<section class="page-hero"><div class="container"><p class="eyebrow">Members</p><h1>成员</h1><p>这里展示已同意公开姓名的课题组成员。</p></div></section>
  <section class="section"><div class="container member-sections">${memberGroups.filter(({ names }) => names.length > 0).map(memberGroup).join('')}</div></section>`;
}
