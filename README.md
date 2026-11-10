# Shade Strategy website

Static HTML website preview. Serve the repository root locally:

```sh
python3 -m http.server 5478 --bind 127.0.0.1
```

Open [the homepage](http://127.0.0.1:5478/).

For the hosted preview, Netlify runs `node scripts/build-preview.mjs` and serves `preview-build/`. The preview pages are marked `noindex`. Both inquiry forms validate and show a preview message without sending anything. The ebook signup opens the download page locally without recording any information. For hosted signups, enable Netlify form detection before deploying and look for submissions under `ebook-signup`.

The local homepage includes a Google Partner design reference. The hosted build excludes it. Use the official badge embed from the Google Ads manager account before displaying a badge on the hosted site.

Each search-focused page has one primary search phrase. Utility pages use short URLs. Use it naturally in the slug, HTML title, meta description, and first paragraph. The homepage uses the root URL. Keep managed PPC and AI Google Ads together on the Google Ads service page. Link directly to `#ai-google-ads` from tool cards. Give related search terms a home on the same page when they describe the same need.

When the redesign replaces the live site, use these permanent redirects and use the destination URLs in internal links, canonical tags, and the production sitemap. Keep the existing blog, privacy policy, and visualizer beta links available during the cutover.

| Current URL | New URL |
| --- | --- |
| `/services/local-search-seo` | `/services/window-treatment-seo/` |
| `/services/ai-google-ads-for-window-treatment-businesses` | `/services/google-ads-for-window-treatment-companies/` |
| `/services/smart-websites` | `/services/window-treatment-website-design/` |
| `/windows-treatment-marketing-for-retailers` | `/industries/marketing-for-window-treatment-retailers/` |
| `/windows-treatment-for-Manufacturers` | `/industries/marketing-for-window-treatment-manufacturers/` |
