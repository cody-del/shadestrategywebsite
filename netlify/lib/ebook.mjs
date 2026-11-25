// Ebook signups go to Shade Strategy's GoHighLevel sub-account: the contact is upserted (never created,
// so a returning visitor isn't refused as a duplicate), then tagged ebook-signup in a call of its own,
// since the tag is what starts a GHL workflow, then given a dated note. The token and location come from
// this site's Netlify environment variables, which Emil sets.
export const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
export const EBOOK_TAG = 'ebook-signup';
export const EBOOK_TITLE = '3 Mistakes Keeping You Under $100K a Month';
const SOURCE = 'Website: ebook (3 Mistakes)';
// Submissions sooner than this after the page loads are refused. The page waits it out, so a person never sees it.
export const MIN_FILL_MS = 3000;
export const EMAIL = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
const FALLBACK = 'Email cody@shadestrategy.com and we’ll send the ebook.';

export async function submitEbookSignup(data, { fetcher = fetch, rateLimited = () => false, env = process.env, now = () => new Date() } = {}) {
  const fail = (status, error) => ({ status, body: { success: false, error } });
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail(400, 'Please enter your name and email.');
  // Hidden field people never see; bots fill it in.
  if (data.website) {
    console.error('[ebook] Dropped: honeypot filled');
    return fail(400, `We couldn’t send that. ${FALLBACK}`);
  }
  // Time since the page loaded, on the visitor's own clock.
  if (!Number.isSafeInteger(data.elapsedMs) || data.elapsedMs < MIN_FILL_MS) {
    console.error('[ebook] Dropped: sent too fast');
    return fail(400, `We couldn’t send that. ${FALLBACK}`);
  }
  const name = typeof data.name === 'string' ? data.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!name || name.length > 120) return fail(400, 'Please enter your name.');
  if (!email || email.length > 254 || !EMAIL.test(email)) return fail(400, 'Please enter a valid email address.');
  if (rateLimited()) return fail(429, `Too many requests. Please wait a few minutes. ${FALLBACK}`);
  const token = env.GHL_PRIVATE_TOKEN;
  const locationId = env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    console.error('[ebook] GHL_PRIVATE_TOKEN and GHL_LOCATION_ID are not configured');
    return fail(500, `We couldn’t save your details. ${FALLBACK}`);
  }
  const [firstName, ...rest] = name.split(' ');
  const contact = { locationId, firstName, ...(rest.length ? { lastName: rest.join(' ') } : {}), email, source: SOURCE };
  const headers = { Authorization: `Bearer ${token}`, Version: GHL_VERSION, 'Content-Type': 'application/json', Accept: 'application/json' };
  // GHL_API_BASE is for local testing against a fake GoHighLevel; production leaves it unset.
  const base = env.GHL_API_BASE || GHL_API;
  const post = (path, body) => fetcher(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(6000) });
  const unconfirmed = fail(502, `We couldn’t save your details. Please try again. ${FALLBACK}`);

  let contactId;
  try {
    const response = await post('/contacts/upsert', contact);
    const result = await response.json().catch(() => null);
    contactId = result?.contact?.id || result?.contactId;
    // Only a contact id confirms the signup reached GHL.
    if (!response.ok || typeof contactId !== 'string' || !contactId) {
      console.error(`[ebook] GHL upsert failed: ${response.status}`);
      return unconfirmed;
    }
  } catch (error) {
    console.error(`[ebook] GHL upsert failed: ${error.name}`);
    return unconfirmed;
  }
  try {
    const response = await post(`/contacts/${encodeURIComponent(contactId)}/tags`, { tags: [EBOOK_TAG] });
    if (!response.ok) {
      console.error(`[ebook] GHL tag failed: ${response.status}`);
      return unconfirmed;
    }
  } catch (error) {
    console.error(`[ebook] GHL tag failed: ${error.name}`);
    return unconfirmed;
  }
  // The contact and its tag are saved; a lost note doesn't lose the signup.
  const page = typeof data.page === 'string' && /^\/[\w\-/]*$/.test(data.page) ? data.page : '/';
  const body = [`Ebook signup: ${EBOOK_TITLE}`, `Page: ${page}`, `Date: ${now().toISOString().slice(0, 10)}`].join('\n');
  try {
    const response = await post(`/contacts/${encodeURIComponent(contactId)}/notes`, { body });
    if (!response.ok) console.error(`[ebook] GHL note failed: ${response.status}`);
  } catch (error) {
    console.error(`[ebook] GHL note failed: ${error.name}`);
  }
  return { status: 200, body: { success: true } };
}
