import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { memberGroups } from '../src/data/members.mjs';
import { publications } from '../src/data/publications.mjs';
import { site } from '../src/data/site.mjs';
import { renderMembers } from '../src/pages/members.mjs';
import { renderPublications } from '../src/pages/publications.mjs';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputDirectory = resolve(rootDirectory, 'dist');
const expectedPages = ['index.html', 'about.html', 'members.html', 'publications.html'];
const requiredAssets = ['styles/site.css', 'scripts/site.js', 'assets/SOURCES.md'];
const logoAssets = [
  { file: 'assets/ncepu-logo.png', width: 292, height: 70, sha256: '78658D131C6B27A96778718A86EE15944741149C3610C3F0E6B49A5B3E8EB7BE' },
  { file: 'assets/syuct-logo.png', width: 332, height: 70, sha256: '2751BF6684008A7AD06460CBA029BF5FCF2537AC7388BADBAB46BB06D7C8823B' },
];
const approvedImageSources = new Set(logoAssets.map(({ file }) => file));
const expectedDeployableFiles = new Set([...expectedPages, ...requiredAssets, ...logoAssets.map(({ file }) => file)]);
const expectedOutputDirectories = new Set(['styles', 'scripts', 'assets']);
const approvedStylesheetHash = '914613C4FA7876A358CD73C90345359ED46A5B168EF0D74C72F730025D2D38C6';
const forbiddenPlanningNumbers = ['15140123456', '151-4012-3456', '151 4012 3456', '0312-7521234', '03127521234', '0312 7521234', '(0312)7521234'];

export class BuildVerificationError extends Error {
  constructor(failures) {
    super(`Build verification failed: ${failures.map(({ code, message }) => `${code}: ${message}`).join('; ')}`);
    this.name = 'BuildVerificationError';
    this.failures = failures;
    this.code = failures[0]?.code;
  }
}

function countOccurrences(text, value) {
  return text.split(value).length - 1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntities(value) {
  return value.replace(/&#(x[0-9a-f]+|\d+);?|&(amp|lt|gt|quot|apos);/gi, (match, numeric, named) => {
    if (named) return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[named.toLowerCase()];
    const hexadecimal = numeric[0].toLowerCase() === 'x';
    const codePoint = Number.parseInt(hexadecimal ? numeric.slice(1) : numeric, hexadecimal ? 16 : 10);
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return match;
    }
  });
}

function decodeCssEscapes(value) {
  return value.replace(/\\([0-9a-f]{1,6}\s?|.)/gi, (match, escaped) => {
    const hexadecimal = escaped.match(/^([0-9a-f]{1,6})\s?$/i)?.[1];
    if (!hexadecimal) return escaped;
    try {
      return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
    } catch {
      return match;
    }
  });
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function isDescendant(path, parent) {
  const fromParent = relative(parent, path);
  return fromParent !== '' && fromParent !== '..' && !fromParent.startsWith(`..${sep}`) && !isAbsolute(fromParent);
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/\b([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map(([, name, doubleQuoted, singleQuoted, unquoted]) => [name.toLowerCase(), doubleQuoted ?? singleQuoted ?? unquoted]));
}

function hasClass(tag, className) {
  return decodeHtmlEntities(attributes(tag).class ?? '').split(/\s+/).includes(className);
}

function localPath(value) {
  const withoutSuffix = value.split(/[?#]/, 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(withoutSuffix);
  } catch {
    return null;
  }
  if (!decoded || decoded.startsWith('/') || decoded.startsWith('\\') || decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').includes('..')) return null;
  return decoded;
}

function failure(failures, code, message) {
  failures.push({ code, message });
}

async function fileIsNonempty(path) {
  try {
    const entry = await lstat(path);
    return entry.isFile() && entry.size > 0;
  } catch {
    return false;
  }
}

async function inspectAssets(outputDir, failures) {
  for (const asset of requiredAssets) {
    if (!await fileIsNonempty(resolve(outputDir, asset))) failure(failures, 'MISSING_REQUIRED_ASSET', `${asset} must be a nonempty file`);
  }
  try {
    const stylesheet = await readFile(resolve(outputDir, 'styles/site.css'));
    const stylesheetHash = createHash('sha256').update(stylesheet).digest('hex').toUpperCase();
    if (stylesheetHash !== approvedStylesheetHash) failure(failures, 'STYLESHEET_HASH_MISMATCH', 'styles/site.css does not match the approved deployable stylesheet');
  } catch {
    // The required-asset check reports a missing stylesheet.
  }

  for (const logo of logoAssets) {
    const path = resolve(outputDir, logo.file);
    if (!await fileIsNonempty(path)) {
      failure(failures, 'MISSING_REQUIRED_ASSET', `${logo.file} must be a nonempty file`);
      continue;
    }
    const bytes = await readFile(path);
    const dimensions = pngDimensions(bytes);
    if (!dimensions || dimensions.width !== logo.width || dimensions.height !== logo.height) {
      failure(failures, 'INVALID_LOGO_PNG', `${logo.file} must be a ${logo.width}x${logo.height} PNG`);
      continue;
    }
    const actualHash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    if (actualHash !== logo.sha256) failure(failures, 'LOGO_HASH_MISMATCH', `${logo.file} does not match the approved official mark`);
  }
}

function inspectPageShell(file, html, failures) {
  const requireMatch = (pattern, description) => {
    if (!pattern.test(html)) failure(failures, 'PAGE_SHELL_MISMATCH', `${file} is missing ${description}`);
  };
  requireMatch(/<html\b[^>]*\blang="zh-CN"/i, 'lang="zh-CN"');
  requireMatch(/<meta\b[^>]*\bname="viewport"/i, 'viewport metadata');
  requireMatch(/<main\b[^>]*\bid="main-content"/i, 'main-content');
  requireMatch(/<nav\b[^>]*\bid="main-navigation"[^>]*\baria-label="[^"]*主导航/i, '主导航');
  requireMatch(/<title>[^<]+<\/title>/i, 'title');
  requireMatch(/<meta\b[^>]*\bname="description"[^>]*\bcontent="[^"]+"/i, 'meta description');
  for (const property of ['og:type', 'og:title', 'og:description']) requireMatch(new RegExp(`<meta\\b[^>]*\\bproperty="${property}"[^>]*\\bcontent="[^\"]+"`, 'i'), `${property} metadata`);
  requireMatch(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="styles\/site\.css"/i, 'stylesheet reference');
  requireMatch(/<script\b[^>]*\bsrc="scripts\/site\.js"/i, 'script reference');
  const stylesheetLinks = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => attributes(tag))
    .filter((attrs) => decodeHtmlEntities(attrs.rel ?? '').toLowerCase().split(/\s+/).includes('stylesheet'));
  if (stylesheetLinks.length !== 1 || decodeHtmlEntities(stylesheetLinks[0].href ?? '') !== 'styles/site.css') {
    failure(failures, 'UNAPPROVED_STYLESHEET', `${file} must use only the approved local stylesheet`);
  }
  const navMatches = [...html.matchAll(/<nav\b(?=[^>]*\bid="main-navigation")[^>]*>([\s\S]*?)<\/nav>/g)];
  const allActiveTags = [...html.matchAll(/<[\w:-]+\b[^>]*\baria-current\s*=\s*(?:"page"|'page'|page)[^>]*>/gi)];
  if (navMatches.length !== 1) {
    failure(failures, 'NAVIGATION_ACTIVE_MISMATCH', `${file} must contain one main navigation`);
    return;
  }
  const activeLinks = [...navMatches[0][1].matchAll(/<a\b[^>]*>/gi)]
    .map(([tag]) => attributes(tag))
    .filter((attrs) => decodeHtmlEntities(attrs['aria-current'] ?? '').toLowerCase() === 'page');
  if (allActiveTags.length !== 1 || activeLinks.length !== 1 || decodeHtmlEntities(activeLinks[0].href ?? '') !== file) {
    failure(failures, 'NAVIGATION_ACTIVE_MISMATCH', `${file} must have one active navigation link for itself`);
  }
}

async function inspectReferences(outputDir, file, html, failures) {
  for (const tagMatch of html.matchAll(/<([\w:-]+)\b[^>]*>/g)) {
    const [tag] = tagMatch;
    const attrs = attributes(tag);
    const tagName = tagMatch[1].toLowerCase();
    if (tagName === 'base') failure(failures, 'UNAPPROVED_BASE_ELEMENT', `${file} must not contain a base element`);
    if (Object.keys(attrs).some((name) => name.startsWith('on'))) failure(failures, 'UNSAFE_INLINE_EVENT_HANDLER', `${file} contains an inline event handler`);
    if (tagName === 'link' && decodeHtmlEntities(attrs.href ?? '') !== 'styles/site.css') failure(failures, 'UNAPPROVED_LINK_RESOURCE', `${file} contains an unapproved link resource`);
    if (decodeHtmlEntities(attrs.target ?? '').toLowerCase() === '_blank') {
      const tokens = new Set(decodeHtmlEntities(attrs.rel ?? '').toLowerCase().split(/\s+/));
      if (!tokens.has('noopener') || !tokens.has('noreferrer')) failure(failures, 'UNSAFE_TARGET_BLANK', `${file} target="_blank" needs rel="noopener noreferrer"`);
    }
    if (attrs.style !== undefined || attrs.poster !== undefined || attrs.background !== undefined || (tagName === 'input' && decodeHtmlEntities(attrs.type ?? '').toLowerCase() === 'image') || ['picture', 'source', 'style', 'svg', 'image', 'object', 'embed', 'iframe', 'video', 'canvas'].includes(tagName)) {
      failure(failures, 'UNAPPROVED_EMBEDDED_CONTENT', `${file} contains a disallowed embedded image or styling construct`);
    }
    if (tagName === 'picture' || tagName === 'source' || attrs.srcset || (tagName === 'img' && !approvedImageSources.has(attrs.src))) {
      failure(failures, 'UNAPPROVED_IMAGE', `${file} contains a non-official image source`);
    }

    for (const attribute of ['href', 'src']) {
      const value = attrs[attribute];
      if (!value) continue;
      const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
      if (scheme === 'https') {
        try {
          const url = new URL(value);
          if (url.protocol !== 'https:' || !url.hostname) throw new TypeError();
        } catch {
          failure(failures, 'UNSAFE_EXTERNAL_REFERENCE', `${file} has an invalid HTTPS ${attribute}`);
        }
        continue;
      }
      if (scheme === 'mailto' && attribute === 'href' && value.length > 'mailto:'.length) continue;
      if (scheme || value.startsWith('//') || (value.startsWith('#') && attribute !== 'href')) {
        failure(failures, 'UNSAFE_EXTERNAL_REFERENCE', `${file} has a disallowed ${attribute} scheme`);
        continue;
      }
      if (value.startsWith('#')) continue;
      const path = localPath(value);
      if (!path) {
        failure(failures, 'UNSAFE_LOCAL_REFERENCE', `${file} has unsafe local ${attribute} "${value}"`);
        continue;
      }
      const target = resolve(dirname(resolve(outputDir, file)), path);
      if (!isDescendant(target, outputDir) || !await fileIsNonempty(target)) failure(failures, 'MISSING_LOCAL_REFERENCE', `${file} references a missing local file: ${value}`);
    }
  }
}

async function inspectPrivacy(outputDir, htmlByFile, failures) {
  const textByFile = new Map(htmlByFile);
  for (const file of requiredAssets) {
    try {
      textByFile.set(file, await readFile(resolve(outputDir, file), 'utf8'));
    } catch {
      // The required-asset check reports unreadable files with a clearer failure.
    }
  }
  const text = decodeHtmlEntities([...textByFile.values()].join('\n'));
  const prohibitedPhoneLabels = /phone|telephone|mobile|\btel\b|电话|手機|手机|联系电话|电话号码|固定电话/i;
  const mainlandMobile = /(?<!\d)(?:\+?86[-\s]?)?1[-\s]?[3-9](?:[-\s]?\d){9}(?!\d)/;
  const mainlandLandline = /(?<!\d)(?:\+?86[-\s]?)?(?:\(\s?0\d{2,3}\s?\)|0\d{2,3})(?:[-\s]?\d){7,8}(?!\d)/;
  if (prohibitedPhoneLabels.test(text) || mainlandMobile.test(text) || mainlandLandline.test(text) || forbiddenPlanningNumbers.some((number) => text.includes(number))) {
    failure(failures, 'PROHIBITED_PHONE_CONTENT', 'phone labels or mainland telephone values are not permitted');
  }
  if (/\.pdf\b|\bpdf(?:[-_\s]?(?:url|link|download|file))?\b/i.test(text)) failure(failures, 'PROHIBITED_PDF_REFERENCE', 'PDF references and PDF-like fields are not permitted');
  const css = decodeCssEscapes(textByFile.get('styles/site.css') ?? '');
  if (/\burl\s*\(|@import\b/i.test(css)) failure(failures, 'CSS_URL_REFERENCE', 'styles/site.css must not load image, import, or other URL resources');
}

function inspectMembers(html, failures) {
  const renderedGroups = [...html.matchAll(/<section\b[^>]*\bclass="member-group"[^>]*>[\s\S]*?<ul\b[^>]*\bclass="name-grid"[^>]*>([\s\S]*?)<\/ul>[\s\S]*?<\/section>/g)]
    .map(([, list]) => [...list.matchAll(/<li>([^<]*)<\/li>/g)].map(([, name]) => name));
  const expectedGroups = memberGroups.map(({ names }) => names);
  const renderedNames = renderedGroups.flat();
  const expectedNames = expectedGroups.flat();
  const allListNames = [...html.matchAll(/<li\b[^>]*>([^<]*)<\/li>/g)].map(([, name]) => name);
  const mainMatch = html.match(/<main\b[^>]*\bid="main-content"[^>]*>([\s\S]*?)<\/main>/);
  if (JSON.stringify(renderedGroups) !== JSON.stringify(expectedGroups) || JSON.stringify(allListNames) !== JSON.stringify(expectedNames) || new Set(renderedNames).size !== renderedNames.length || renderedNames.length !== expectedNames.length) {
    failure(failures, 'MEMBER_LIST_MISMATCH', 'members.html must contain exactly the two consented member groups in confirmed order');
  }
  if (!mainMatch || mainMatch[1] !== renderMembers()) {
    failure(failures, 'MEMBER_SECTION_MISMATCH', 'members.html must retain the approved two-group member body without extra content');
  }
}

function citation({ journal, year, volume, issue, pages }) {
  return `${journal} ${year}, ${volume}${issue ? `(${issue})` : ''}, ${pages}.`;
}

function visibleAnchorText(html) {
  const withoutHiddenContent = html
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '')
    .replace(/<([\w:-]+)\b(?=[^>]*\b(?:aria-hidden|hidden|inert|style)\b)[^>]*>[\s\S]*?<\/\1>/gi, '');
  return decodeHtmlEntities(withoutHiddenContent.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function inspectPublications(html, failures) {
  const entries = [...html.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)]
    .map(([entry]) => entry)
    .filter((entry) => hasClass(entry.match(/<li\b[^>]*>/i)?.[0] ?? '', 'publication-entry'));
  const mainContent = html.match(/<main\b[^>]*\bid="main-content"[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
  const yearsContent = [...mainContent.matchAll(/<div\b[^>]*>([\s\S]*?)<\/div>/gi)]
    .find(([block]) => hasClass(block.match(/<div\b[^>]*>/i)?.[0] ?? '', 'publication-years'))?.[1] ?? null;
  const listItems = [...(yearsContent ?? '').matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)].map(([item]) => item);
  const publicationYears = new Set(publications.map(({ year }) => year)).size;
  const structuralCountsMatch = [
    ['article', 0],
    ['h1', 1],
    ['h2', publicationYears],
    ['h3', publications.length],
    ['p', 2 + publications.length * 3],
    ['ol', publicationYears],
    ['li', publications.length],
  ].every(([tag, expected]) => (mainContent.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length === expected);
  const entryClassCount = [...mainContent.matchAll(/<[\w:-]+\b[^>]*>/g)].filter(([tag]) => hasClass(tag, 'publication-entry')).length;
  if (mainContent !== renderPublications() || entries.length !== publications.length || listItems.length !== publications.length || entryClassCount !== publications.length || !structuralCountsMatch) {
    failure(failures, 'PUBLICATION_BODY_MISMATCH', 'publications main body must contain only the approved publication structure');
    failure(failures, 'PUBLICATION_ENTRY_MISMATCH', 'publication-years must contain only the five approved publication list items');
  }
  if (entries.length !== publications.length || countOccurrences(html, 'DOI:') !== publications.length) failure(failures, 'PUBLICATION_METADATA_MISMATCH', 'publications.html must contain exactly five publication entries and DOI fields');
  for (const [index, publication] of publications.entries()) {
    const entry = entries[index] ?? '';
    const textValues = [publication.title, publication.authors.join('; '), citation(publication)];
    const doiAnchors = [...entry.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
      .map(([, attributeText, content]) => ({ attrs: attributes(`<a${attributeText}>`), content }))
      .filter(({ attrs }) => decodeHtmlEntities(attrs.href ?? '') === publication.url);
    if (textValues.some((value) => countOccurrences(entry, value) !== 1) || doiAnchors.length !== 1 || !visibleAnchorText(doiAnchors[0].content).includes(publication.doi)) {
      failure(failures, 'PUBLICATION_ENTRY_MISMATCH', `publication entry ${index + 1} must match DOI ${publication.doi}`);
      failure(failures, 'PUBLICATION_METADATA_MISMATCH', `publication metadata must appear exactly once for DOI ${publication.doi}`);
    }
  }
}

function inspectSiteIdentity(htmlByFile, failures) {
  const combined = [...htmlByFile.values()].join('\n');
  const index = htmlByFile.get('index.html') ?? '';
  const about = htmlByFile.get('about.html') ?? '';
  if (![...htmlByFile.values()].every((html) => html.includes(site.name))) failure(failures, 'SITE_IDENTITY_MISMATCH', 'every page must identify the joint training laboratory');
  for (const school of site.schools) if (!combined.includes(school.name)) failure(failures, 'SITE_IDENTITY_MISMATCH', `missing school: ${school.name}`);
  for (const advisor of site.advisors) {
    if (!index.includes(advisor.name) || !about.includes(advisor.name) || !index.includes(advisor.email) || !about.includes(advisor.email)) failure(failures, 'SITE_IDENTITY_MISMATCH', `advisor details are incomplete: ${advisor.name}`);
  }
  for (const direction of site.directions) if (!index.includes(direction.name) || !about.includes(direction.name)) failure(failures, 'SITE_IDENTITY_MISMATCH', `research direction is incomplete: ${direction.name}`);
}

async function inspectOutputLayout(outputDir, failures) {
  let entries;
  try {
    const root = await lstat(outputDir);
    if (!root.isDirectory()) throw new TypeError();
    entries = await readdir(outputDir, { withFileTypes: true });
  } catch {
    failure(failures, 'INVALID_OUTPUT_DIRECTORY', `${outputDir} is not a readable output directory`);
    return;
  }
  const htmlEntries = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html')).map((entry) => entry.name).sort();
  if (JSON.stringify(htmlEntries) !== JSON.stringify([...expectedPages].sort())) failure(failures, 'UNEXPECTED_HTML_OUTPUT', 'output must contain exactly index, about, members, and publications HTML pages');
  async function inspectDirectory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name);
      const entryRelativePath = relative(outputDir, entryPath).split(sep).join('/');
      if (entry.name.includes('.staging-') || entry.isSymbolicLink()) {
        failure(failures, 'STAGING_RESIDUE', `unexpected output entry: ${entryRelativePath}`);
      } else if (entry.isDirectory()) {
        if (!expectedOutputDirectories.has(entryRelativePath)) failure(failures, 'UNEXPECTED_OUTPUT_DIRECTORY', `unexpected output directory: ${entryRelativePath}`);
        await inspectDirectory(entryPath);
      } else if (entry.isFile() && !expectedDeployableFiles.has(entryRelativePath)) {
        failure(failures, entry.name.toLowerCase().endsWith('.html') ? 'UNEXPECTED_HTML_OUTPUT' : 'UNEXPECTED_OUTPUT_FILE', `unexpected output file: ${entryRelativePath}`);
      }
    }
  }
  await inspectDirectory(outputDir);
}

export async function verifyBuild(outputDir = defaultOutputDirectory) {
  const destination = resolve(outputDir);
  const failures = [];
  await inspectOutputLayout(destination, failures);
  await inspectAssets(destination, failures);
  const htmlByFile = new Map();
  for (const file of expectedPages) {
    try {
      htmlByFile.set(file, await readFile(resolve(destination, file), 'utf8'));
    } catch {
      failure(failures, 'MISSING_HTML_PAGE', `${file} is missing or unreadable`);
    }
  }
  for (const [file, html] of htmlByFile) {
    inspectPageShell(file, html, failures);
    await inspectReferences(destination, file, html, failures);
  }
  if (htmlByFile.size === expectedPages.length) {
    await inspectPrivacy(destination, htmlByFile, failures);
    inspectMembers(htmlByFile.get('members.html'), failures);
    inspectPublications(htmlByFile.get('publications.html'), failures);
    inspectSiteIdentity(htmlByFile, failures);
  }
  if (failures.length) throw new BuildVerificationError(failures);
  return { outputDir: destination, pages: expectedPages.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyBuild(process.argv[2] ?? defaultOutputDirectory);
    console.log(`Verified ${result.pages} HTML pages in ${result.outputDir}`);
  } catch (error) {
    if (error instanceof BuildVerificationError) {
      for (const { code, message } of error.failures) console.error(`${code}: ${message}`);
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  }
}
