# Shade Strategy website

Static HTML homepage preview. Serve the repository root locally:

```sh
python3 -m http.server 5478 --bind 127.0.0.1
```

Open [the homepage](http://127.0.0.1:5478/).

For the hosted preview, Netlify runs `node scripts/build-preview.mjs` and serves `preview-build/`. The page is marked `noindex`. Both inquiry forms validate and show a preview message without sending anything.

The local homepage includes a Google Partner design reference. The hosted build excludes it. Use the official badge embed from the Google Ads manager account before displaying a badge on the hosted site.
