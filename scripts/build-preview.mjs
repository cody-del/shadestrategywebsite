import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { REDIRECTS, SITE_ORIGIN } from './site-map.mjs';
import { listPages, pagePath } from './pages.mjs';
import { headersFile, isIndexable, redirectsFile, robotsTxt, sitemapXml } from './site-outputs.mjs';

const root = new URL('../', import.meta.url);
const output = new URL('preview-build/', root);
const html = await readFile(new URL('index.html', root), 'utf8');
const hostedHtml = html.replace(
  /^ *<!-- local-preview-only:start -->\r?\n[\s\S]*?^ *<!-- local-preview-only:end -->\r?\n/gm,
  '',
);

if (hostedHtml.includes('google-partner-preview.png')) {
  throw new Error('Remove the local Google Partner image before deploying the preview.');
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(new URL('index.html', output), hostedHtml);
for (const file of ['styles.css', 'navigation.js', 'analytics.js']) {
  await cp(new URL(file, root), new URL(file, output));
}
for (const directory of ['services/', 'full-service/', 'industries/', 'about/', 'results/', 'resources/', 'contact/', 'strategy-call/', 'ebook/', 'blog/', 'published/']) {
  await cp(new URL(directory, root), new URL(directory, output), { recursive: true });
}
await cp(new URL('assets/', root), new URL('assets/', output), {
  recursive: true,
  filter: (source) => !source.endsWith('/google-partner-preview.png'),
});

const indexable = isIndexable(process.env);
const paths = listPages(fileURLToPath(root)).map(pagePath).sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
await writeFile(new URL('_redirects', output), redirectsFile(REDIRECTS));
await writeFile(new URL('_headers', output), headersFile(indexable));
await writeFile(new URL('robots.txt', output), robotsTxt());
await writeFile(new URL('sitemap.xml', output), sitemapXml(paths, SITE_ORIGIN));
console.log(`Built preview-build/ (${paths.length} pages, ${indexable ? 'indexable' : 'noindex'})`);
