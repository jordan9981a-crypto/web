import { cp, lstat, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../src/data/site.mjs';
import { renderPage } from '../src/lib/render-page.mjs';
import { renderHome } from '../src/pages/home.mjs';
import { renderAbout } from '../src/pages/about.mjs';
import { renderMembers } from '../src/pages/members.mjs';
import { renderPublications } from '../src/pages/publications.mjs';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = resolve(rootDirectory, 'src');
const defaultOutputDirectory = resolve(rootDirectory, 'dist');
const tempDirectory = resolve(process.env.TMPDIR || process.env.TEMP || process.env.TMP || '/tmp');

const pages = [
  { file: 'index.html', title: site.name, description: site.description, render: renderHome },
  { file: 'about.html', title: '课题组简介', description: site.description, render: renderAbout },
  { file: 'members.html', title: '成员', description: '刘景维—吴双妍联合培养课题组成员名单。', render: renderMembers },
  { file: 'publications.html', title: '论文', description: '刘景维—吴双妍联合培养课题组论文目录。', render: renderPublications },
];

function isProperDescendant(path, parent) {
  const pathFromParent = relative(parent, path);
  return pathFromParent !== ''
    && pathFromParent !== '..'
    && !pathFromParent.startsWith(`..${sep}`)
    && !isAbsolute(pathFromParent);
}

function resolveDestination(outputDir) {
  const destination = isAbsolute(outputDir) ? resolve(outputDir) : resolve(rootDirectory, outputDir);
  if (destination === parse(destination).root) throw new TypeError('Output directory cannot be a filesystem root');
  if (destination === defaultOutputDirectory || isProperDescendant(destination, defaultOutputDirectory)) return destination;
  if (isProperDescendant(destination, tempDirectory)) return destination;
  throw new TypeError('Output directory must be within dist or a descendant of the OS temp directory');
}

function destinationBoundary(destination) {
  if (destination === defaultOutputDirectory || isProperDescendant(destination, defaultOutputDirectory)) return rootDirectory;
  return tempDirectory;
}

async function ensureDirectoryWithoutLinks(directory) {
  try {
    const entry = await lstat(directory);
    if (entry.isSymbolicLink() || !entry.isDirectory()) throw new TypeError('Output directory cannot contain linked or non-directory path components');
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await mkdir(directory);
  const created = await lstat(directory);
  if (created.isSymbolicLink() || !created.isDirectory()) throw new TypeError('Output directory cannot contain linked or non-directory path components');
}

async function prepareDestination(destination) {
  const boundary = destinationBoundary(destination);
  const parent = dirname(destination);
  let current = boundary;
  await ensureDirectoryWithoutLinks(current);
  for (const segment of relative(boundary, parent).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    await ensureDirectoryWithoutLinks(current);
  }
  try {
    if ((await lstat(destination)).isSymbolicLink()) throw new TypeError('Output directory cannot be a symbolic link');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export async function buildSite(outputDir = defaultOutputDirectory) {
  const destination = resolveDestination(outputDir);
  await prepareDestination(destination);
  const staging = await mkdtemp(`${destination}.staging-`);

  try {
    await Promise.all(pages.map(({ file, title, description, render }) => writeFile(
      resolve(staging, file),
      renderPage({ title, description, activePath: file, body: render() }),
      'utf8',
    )));
    await Promise.all(['styles', 'scripts', 'assets'].map((directory) => cp(
      resolve(sourceDirectory, directory),
      resolve(staging, directory),
      { recursive: true },
    )));
    await rm(destination, { recursive: true, force: true });
    await rename(staging, destination);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildSite();
  console.log('Built joint-training-lab-site/dist');
}
