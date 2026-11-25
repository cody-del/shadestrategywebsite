// Which source files are pages, and the URL path each one is served at.
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKIP = new Set(['preview-build', 'archive', 'docs', 'node_modules', 'migration', 'tests', 'scripts', 'assets']);

export function pagePath(file) {
  const path = file.split(sep).join('/');
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'index.html'.length)}`;
  return `/${path.replace(/\.html$/, '')}`;
}

export function listPages(root) {
  const pages = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (dir === root.replace(/\/$/, '') && SKIP.has(entry.name)) continue;
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        pages.push(relative(root, full).split(sep).join('/'));
      }
    }
  };
  walk(root.replace(/\/$/, ''));
  return pages.sort();
}
