// Save the live Webflow site's SEO fields and an archive of its pages and images.
// Run while Webflow still serves shadestrategy.com: node scripts/capture-baseline.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { OLD_URLS, SITE_ORIGIN } from './site-map.mjs';
import { extractSeo, decodeEntities } from './extract-seo.mjs';

const root = new URL('../', import.meta.url);
const archive = new URL('archive/webflow-2026-11/', root);
const images = new URL('images/', archive);
const IMAGE_PAGES = new Set(['/', '/published/privacy-policy', '/published/terms-and-conditions']);

export function archiveName(path) {
  return path === '/' ? 'index.html' : `${path.slice(1).replaceAll('/', '__')}.html`;
}

function imageUrls(html, base) {
  const urls = new Set();
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\ssrc\s*=\s*"([^"]+)"/i)?.[1];
    if (src) urls.add(new URL(decodeEntities(src), base).href);
    const srcset = tag.match(/\ssrcset\s*=\s*"([^"]+)"/i)?.[1];
    if (srcset) {
      for (const part of decodeEntities(srcset).split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (url) urls.add(new URL(url, base).href);
      }
    }
  }
  return [...urls].filter((u) => u.startsWith('https://'));
}

function imageName(url) {
  return decodeURIComponent(new URL(url).pathname.split('/').pop()).replace(/[^\w.-]+/g, '-');
}

await mkdir(images, { recursive: true });
const pages = {};
const imageMap = {};
for (const path of OLD_URLS) {
  const response = await fetch(SITE_ORIGIN + path, { redirect: 'manual' });
  const html = response.status === 200 ? await response.text() : '';
  if (html) await writeFile(new URL(archiveName(path), archive), html);
  pages[path] = { status: response.status, location: response.headers.get('location'), ...extractSeo(html) };
  if (html && (IMAGE_PAGES.has(path) || path.startsWith('/blog/'))) {
    for (const url of imageUrls(html, SITE_ORIGIN + path)) {
      if (imageMap[url]) continue;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`image ${res.status}: ${url}`);
        continue;
      }
      const name = imageName(url);
      await writeFile(new URL(name, images), Buffer.from(await res.arrayBuffer()));
      imageMap[url] = name;
    }
  }
  console.log(response.status, path);
}

await mkdir(new URL('migration/', root), { recursive: true });
await writeFile(
  new URL('migration/seo-baseline.json', root),
  `${JSON.stringify({ capturedAt: new Date().toISOString(), origin: SITE_ORIGIN, pages }, null, 2)}\n`,
);
await writeFile(new URL('images.json', archive), `${JSON.stringify(imageMap, null, 2)}\n`);
console.log(`${Object.keys(pages).length} pages, ${Object.keys(imageMap).length} images`);
