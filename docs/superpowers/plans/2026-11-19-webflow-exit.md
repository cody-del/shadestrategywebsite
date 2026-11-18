# Webflow Exit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve shadestrategy.com from this repo on Netlify, with every old Webflow address still working, so the Webflow plan can be canceled without losing search standing.

**Architecture:** One module (`scripts/site-map.mjs`) holds the old URL list, what each old address becomes, and the site origin. The build script uses it to write `_redirects`, `_headers`, `sitemap.xml` and `robots.txt` into `preview-build/`, and `scripts/check-urls.mjs` uses it to test a live origin. The legal pages and the 4 blog posts become `.html` files so Netlify serves them at their exact Webflow addresses (no trailing slash, no redirect hop).

**Tech Stack:** Static HTML/CSS, Node 22+ ES modules (no dependencies), `node:test`, Netlify (`netlify-cli` 27 for `netlify serve`).

**Spec:** `docs/superpowers/specs/2026-11-18-webflow-exit-design.md`

## Global Constraints

- Site origin is `https://shadestrategy.com` (apex, no www) in every canonical, sitemap entry and JSON-LD URL.
- Only two DNS records ever change: apex `A` → `75.2.60.5`, `www` `CNAME` → `shadestrategywebsite.netlify.app`. MX, SPF, `ads.`, `dashboard.` and the google-site-verification TXT records stay as they are.
- Every old Webflow URL returns 200 at the same address, or one 301 straight to its final page. Never a chain.
- The privacy policy and terms keep their exact addresses: `/published/privacy-policy` and `/published/terms-and-conditions`.
- Blog posts keep address, title, H1, body text and original publish date. No images load from Webflow's CDN (`website-files.com`, `webflow.com`).
- `/pricing` redirects to `/full-service/` (changed from the spec's `/strategy-call/` now that the offer pages exist, PR #4).
- `ebook/` stays `noindex` and out of the sitemap (it is the post-signup download page).
- Push, merge, deploy, Netlify setting changes and test leads only with Emil's explicit OK. Emil (or whoever holds Namecheap) makes the DNS changes; Claude never logs in there.
- Every page that links `styles.css` uses the same `?v=` tag; bump it on every page whenever `styles.css` changes.
- Tests run with `node --test tests/`; no npm dependencies.

## Review Focus

1. An old URL with a trailing slash (`/pricing/`, `/services/smart-websites/`) gets the same single 301 as without it. Pinned in Task 7.
2. An old URL with a query string (`/pricing?gclid=abc`) keeps the query on the 301 so ad tracking survives. Pinned in Task 7.
3. `/published/privacy-policy/` (with slash, as some apps store it) still reaches the page: a 200, or one 301 to the slashless address. Pinned in Task 7.
4. Any host that isn't production on `https://shadestrategy.com` (deploy previews, branch deploys, the second Netlify site `shade-strategy-website-preview`, a `www` primary domain) sends `X-Robots-Tag: noindex`. Pinned in Task 5.
5. Removing `contact-preview.js` leaves the homepage's ebook form intact: it still posts to `/ebook/` with `data-netlify="true"` and `netlify-honeypot="bot-field"`. Pinned in Task 6.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `scripts/site-map.mjs` (new) | Old URLs, redirect map, kept addresses, site origin |
| `scripts/extract-seo.mjs` (new) | Pull title, H1, meta description, canonical and JSON-LD out of an HTML string |
| `scripts/capture-baseline.mjs` (new) | Fetch every old URL from the live Webflow site, write `migration/seo-baseline.json` and the archive |
| `scripts/pages.mjs` (new) | `pagePath` and `listPages`: which source files are pages, and their URL paths |
| `scripts/site-outputs.mjs` (new) | Pure builders for `_redirects`, `_headers`, `robots.txt`, `sitemap.xml`, and `isIndexable(env)` |
| `scripts/build-preview.mjs` (modify) | Copy `blog/`, `published/`, `full-service/`; write the four generated files; stop copying `contact-preview.js` |
| `scripts/check-urls.mjs` (new) | Request every old URL and sitemap URL on an origin as Googlebot and report failures |
| `published/*.html`, `blog/*.html` (new) | Legal pages and blog posts |
| `assets/blog/<slug>/` (new) | Blog images, downloaded |
| `migration/` (new) | `seo-baseline.json`, Search Console exports |
| `archive/webflow-2026-11/` (new) | Raw HTML and images of the 22 Webflow pages |
| `tests/*.test.mjs` (new) | `node:test` suites |

---

### Task 0: Branch and spec update

**Files:**
- Modify: `docs/superpowers/specs/2026-11-18-webflow-exit-design.md`

- [ ] **Step 1: Put the branch on top of the offer pages.** If PR #4 (`feat/offer-pages`) is merged: `git fetch origin && git rebase origin/main`. If not: `git rebase origin/feat/offer-pages`. The PR from this branch then targets `feat/offer-pages` (stacked), and before `feat/offer-pages` is deleted after merging, check `gh pr list --base feat/offer-pages`.
- [ ] **Step 2: Update the spec.**
  - Change the `/pricing` row to `/full-service/` with the note "offer pages exist since PR #4".
  - Under "Pages carried over", add "served from `.html` files so the address has no trailing slash".
  - Under "Ready for search", add "indexable only when Netlify `CONTEXT` is `production` and `URL` is `https://shadestrategy.com`".
- [ ] **Step 3: Commit** `git commit -am "Update Webflow exit design for the offer pages"`

### Task 1: Site map module

**Files:**
- Create: `scripts/site-map.mjs`, `tests/site-map.test.mjs`

**Interfaces:**
- Produces:
  - `SITE_ORIGIN: 'https://shadestrategy.com'`
  - `KEPT: string[]`: the 7 old paths that keep their address: `/`, `/published/privacy-policy`, `/published/terms-and-conditions` and the 4 `/blog/…` paths from the spec.
  - `REDIRECTS: Array<{ from: string, to: string }>`: the 15 rows of the spec's redirect table, with `/pricing` → `/full-service/`.
  - `OLD_URLS: string[]`: `KEPT` plus every `from`, which is the 22 Webflow sitemap paths.

- [ ] **Step 1: Write the failing test**

```js
test('covers the 22 Webflow sitemap paths exactly once', () => {
  assert.equal(OLD_URLS.length, 22);
  assert.equal(new Set(OLD_URLS).size, 22);
});
test('no redirect target is itself redirected (no chains)', () => {
  const froms = new Set(REDIRECTS.map(r => r.from));
  for (const r of REDIRECTS) assert.ok(!froms.has(r.to), r.to);
});
test('pricing goes to full service and keeps the capital M path', () => {
  assert.deepEqual(REDIRECTS.find(r => r.from === '/pricing'), { from: '/pricing', to: '/full-service/' });
  assert.ok(REDIRECTS.some(r => r.from === '/windows-treatment-for-Manufacturers'));
});
test('every redirect target exists as a page in the repo', () => { /* each `to` maps to <dir>/index.html or <path>.html on disk */ });
```

- [ ] **Step 2: Run** `node --test tests/site-map.test.mjs`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `scripts/site-map.mjs`** with the exports above. Copy paths from the spec table verbatim.
- [ ] **Step 4: Run** `node --test tests/site-map.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `git add scripts/site-map.mjs tests/site-map.test.mjs && git commit -m "Add the old-URL map for the Webflow exit"`

### Task 2: SEO baseline and Webflow archive

Run this while Webflow is still live.

**Files:**
- Create: `scripts/extract-seo.mjs`, `scripts/capture-baseline.mjs`, `tests/extract-seo.test.mjs`, `migration/seo-baseline.json`, `archive/webflow-2026-11/`

**Interfaces:**
- Consumes: `OLD_URLS` from Task 1.
- Produces:
  - `extractSeo(html: string) -> { title, h1, description, canonical, jsonLd: object[] }`: string fields are `null` when missing, and `jsonLd` is `[]` when there are no scripts or they don't parse.
  - `migration/seo-baseline.json`: `{ capturedAt, origin: 'https://shadestrategy.com', pages: { [path]: { status, ...extractSeo } } }`.
  - `archive/webflow-2026-11/<path-with-slashes-as-__>.html`, plus `archive/webflow-2026-11/images/`. Task 4 reads the blog HTML and Task 6 reads homepage JSON-LD from these.

- [ ] **Step 1: Write the failing tests.** For `extractSeo`, use a small HTML fixture string with two JSON-LD blocks, one of them invalid:
  - `assert.equal(seo.title, 'A | B')`
  - `assert.equal(seo.jsonLd.length, 1)`
  - `assert.equal(seo.canonical, 'https://shadestrategy.com/x')`
  - with no H1 present, `assert.equal(seo.h1, null)`
- [ ] **Step 2: Run** `node --test tests/extract-seo.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement `extractSeo`** with regexes; no HTML parser dependency. Implement `capture-baseline.mjs`:
  - Fetch `SITE_ORIGIN + path` for each `OLD_URLS` path with `redirect: 'manual'`, then save the HTML and record status and SEO fields.
  - Download every `<img src>` and `srcset` URL on the 4 blog pages, the 2 legal pages and the homepage into `archive/webflow-2026-11/images/`.
  - Run the downloads into a fresh empty directory and parse nothing as code.
- [ ] **Step 4: Run** `node --test tests/extract-seo.test.mjs` (PASS), then `node scripts/capture-baseline.mjs`. Expected: 22 entries, `/` with status 200 and a non-empty `jsonLd`.
- [ ] **Step 5: Commit** `git add scripts/extract-seo.mjs scripts/capture-baseline.mjs tests/extract-seo.test.mjs migration archive && git commit -m "Capture the Webflow SEO baseline and archive"`

### Task 3: Legal pages

**Files:**
- Create: `published/privacy-policy.html`, `published/terms-and-conditions.html`, `scripts/pages.mjs`, `tests/pages.test.mjs` (the first suite; Task 6 extends it)

**Interfaces:**
- Consumes: the archive from Task 2.
- Produces:
  - `pagePath(file: string) -> string`, exported from `scripts/pages.mjs`. It maps `foo/index.html` → `/foo/`, `published/x.html` → `/published/x` and `index.html` → `/`.
  - `listPages(root: string) -> string[]` (also in `scripts/pages.mjs`): every source `.html` page under `root`, excluding `preview-build/`, `archive/`, `docs/` and `node_modules/`.

- [ ] **Step 1: Write the failing test.** Both legal files exist. Each has:
  - the site header and footer (`class="site-header"`, `class="site-footer"`)
  - `<link rel="canonical" href="https://shadestrategy.com/published/privacy-policy">` (and the terms equivalent)
  - asset paths starting with `../`
  - body text containing the Webflow page's first paragraph, read from the archive file
- [ ] **Step 2: Run** `node --test tests/pages.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Build both pages.**
  - Use the layout from `full-service/index.html`: same header, nav and footer, with relative paths one level up.
  - Use the Webflow text unchanged, inside `<main id="main-content" class="service-page legal-page">`.
  - Titles: `Privacy Policy | Shade Strategy` and `Terms and Conditions | Shade Strategy`.
- [ ] **Step 4: Run** `node --test tests/pages.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Carry over the privacy policy and terms"`

### Task 4: Blog posts and the Resources list

**Files:**
- Create: `blog/chatgpt-for-window-treatment-businesses.html`, `blog/how-to-increase-revenue-for-your-window-treatment-business.html`, `blog/how-to-start-a-window-treatment-business.html`, `blog/why-window-treatment-companies-need-seo.html`, `assets/blog/<slug>/*`
- Modify: `resources/index.html` (a "Blog" section with the 4 posts; "Browse the blog" → `#blog`), `services/window-treatment-seo/index.html:227` (absolute blog link → `../../blog/why-window-treatment-companies-need-seo`), `styles.css` (article typography; bump `?v=` on every page)
- Test: `tests/pages.test.mjs`

- [ ] **Step 1: Write the failing tests.** For each post:
  - title and H1 equal the baseline's `title` and `h1` for that path
  - canonical is `https://shadestrategy.com/blog/<slug>`
  - exactly one Article JSON-LD with `headline`, `datePublished` (the Webflow date), `author`, and `publisher.name` `"Shade Strategy"`
  - every `<img>` has a non-empty `alt` and a `src` under `../assets/blog/<slug>/`

  Site-wide (every source page): no `website-files.com` or `webflow.com` URL anywhere. `resources/index.html` links all 4 posts and has `id="blog"`.
- [ ] **Step 2: Run** `node --test tests/pages.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Build the 4 posts.**
  - Copy the article HTML from the archive.
  - Keep headings, lists and links. Rewrite internal Webflow links to their new addresses using `REDIRECTS`.
  - Copy images into `assets/blog/<slug>/`.
  - Show the publish date under the H1.
- [ ] **Step 4: Run** `node --test tests/pages.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Carry over the four blog posts"`

### Task 5: Build outputs (redirects, headers, sitemap, robots)

**Files:**
- Create: `scripts/site-outputs.mjs`, `tests/site-outputs.test.mjs`
- Modify: `scripts/build-preview.mjs`

**Interfaces:**
- Consumes: `REDIRECTS` and `SITE_ORIGIN` from Task 1; `pagePath` and `listPages` from `scripts/pages.mjs` (Task 3).
- Produces:
  - `isIndexable(env: Record<string,string|undefined>) -> boolean`: true only when `env.CONTEXT === 'production' && env.URL === 'https://shadestrategy.com'`.
  - `redirectsFile(redirects) -> string`: one `from to 301` line per entry.
  - `headersFile(indexable: boolean) -> string`: `/*\n  X-Robots-Tag: noindex\n` when false, `''` when true.
  - `robotsTxt() -> string`: `User-agent: *\nAllow: /\nSitemap: https://shadestrategy.com/sitemap.xml\n`.
  - `sitemapXml(paths: string[], origin: string) -> string`: one `<url><loc>` per path, excluding `/ebook/`.

- [ ] **Step 1: Write the failing tests.**
  - `isIndexable` returns true for `{CONTEXT:'production', URL:'https://shadestrategy.com'}`.
  - `isIndexable` returns false for each of:
    - `{CONTEXT:'deploy-preview', URL:'https://shadestrategy.com'}`
    - `{CONTEXT:'production', URL:'https://www.shadestrategy.com'}`
    - `{CONTEXT:'production', URL:'https://shadestrategywebsite.netlify.app'}`
    - `{CONTEXT:'production', URL:'https://shade-strategy-website-preview.netlify.app'}`
    - `{}`
  - `redirectsFile` contains `/pricing /full-service/ 301`.
  - `sitemapXml` has no `/ebook/` entry, and every `<loc>` starts with `https://shadestrategy.com/`.
- [ ] **Step 2: Run** `node --test tests/site-outputs.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement `site-outputs.mjs`, then update `build-preview.mjs`.**
  - Add `blog/` and `published/` to the copied directories. `full-service/` is already there from PR #4.
  - Write `_redirects`, `_headers`, `robots.txt` and `sitemap.xml` into `preview-build/`.
  - Remove `contact-preview.js` from the copied files.
- [ ] **Step 4: Run** `node --test tests/` and `node scripts/build-preview.mjs`. Expected: all PASS. `preview-build/_headers` contains `noindex` (no Netlify env locally), and `preview-build/sitemap.xml` lists 25 URLs: 19 directory pages (no `/ebook/`), 2 legal and 4 blog. Recount if pages were added since.
- [ ] **Step 5: Commit** `git commit -m "Generate redirects, headers, sitemap and robots at build time"`

### Task 6: Page heads, links, forms and homepage schema

**Files:**
- Modify: every `**/index.html` (heads and links), `index.html` (forms and Organization JSON-LD), `results/index.html:71`, `resources/ai-for-the-window-treatment-industry/index.html:105`
- Delete: `contact-preview.js`
- Test: `tests/pages.test.mjs`

- [ ] **Step 1: Write the failing tests** (all source pages from `listPages()`):
  - **Robots meta:** no `<meta name="robots" content="noindex">`, except `ebook/index.html`, which keeps it.
  - **Canonical:** exactly one `<link rel="canonical">`, equal to `SITE_ORIGIN + pagePath(file)`, except `ebook/`, which has none.
  - **Absolute links:** no `href="https://shadestrategy.com` in any `<a>`.
  - **Old Webflow pages:** no `coming-soon` link, and no "Read the original testimonials" text.
  - **Contact forms:** no `contact-form`, `contact-preview.js` or "This is a preview" text in `index.html`. In their place, two links to the strategy-call page with the text "Book a strategy call".
  - **Ebook form:** still matches `name="ebook-signup"`, `action="/ebook/"`, `data-netlify="true"` and `netlify-honeypot="bot-field"`.
  - **Homepage Organization JSON-LD:**
    - `name: 'Shade Strategy'`
    - `legalName: 'Winc Solutions LLC, DBA Shade Strategy'`
    - `telephone: '(615) 795-7515'`
    - `url: 'https://shadestrategy.com/'`
    - `logo` pointing to a file under `https://shadestrategy.com/assets/`
    - `sameAs` equal to the Webflow baseline's `sameAs` for `/`
    - no `aggregateRating`
  - **Title:** the homepage title stays `Window Treatment Marketing | Shade Strategy`.
- [ ] **Step 2: Run** `node --test tests/pages.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Apply the changes.**
  - Turn absolute `https://shadestrategy.com/...` links into relative ones for that page's depth.
  - Point the 3 coming-soon links to `contact/` (relative).
  - Delete the results-page testimonials link.
  - Replace both homepage `<form class="contact-form">` blocks with a `cta` link "Book a strategy call →" to `./strategy-call/`. Keep each section's heading.
  - Remove the `contact-preview.js` script tag and file.
  - Add the Organization JSON-LD in `<head>`.
- [ ] **Step 4: Run** `node --test tests/` and `node scripts/build-preview.mjs`. Expected: all PASS, and the build succeeds.
- [ ] **Step 5: Commit** `git commit -m "Make the site indexable and drop Webflow links"`

### Task 7: URL checker

**Files:**
- Create: `scripts/check-urls.mjs`, `tests/check-urls.test.mjs`

**Interfaces:**
- Consumes: `KEPT`, `REDIRECTS` from Task 1.
- Produces:
  - `checkUrl({ origin, path, expectTo, fetchImpl }) -> Promise<{ ok: boolean, detail: string }>`.
    - It requests with `redirect: 'manual'` and the user-agent `Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)`.
    - With `expectTo` null, it passes on a 200.
    - With `expectTo` set, it passes on a 301 whose `Location`, resolved against the origin, equals `origin + expectTo` (plus the request's query string), and that target returns 200.
  - CLI: `node scripts/check-urls.mjs <origin> [--indexable]`. It checks:
    - every `KEPT` path, every redirect, the trailing-slash form of each redirect, `/pricing?gclid=test`, and `/published/privacy-policy/` (a 200 or one 301 to the slashless address)
    - every `<loc>` in `<origin>/sitemap.xml`, which must return 200; with `--indexable`, each must also have no `X-Robots-Tag: noindex` header and a canonical equal to its own `SITE_ORIGIN` URL

  It prints one line per failure and exits 1 if any fail.

- [ ] **Step 1: Write the failing tests** with a fake `fetchImpl`:
  - A 302 is reported as a failure ("expected 301").
  - A 301 to `/strategy-call/` when `expectTo` is `/full-service/` fails.
  - A 301 chain (target answers 301) fails.
  - `/pricing?gclid=test` passes only if `Location` keeps `?gclid=test`.
  - A relative `Location` (`/full-service/`) passes.
- [ ] **Step 2: Run** `node --test tests/check-urls.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement `checkUrl` and the CLI.**
- [ ] **Step 4: Run** `node --test tests/`. Expected: PASS. Then run against Netlify's local server, which applies `_redirects` and `_headers`:
  - Start `netlify serve --port 8888` (background).
  - Run `node scripts/check-urls.mjs http://localhost:8888`.
  - Expected: exit 0. Without `--indexable`, every page sends `noindex`, which is correct locally.
- [ ] **Step 5: Commit** `git commit -m "Add the old-URL checker"`

### Task 8: Pull request

- [ ] **Step 1:** `node --test tests/ && node scripts/build-preview.mjs` passes.
- [ ] **Step 2: Look at it.**
  - Start the `site-preview` server from `~/repos/.claude/launch.json` and open the legal pages, one blog post, Resources and the homepage at desktop and phone width.
  - Read the console for errors.
- [ ] **Step 3: Push and open a PR, with Emil's OK.**
  - Base: `main`, or `feat/offer-pages` if PR #4 isn't merged.
  - The body lists the cutover steps below as unchecked boxes. Deploy previews need a Netlify sign-in, so say the URL checker ran against `netlify serve`.

---

## Cutover (with Emil, after the PR is approved)

Each step waits for Emil's OK. None of them is code.

- [ ] **C1 Search Console first** (before merging if possible):
  - Emil adds a Domain property for `shadestrategy.com` and puts its TXT record at Namecheap.
  - Export pages and query+page data (16 months) to `migration/gsc-pages.csv` and `migration/gsc-queries.csv`.
  - If any of `/published/thank-you`, `/utility-pages/coming-soon`, `/published/window-treatment-industry-marketing` or `/services/workflow-automations-for-window-treatment-businesses` has clicks, give it a closer target in `scripts/site-map.mjs`, then re-run the tests.
- [ ] **C2 Merge** the PR on Emil's OK. This only changes `shadestrategywebsite.netlify.app`. Then run `node scripts/check-urls.mjs https://shadestrategywebsite.netlify.app`; expected exit 0.
- [ ] **C3 Ebook form:**
  - With Emil's OK, turn on form detection on the Netlify site.
  - Redeploy.
  - Send one test signup on the netlify.app site and confirm it appears under Forms → `ebook-signup`.
- [ ] **C4 Domain:**
  1. Add `shadestrategy.com` (primary) and `www.shadestrategy.com` on the Netlify site.
  2. Emil changes only the apex `A` and `www` `CNAME` records.
  3. Wait for the HTTPS certificate.
  4. Trigger a new production deploy, so `URL` becomes `https://shadestrategy.com` and `_headers` drops `noindex`.
  5. Check `curl -sI https://shadestrategywebsite.netlify.app/`. If it answers 200 rather than a 301 to the apex, add a host redirect to `netlify.toml`: `from = "https://shadestrategywebsite.netlify.app/*"`, `to = "https://shadestrategy.com/:splat"`, `status = 301`, `force = true`.
- [ ] **C5 Live checks:**
  - `node scripts/check-urls.mjs https://shadestrategy.com --indexable` exits 0.
  - `dig` shows MX and TXT unchanged.
  - With OK, send one strategy-call test lead and delete it after.
  - Submit `sitemap.xml` in Search Console and request indexing for `/`, `/full-service/`, `/services/` and the 4 posts.
- [ ] **C6 Monitoring:**
  - Check Search Console for 404s and canonical problems daily for 2 weeks.
  - Re-measure clicks and impressions against `migration/` at 4 and 8 weeks.
  - Emil cancels the Webflow site plan no sooner than a few days after C5 passes.
