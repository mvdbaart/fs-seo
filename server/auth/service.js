const crypto = require('crypto');
const db = require('../db');
const { newSecret, enrollmentPayload, verifyTotp } = require('./totp');
const { SESSION_MS } = require('./cookies');

const ENROLL_MS = 48 * 60 * 60 * 1000;
const SLIDE_AFTER_MS = 24 * 60 * 60 * 1000;

// Throttling. The per-email threshold is the real defence; the per-IP one is a
// deliberately loose backstop, because behind a reverse proxy the whole team
// shares a single req.ip and a tight limit would let one colleague's typo lock
// everyone out.
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_PER_EMAIL = 5;
const MAX_FAILED_PER_IP = 30;
const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
const RECOVERY_COUNT = 10;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    role: row.role,
    disabled: !!row.disabled,
    enrolled: !!row.totp_confirmed_at,
    createdAt: row.created_at
  };
}

// ----------------------------------------------------
// Users
// ----------------------------------------------------

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at ASC').all().map(publicUser);
}

function countAdmins() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0").get().n;
}

function countUsers() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

/**
 * Create a user, or reset an existing one back to "needs to enrol".
 * The ON CONFLICT branch is also the "TOTP resetten" path: it wipes the old
 * secret so a lost authenticator cannot keep working.
 */
function createOrResetInvite({ email, name = '', role = 'member' }) {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes('@')) {
    throw new Error('Ongeldig e-mailadres');
  }
  if (role !== 'admin' && role !== 'member') {
    throw new Error("Rol moet 'admin' of 'member' zijn");
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expires = now + ENROLL_MS;

  const run = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (email, name, role, enroll_token, enroll_expires_at, disabled, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        enroll_token = excluded.enroll_token,
        enroll_expires_at = excluded.enroll_expires_at,
        totp_secret = NULL,
        totp_confirmed_at = NULL,
        last_totp_step = NULL
    `).run(normalized, name, role, token, expires, now);

    const user = getUserByEmail(normalized);
    // A reset invalidates everything the old device could still do.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(user.id);
    return user;
  });

  const user = run();
  return { user: publicUser(user), token, expiresAt: expires };
}

function deleteUser(id) {
  const run = db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  run();
}

function setDisabled(id, disabled) {
  db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id);
  if (disabled) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
}

// ----------------------------------------------------
// Enrollment
// ----------------------------------------------------

function getUserByEnrollToken(token) {
  if (!token) return null;
  const user = db.prepare('SELECT * FROM users WHERE enroll_token = ?').get(String(token));
  if (!user) return null;
  if (!user.enroll_expires_at || user.enroll_expires_at < Date.now()) return null;
  return user;
}

/**
 * Generate the secret on first view and persist it, so refreshing the page
 * mid-scan shows the same QR. totp_confirmed_at stays null until the user
 * proves they can produce a code.
 */
async function startEnrollment(token) {
  const user = getUserByEnrollToken(token);
  if (!user) return null;

  let secret = user.totp_secret;
  if (!secret) {
    secret = newSecret();
    db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, user.id);
  }

  const payload = await enrollmentPayload(user.email, secret);
  return { email: user.email, name: user.name || '', ...payload };
}

function confirmEnrollment(token, code) {
  const user = getUserByEnrollToken(token);
  if (!user || !user.totp_secret) return null;

  const step = verifyTotp({ secret: user.totp_secret, token: code });
  if (step === null) return null;

  const recoveryCodes = buildRecoveryCodes();
  const now = Date.now();

  const run = db.transaction(() => {
    db.prepare(`
      UPDATE users
      SET totp_confirmed_at = ?, last_totp_step = ?, enroll_token = NULL, enroll_expires_at = NULL
      WHERE id = ?
    `).run(now, step, user.id);

    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(user.id);
    const insert = db.prepare('INSERT INTO recovery_codes (user_id, code_hash, created_at) VALUES (?, ?, ?)');
    for (const plain of recoveryCodes) insert.run(user.id, hashRecoveryCode(plain), now);
  });
  run();

  return { user: getUserById(user.id), recoveryCodes };
}

// ----------------------------------------------------
// Recovery codes
// ----------------------------------------------------

function buildRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < RECOVERY_COUNT; i++) {
    const bytes = crypto.randomBytes(12);
    let out = '';
    for (let j = 0; j < 12; j++) {
      if (j > 0 && j % 4 === 0) out += '-';
      out += RECOVERY_ALPHABET[bytes[j] % RECOVERY_ALPHABET.length];
    }
    codes.push(out);
  }
  return codes;
}

// sha256 is right here: the input is 60 bits of CSPRNG, so a slow KDF buys
// nothing, and bcrypt is not a dependency of this project.
function hashRecoveryCode(code) {
  const normalized = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * A successful recovery wipes the TOTP secret and issues a fresh enroll token
 * rather than logging the user straight in: if you needed a recovery code you
 * lost your authenticator, so you have to re-enrol anyway.
 */
function consumeRecoveryCode(email, code) {
  const user = getUserByEmail(email);
  if (!user || user.disabled || !user.totp_confirmed_at) return null;

  const hash = hashRecoveryCode(code);
  const row = db.prepare(
    'SELECT * FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL'
  ).get(user.id, hash);
  if (!row) return null;

  const now = Date.now();
  const token = crypto.randomBytes(32).toString('hex');

  const run = db.transaction(() => {
    db.prepare('UPDATE recovery_codes SET used_at = ? WHERE id = ?').run(now, row.id);
    db.prepare(`
      UPDATE users
      SET totp_secret = NULL, totp_confirmed_at = NULL, last_totp_step = NULL,
          enroll_token = ?, enroll_expires_at = ?
      WHERE id = ?
    `).run(token, now + ENROLL_MS, user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  });
  run();

  return { token };
}

// ----------------------------------------------------
// Login + sessions
// ----------------------------------------------------

function verifyLogin(email, code) {
  const user = getUserByEmail(email);
  if (!user || user.disabled || !user.totp_confirmed_at || !user.totp_secret) return null;

  const step = verifyTotp({
    secret: user.totp_secret,
    token: code,
    afterTimeStep: Number.isInteger(user.last_totp_step) ? user.last_totp_step : undefined
  });
  if (step === null) return null;

  db.prepare('UPDATE users SET last_totp_step = ? WHERE id = ?').run(step, user.id);
  return user;
}

function createSession(userId, req) {
  const id = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare(`
    INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, now, now + SESSION_MS, String(req.get('user-agent') || '').slice(0, 300), req.ip || '');
  return id;
}

/**
 * Resolve a session to a user. Joins users on every request so a disabled
 * account stops working immediately instead of surviving for the session's
 * remaining 30 days, and so role changes take effect at once.
 */
function getSessionUser(sessionId) {
  if (!sessionId) return null;
  const row = db.prepare(`
    SELECT s.id AS session_id, s.expires_at, u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(sessionId);

  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return null;
  }
  if (row.disabled) return null;

  // Slide lazily. Writing on every request would mean dozens of SQLite writes
  // per page view given how many fetch calls the frontend makes.
  if (row.expires_at - Date.now() < SESSION_MS - SLIDE_AFTER_MS) {
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(Date.now() + SESSION_MS, sessionId);
  }
  return row;
}

function destroySession(sessionId) {
  if (sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

// ----------------------------------------------------
// Throttling
// ----------------------------------------------------

function recordAttempt(email, ip, success) {
  db.prepare('INSERT INTO login_attempts (email, ip, success, created_at) VALUES (?, ?, ?, ?)')
    .run(normalizeEmail(email), ip || '', success ? 1 : 0, Date.now());
  // Cheap synchronous sweep; avoids needing a cron.
  db.prepare('DELETE FROM login_attempts WHERE created_at < ?').run(Date.now() - ATTEMPT_RETENTION_MS);
}

function clearAttempts(email) {
  db.prepare('DELETE FROM login_attempts WHERE email = ? AND success = 0').run(normalizeEmail(email));
}

function throttleStatus(email, ip) {
  const since = Date.now() - THROTTLE_WINDOW_MS;
  const byEmail = db.prepare(
    'SELECT COUNT(*) AS n FROM login_attempts WHERE success = 0 AND email = ? AND created_at > ?'
  ).get(normalizeEmail(email), since).n;
  const byIp = db.prepare(
    'SELECT COUNT(*) AS n FROM login_attempts WHERE success = 0 AND ip = ? AND created_at > ?'
  ).get(ip || '', since).n;

  if (byEmail >= MAX_FAILED_PER_EMAIL || byIp >= MAX_FAILED_PER_IP) {
    return { blocked: true, retryAfterSec: Math.ceil(THROTTLE_WINDOW_MS / 1000) };
  }
  return { blocked: false, retryAfterSec: 0 };
}

module.exports = {
  ENROLL_MS,
  normalizeEmail,
  publicUser,
  getUserByEmail,
  getUserById,
  listUsers,
  countAdmins,
  countUsers,
  createOrResetInvite,
  deleteUser,
  setDisabled,
  getUserByEnrollToken,
  startEnrollment,
  confirmEnrollment,
  consumeRecoveryCode,
  verifyLogin,
  createSession,
  getSessionUser,
  destroySession,
  recordAttempt,
  clearAttempts,
  throttleStatus
};
