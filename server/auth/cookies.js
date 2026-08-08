// Minimal cookie handling. No cookie-parser dependency — the same reasoning as
// the hand-rolled JWT in services/gscClient.js.

const COOKIE_NAME = 'fs_seo_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    // Split on the FIRST '=' only — cookie values may legitimately contain '='.
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (!key) continue;
    const raw = part.slice(i + 1).trim();
    try {
      out[key] = decodeURIComponent(raw);
    } catch (e) {
      out[key] = raw;
    }
  }
  return out;
}

function readSessionId(req) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME] || null;
}

// Path=/ must be explicit: without it the cookie defaults to the directory of
// the request that set it, so a cookie set from /api/auth/login would only ever
// be sent back to /api/auth/*. Domain is deliberately never set (host-only is
// stricter). Secure only in production, or the cookie is dropped outright on
// http://localhost:3005 during development.
function cookieAttributes() {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  return attrs;
}

function setSessionCookie(res, sessionId) {
  const attrs = cookieAttributes();
  attrs.push(`Max-Age=${Math.floor(SESSION_MS / 1000)}`);
  res.append('Set-Cookie', `${COOKIE_NAME}=${sessionId}; ${attrs.join('; ')}`);
}

// Must clear with identical attributes or some browsers keep the cookie.
function clearSessionCookie(res) {
  const attrs = cookieAttributes();
  attrs.push('Max-Age=0');
  res.append('Set-Cookie', `${COOKIE_NAME}=; ${attrs.join('; ')}`);
}

module.exports = { COOKIE_NAME, SESSION_MS, parseCookies, readSessionId, setSessionCookie, clearSessionCookie };
