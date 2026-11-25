# Shade Strategy website

Static HTML website preview. Serve the repository root locally:

```sh
python3 -m http.server 5478 --bind 127.0.0.1
```

Open [the homepage](http://127.0.0.1:5478/).

For the hosted site, Netlify runs `node scripts/build-preview.mjs` and serves `preview-build/`. The build also writes `_redirects` (every old Webflow address, from `scripts/site-map.mjs`), `_headers`, `robots.txt` and `sitemap.xml`. `_headers` sends `X-Robots-Tag: noindex` on every host except the production build on `https://shadestrategy.com`, so deploy previews and netlify.app stay out of search. GA4 (`analytics.js`) only runs on shadestrategy.com. The homepage has no inquiry forms: its "Get in touch" and closing sections send visitors to the strategy-call questionnaire (`/strategy-call/`), which records the lead in Launch Hub and GoHighLevel. The ebook signup (`ebook-form.js`) runs a Cloudflare Turnstile check, then posts to the `ebook-signup` Netlify Function (`/api/ebook-signup`), which upserts the contact in Shade Strategy's GoHighLevel sub-account, tags it `ebook-signup` and adds a dated note; the download page opens only once GHL confirms. The function reads `GHL_PRIVATE_TOKEN`, `GHL_LOCATION_ID` and `TURNSTILE_SECRET_KEY` from the Netlify site's environment variables (Emil sets them; without the Turnstile secret the server-side check is off). `GHL_API_BASE` exists only for local tests against a fake GHL.

The local homepage includes a Google Partner design reference. The hosted build excludes it. Use the official badge embed from the Google Ads manager account before displaying a badge on the hosted site.

Each search-focused page has one primary search phrase. Utility pages use short URLs. Use it naturally in the slug, HTML title, meta description, and first paragraph. The homepage uses the root URL. Keep managed PPC and AI Google Ads together on the Google Ads service page. Link directly to `#ai-google-ads` from tool cards. Give related search terms a home on the same page when they describe the same need.

## Moving shadestrategy.com off Webflow

`scripts/site-map.mjs` lists the 22 old Webflow addresses: the 7 that keep their address (home, privacy policy, terms and 4 blog posts) and the 15 that 301 to a new page. The design is `docs/superpowers/specs/2026-11-18-webflow-exit-design.md` and the step-by-step cutover is at the end of `docs/superpowers/plans/2026-11-19-webflow-exit.md`. `migration/seo-baseline.json` and `archive/webflow-2026-11/` hold the old site's SEO fields, HTML and images.

```bash
node --test 'tests/*.test.mjs'           # page, redirect, sitemap and analytics tests
node scripts/build-preview.mjs           # build preview-build/
netlify serve --offline --port 8888      # serve it with _redirects and _headers applied
node scripts/check-urls.mjs http://localhost:8888                 # every old address and sitemap page, as Googlebot
node scripts/check-urls.mjs https://shadestrategy.com --indexable # after the DNS switch: also no noindex, self-canonicals
```

