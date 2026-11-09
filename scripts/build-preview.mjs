import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

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
for (const file of ['styles.css', 'navigation.js', 'contact-preview.js']) {
  await cp(new URL(file, root), new URL(file, output));
}
await cp(new URL('assets/', root), new URL('assets/', output), {
  recursive: true,
  filter: (source) => !source.endsWith('/google-partner-preview.png'),
});
