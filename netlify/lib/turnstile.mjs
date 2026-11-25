// Cloudflare Turnstile, as on the John Crawford sites: the page puts a human check on the ebook form,
// and the function checks its token before anything reaches GoHighLevel. It uses the same widget as
// the strategy-call questionnaire (site key 0x4AAAAAAGDn79T2ZVsXk_Ga).
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TOKEN_FIELD = 'cf-turnstile-response';

// Resolves true when the request may go on. Without TURNSTILE_SECRET_KEY the check is off and the
// other checks still apply, so the code can ship before the secret is set.
export async function verifyHuman(token, ip, { fetcher = fetch, env = process.env } = {}) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'unknown') body.set('remoteip', ip);
  try {
    const response = await fetcher(SITEVERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(3000) });
    const result = await response.json();
    if (result?.success === true) return true;
    console.error(`[turnstile] token refused: ${(result?.['error-codes'] ?? []).join(',') || `HTTP ${response.status}`}`);
    return false;
  } catch (error) {
    // Cloudflare unreachable: let the signup through rather than lose it; the other checks still apply.
    console.error(`[turnstile] siteverify unavailable: ${error.name}`);
    return true;
  }
}
