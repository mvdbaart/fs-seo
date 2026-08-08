const { readSessionId } = require('./cookies');
const { getSessionUser, publicUser } = require('./service');

// X-Auth-Required marks "your session is gone", as opposed to the 401 that a
// wrong TOTP code on the login form produces. The frontend keys its
// redirect-to-login on this header rather than on the status code, so a typo
// during login does not wipe the half-filled form.
function unauthorized(res) {
  res.set('X-Auth-Required', '1');
  return res.status(401).json({ error: 'Niet ingelogd' });
}

function requireAuth(req, res, next) {
  const sessionId = readSessionId(req);
  const row = getSessionUser(sessionId);
  if (!row) return unauthorized(res);

  req.sessionId = sessionId;
  req.user = publicUser(row);
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return unauthorized(res);
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Alleen beheerders mogen dit' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, unauthorized };
