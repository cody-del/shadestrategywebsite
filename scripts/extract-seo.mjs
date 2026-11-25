// Pull the SEO fields out of an HTML string. Regex-based on purpose: no dependencies.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function text(fragment) {
  if (fragment == null) return null;
  const clean = decodeEntities(fragment.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
  return clean || null;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3]) : null;
}

function findTag(html, tagName, test) {
  for (const m of html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))) {
    if (test(m[0])) return m[0];
  }
  return null;
}

export function extractSeo(html) {
  const title = text(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const h1 = text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const metaTag = findTag(html, 'meta', (t) => attr(t, 'name')?.toLowerCase() === 'description');
  const linkTag = findTag(html, 'link', (t) => attr(t, 'rel')?.toLowerCase() === 'canonical');
  const jsonLd = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      jsonLd.push(JSON.parse(m[1]));
    } catch {
      // Invalid JSON-LD is ignored, as search engines do.
    }
  }
  return {
    title,
    h1,
    description: metaTag ? attr(metaTag, 'content') : null,
    canonical: linkTag ? attr(linkTag, 'href') : null,
    jsonLd,
  };
}
