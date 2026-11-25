import { submitEbookSignup } from './ebook.mjs';
import { TOKEN_FIELD, verifyHuman } from './turnstile.mjs';

// At most 5 signups per visitor per 15 minutes, in memory: it resets when the instance is recycled, so it
// slows a flood rather than stopping it. Netlify's own rate limit (the function's config) is the first line.
export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 5 } = {}) {
  const recent = new Map();
  return (key, now = Date.now()) => {
    if (recent.size > 1000) for (const [stale, times] of recent) if (now - times.at(-1) >= windowMs) recent.delete(stale);
    const times = (recent.get(key) ?? []).filter((time) => now - time < windowMs);
    const limited = times.length >= max;
    if (!limited) times.push(now);
    recent.set(key, times);
    return limited;
  };
}

export function createEbookHandler(submit = submitEbookSignup, rateLimited = createRateLimiter(), isHuman = verifyHuman) {
  return async (request, context) => {
    const send = (status, body, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
    if (request.method !== 'POST') return send(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
    if (request.headers.get('origin') !== new URL(request.url).origin) return send(403, { error: 'Invalid origin.' });
    if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return send(415, { error: 'Unsupported request.' });
    if (Number(request.headers.get('content-length')) > 8192) return send(413, { error: 'Request too large.' });
    let data;
    try {
      const text = await request.text();
      if (text.length > 8192) return send(413, { error: 'Request too large.' });
      data = JSON.parse(text);
    } catch {
      return send(400, { error: 'Invalid request.' });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return send(400, { error: 'Invalid request.' });
    const ip = context?.ip ?? request.headers.get('x-nf-client-connection-ip') ?? 'unknown';
    const { [TOKEN_FIELD]: token, ...answers } = data;
    if (!(await isHuman(token, ip))) return send(403, { error: 'We couldn’t confirm you’re a person. Please try again.' });
    const result = await submit(answers, { rateLimited: () => rateLimited(ip) });
    return send(result.status, result.body);
  };
}
