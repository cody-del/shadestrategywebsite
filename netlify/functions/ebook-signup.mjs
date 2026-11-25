import { createEbookHandler } from '../lib/ebook-http.mjs';

export default createEbookHandler();
// Netlify counts these requests itself, across every copy of the function, and answers a visitor over the
// limit with a 429. The in-memory limit in ebook-http.mjs stays as a second, longer window.
export const config = { path: '/api/ebook-signup', rateLimit: { windowLimit: 10, windowSize: 180, aggregateBy: ['ip', 'domain'] } };
