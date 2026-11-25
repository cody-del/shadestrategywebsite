// Files the build writes next to the pages: _redirects, _headers, robots.txt, sitemap.xml.
import { SITE_ORIGIN } from './site-map.mjs';

const NOT_IN_SITEMAP = new Set(['/ebook/']);

// Netlify sets CONTEXT and URL at build time. Only production on the apex domain may be indexed;
// deploy previews, branch deploys and the netlify.app hosts send noindex.
export function isIndexable(env) {
  return env.CONTEXT === 'production' && env.URL === SITE_ORIGIN;
}

export function redirectsFile(redirects) {
  return redirects.map(({ from, to }) => `${from} ${to} 301\n`).join('');
}

const SECURITY_HEADERS = [
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'X-Frame-Options: SAMEORIGIN',
  'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
];

// Security headers on every path; noindex as well on every host except production on the apex domain.
export function headersFile(indexable) {
  const headers = indexable ? SECURITY_HEADERS : [...SECURITY_HEADERS, 'X-Robots-Tag: noindex'];
  return `/*\n${headers.map((h) => `  ${h}\n`).join('')}`;
}

export function robotsTxt() {
  return `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
}

export function sitemapXml(paths, origin) {
  const urls = paths
    .filter((path) => !NOT_IN_SITEMAP.has(path))
    .map((path) => `  <url><loc>${origin}${path}</loc></url>\n`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}
