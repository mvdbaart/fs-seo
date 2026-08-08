const express = require('express');
const { readSessionId, setSessionCookie, clearSessionCookie } = require('./cookies');
const { requireAuth, requireAdmin } = require('./middleware');
const auth = require('./service');

const router = express.Router();

// Same body for unknown e-mail, disabled account and wrong code, so the
// endpoint cannot be used to find out which addresses exist.
const GENERIC_LOGIN_ERROR = 'E-mailadres of code is onjuist';

// ----------------------------------------------------
// Session
// ----------------------------------------------------

// Always 200 — this is the frontend's "am I logged in?" probe, so it must not
// look like an expired session. Deliberately does not set X-Auth-Required.
router.get('/me', (req, res) => {
  const row = auth.getSessionUser(readSessionId(req));
  res.json({ user: row ? auth.publicUser(row) : null });
});

router.post('/login', (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'E-mailadres en code zijn verplicht' });
    }

    const throttle = auth.throttleStatus(email, req.ip);
    if (throttle.blocked) {
      res.set('Retry-After', String(throttle.retryAfterSec));
      return res.status(429).json({ error: 'Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw.' });
    }

    const user = auth.verifyLogin(email, code);
    if (!user) {
      auth.recordAttempt(email, req.ip, false);
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    auth.recordAttempt(email, req.ip, true);
    auth.clearAttempts(email);
    const sessionId = auth.createSession(user.id, req);
    setSessionCookie(res, sessionId);
    res.json({ user: auth.publicUser(user) });
  } catch (err) {
    console.error('[auth] login mislukt:', err);
    res.status(500).json({ error: 'Inloggen mislukt: ' + err.message });
  }
});

router.post('/logout', (req, res) => {
  auth.destroySession(readSessionId(req));
  clearSessionCookie(res);
  res.json({ success: true });
});

// ----------------------------------------------------
// Enrollment (public — the token is the credential)
// ----------------------------------------------------

router.get('/enroll/:token', async (req, res) => {
  try {
    const payload = await auth.startEnrollment(req.params.token);
    if (!payload) {
      return res.status(404).json({ error: 'Deze uitnodigingslink is ongeldig of verlopen' });
    }
    res.json(payload);
  } catch (err) {
    console.error('[auth] enrollment starten mislukt:', err);
    res.status(500).json({ error: 'Aanmelden mislukt: ' + err.message });
  }
});

router.post('/enroll/:token', (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Code is verplicht' });

    const throttle = auth.throttleStatus(`enroll:${req.params.token}`, req.ip);
    if (throttle.blocked) {
      res.set('Retry-After', String(throttle.retryAfterSec));
      return res.status(429).json({ error: 'Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw.' });
    }

    const result = auth.confirmEnrollment(req.params.token, code);
    if (!result) {
      auth.recordAttempt(`enroll:${req.params.token}`, req.ip, false);
      return res.status(400).json({ error: 'De code klopt niet. Controleer of de tijd op je telefoon goed staat.' });
    }

    auth.clearAttempts(`enroll:${req.params.token}`);
    const sessionId = auth.createSession(result.user.id, req);
    setSessionCookie(res, sessionId);
    res.json({ user: auth.publicUser(result.user), recoveryCodes: result.recoveryCodes });
  } catch (err) {
    console.error('[auth] enrollment bevestigen mislukt:', err);
    res.status(500).json({ error: 'Aanmelden mislukt: ' + err.message });
  }
});

// Recovery hands back a fresh enroll token rather than a session: needing a
// recovery code means the authenticator is gone, so re-enrolling is the point.
router.post('/recover', (req, res) => {
  try {
    const { email, recoveryCode } = req.body || {};
    if (!email || !recoveryCode) {
      return res.status(400).json({ error: 'E-mailadres en herstelcode zijn verplicht' });
    }

    const throttle = auth.throttleStatus(email, req.ip);
    if (throttle.blocked) {
      res.set('Retry-After', String(throttle.retryAfterSec));
      return res.status(429).json({ error: 'Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw.' });
    }

    const result = auth.consumeRecoveryCode(email, recoveryCode);
    if (!result) {
      auth.recordAttempt(email, req.ip, false);
      return res.status(401).json({ error: 'E-mailadres of herstelcode is onjuist' });
    }

    auth.clearAttempts(email);
    res.json({ token: result.token });
  } catch (err) {
    console.error('[auth] herstel mislukt:', err);
    res.status(500).json({ error: 'Herstellen mislukt: ' + err.message });
  }
});

// ----------------------------------------------------
// User management (admin only)
//
// This router is mounted before the global /api gate, so these routes apply
// requireAuth + requireAdmin themselves.
// ----------------------------------------------------

router.get('/users', requireAuth, requireAdmin, (req, res) => {
  res.json(auth.listUsers());
});

router.post('/users', requireAuth, requireAdmin, (req, res) => {
  try {
    const { email, name, role } = req.body || {};
    const result = auth.createOrResetInvite({ email, name: name || '', role: role || 'member' });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/users/:id/reset-totp', requireAuth, requireAdmin, (req, res) => {
  try {
    const target = auth.getUserById(parseInt(req.params.id, 10));
    if (!target) return res.status(404).json({ error: 'Gebruiker niet gevonden' });

    const result = auth.createOrResetInvite({
      email: target.email,
      name: target.name || '',
      role: target.role
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/users/:id/disabled', requireAuth, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const disabled = !!(req.body || {}).disabled;
    const target = auth.getUserById(id);
    if (!target) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    if (disabled && id === req.user.id) {
      return res.status(400).json({ error: 'Je kunt jezelf niet blokkeren' });
    }
    if (disabled && target.role === 'admin' && auth.countAdmins() <= 1) {
      return res.status(400).json({ error: 'De laatste beheerder kan niet geblokkeerd worden' });
    }
    auth.setDisabled(id, disabled);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const target = auth.getUserById(id);
    if (!target) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Je kunt je eigen account niet verwijderen' });
    }
    if (target.role === 'admin' && !target.disabled && auth.countAdmins() <= 1) {
      return res.status(400).json({ error: 'De laatste beheerder kan niet verwijderd worden' });
    }
    auth.deleteUser(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
