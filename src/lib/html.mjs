export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeHttpsUrl(value) {
  if (typeof value !== 'string' || value.trim() !== value || !/^https:\/\//i.test(value)) {
    throw new TypeError('URL must be an absolute HTTPS URL');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('URL must be an absolute HTTPS URL');
  }

  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new TypeError('URL must be an absolute HTTPS URL without credentials');
  }

  return url.href;
}

export function externalLink(url, label, className = 'text-link') {
  const safeUrl = safeHttpsUrl(url);
  return `<a class="${escapeHtml(className)}" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <span class="external-indicator" aria-hidden="true">↗</span></a>`;
}

export function mailLink(email) {
  const safeEmail = escapeHtml(email);
  return `<a class="text-link" href="mailto:${safeEmail}">${safeEmail}</a>`;
}
