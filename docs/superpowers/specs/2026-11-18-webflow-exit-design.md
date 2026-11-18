# Move shadestrategy.com off Webflow

Date: 2026-11-18. Status: waiting for Emil's approval.

## Why

Emil wants to cancel Shade Strategy's Webflow plan. shadestrategy.com is the only site that plan serves (DLUX is a separate Webflow site and stays put; 5 Day Plantation Shutters was never on Webflow). The new static site in this repo already runs on Netlify (`shadestrategywebsite`, https://shadestrategywebsite.netlify.app) with the strategy-call questionnaire live. Its README already has the redirect table and says to keep the blog and privacy links working through the move.

## Goals

- shadestrategy.com and www serve this repo from Netlify, and the Webflow plan can be canceled.
- Every address on the live Webflow sitemap (21 URLs plus `/`) either still works or sends a permanent (301) redirect to its closest new page.
- The privacy policy and terms keep their exact addresses. The Google sign-in app behind ads.shadestrategy.com and 19 footer links on this site point to `/published/privacy-policy`.
- The new site can be found by search engines: no `noindex`, canonical tags, a sitemap and robots.txt.
- Every form on the site sends what it says it sends.

## Non-goals

- Analytics. Neither the Webflow site nor the new site has GA4 today. Adding it is a separate follow-up.
- New copy or design beyond what moving the pages needs.
- 5 Day Plantation Shutters (a separate project, after this one).
- DLUX's Webflow site.

## Anti-goals (failure even if it "works")

- Changing any DNS record other than shadestrategy.com and www. The same DNS zone (Namecheap) carries Google Workspace mail (MX, SPF), `ads.`, `dashboard.` and Google verification TXT records.
- Canceling Webflow before the new site has been verified live on the real domain.
- Losing the 4 blog articles.

## Approaches considered

- **A. Carry over what's unique, redirect the rest (picked by Emil).** Rebuild the legal pages and the 4 blog posts, and 301 every other old address to its closest new page.
- B. Legal pages plus redirects only. This drops the blog articles for good once Webflow is canceled.
- C. Rebuild every old page. This is slow, and most of those pages would compete with their newer versions on this site.

## The design

### Pages carried over (same address, this site's layout)

| Address | Source |
| --- | --- |
| `/published/privacy-policy` | Webflow page text, unchanged |
| `/published/terms-and-conditions` | Webflow page text, unchanged |
| `/blog/chatgpt-for-window-treatment-businesses` | Webflow article |
| `/blog/how-to-increase-revenue-for-your-window-treatment-business` | Webflow article |
| `/blog/how-to-start-a-window-treatment-business` | Webflow article |
| `/blog/why-window-treatment-companies-need-seo` | Webflow article |

*Claude's call:* the blog posts keep their `/blog/…` addresses instead of moving under `/resources/`. That means no redirect hop, their search standing carries over unchanged, and this site already links to one of them at that address. `/resources/` gets a short list linking to all four.

Article text, headings, images and dates are copied as they are. Images are downloaded into `assets/blog/` so nothing loads from Webflow's CDN after cancellation.

### Redirects (301)

| Old address | New address |
| --- | --- |
| `/services/local-search-seo` | `/services/window-treatment-seo/` |
| `/services/ai-google-ads-for-window-treatment-businesses` | `/services/google-ads-for-window-treatment-companies/` |
| `/services/smart-websites` | `/services/window-treatment-website-design/` |
| `/windows-treatment-marketing-for-retailers` | `/industries/marketing-for-window-treatment-retailers/` |
| `/windows-treatment-for-Manufacturers` | `/industries/marketing-for-window-treatment-manufacturers/` |
| `/project/marketing-for-window-treatment-retailers` | `/industries/marketing-for-window-treatment-retailers/` |
| `/project/marketing-for-window-treatment-manufacturers` | `/industries/marketing-for-window-treatment-manufacturers/` |
| `/project/marketing-for-window-treatment-installers` | `/industries/marketing-for-window-treatment-retailers/` *(Claude's call: closest audience)* |
| `/published/contact-us` | `/contact/` |
| `/published/window-treatment-marketing-blog` | `/resources/` |
| `/published/window-treatment-industry-marketing` | `/` |
| `/published/thank-you` | `/` |
| `/utility-pages/coming-soon` | `/` |
| `/pricing` | `/strategy-call/` *(Claude's call: the new site doesn't publish prices)* |
| `/services/workflow-automations-for-window-treatment-businesses` | `/` *(Claude's call: no matching service page)* |

The first five come from the README table. Redirects live in `netlify.toml` and match case-sensitively, as Webflow did.

### Links inside this site

- The 3 "Get tool updates / Get beta updates" links that point to Webflow's coming-soon page go to `/contact/` instead.
- "Browse the blog" on `/resources/` points to the new list on that page.
- "Read the original testimonials" on `/results/` is removed. It points to the Webflow homepage, which goes away.
- Every absolute `https://shadestrategy.com/...` link becomes a relative link.

### Forms

- **Strategy-call questionnaire:** no change. Its Turnstile widget and the lead-form allowed origins already include shadestrategy.com and www.
- **Ebook signup** (Netlify Forms, `ebook-signup`): turn on form detection on the Netlify site and send one test signup before the domain switch.
- **The two homepage inquiry forms:** today they show "This is a preview. Your inquiry has not been sent." *Claude's proposal:* replace both with a "Book a strategy call" button that goes to `/strategy-call/`. That keeps one tested path for leads, with nothing new on the server. **Emil to confirm.**

### Ready for search

- Remove `<meta name="robots" content="noindex">` from every page.
- Add a self-canonical on every page using `https://shadestrategy.com/` (no www, which matches Webflow today).
- Add `sitemap.xml` (every real page, no redirects) and `robots.txt` pointing to it.
- Keep `shadestrategywebsite.netlify.app` and deploy previews out of search with an `X-Robots-Tag: noindex` header on non-production hosts.
- Ask Emil to add a Search Console Domain property (one TXT record) before the switch, so indexing can be watched afterward. Neither Google account has a property for this domain today.

### Cutover order

1. Build all of the above on branch `feat/webflow-exit`, check it locally and on a deploy preview, then open a PR. It merges on Emil's OK. Merging only changes the netlify.app site.
2. Save an archive of the 22 Webflow pages (HTML and images) into `archive/webflow-2026-11/` so nothing is lost after cancellation.
3. Add `shadestrategy.com` and `www.shadestrategy.com` as custom domains on the Netlify site.
4. Emil (or whoever has Namecheap) changes **only** these two records: apex `A` → `75.2.60.5`, and `www` `CNAME` → `shadestrategywebsite.netlify.app`. Everything else stays as it is.
5. Once the HTTPS certificate is issued, check every old address (200 or the expected 301), the legal pages, the questionnaire (one test lead, with OK), the ebook signup, robots and sitemap. Then submit the sitemap in Search Console.
6. Emil cancels the Webflow site plan only after step 5 passes. Claude's suggestion is to wait a few days, so the DNS change can be rolled back if needed.

## Left to the builder

- Page layout for the legal and blog pages, using the site's existing header, footer and styles.
- The exact netlify.toml syntax and the non-production noindex header.
- How the build script copies the new `blog/` and `published/` folders and the sitemap.
