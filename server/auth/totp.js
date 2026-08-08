// Thin wrapper around otplib v13.
//
// v13 is a full rewrite of the library: there is no `authenticator` export any
// more, verify() returns an object (never a boolean), and the tolerance option
// is `epochTolerance` in SECONDS rather than `window` in steps. verifySync()
// works with the default Noble crypto plugin, which keeps this in the same
// synchronous style as better-sqlite3 everywhere else in server/.

const { generateSecret, generateURI, verifySync } = require('otplib');
const QRCode = require('qrcode');

const ISSUER = process.env.FS_SEO_TOTP_ISSUER || 'FS SEO Prof.';

function newSecret() {
  return generateSecret(); // 20 random bytes -> 32-char Base32, CSPRNG
}

function buildUri(email, secret) {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

async function enrollmentPayload(email, secret) {
  const uri = buildUri(email, secret);
  return {
    uri,
    secret,
    qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 240 })
  };
}

/**
 * Verify a 6-digit code.
 * Returns the matched timeStep (a number) on success, or null on any failure.
 * Never returns a boolean — VerifyResult is an object and would always be truthy.
 */
function verifyTotp({ secret, token, afterTimeStep }) {
  const code = String(token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return null;
  if (!secret) return null;

  const opts = {
    secret,
    token: code,
    // +/- 30 seconds, i.e. at most one adjacent step either way. The default of
    // 0 rejects a code the user started typing just before the period rolled.
    epochTolerance: [30, 30]
  };
  if (Number.isInteger(afterTimeStep) && afterTimeStep >= 0) {
    opts.afterTimeStep = afterTimeStep;
  }

  let result;
  try {
    result = verifySync(opts);
  } catch (err) {
    // otplib throws rather than returning {valid:false} when afterTimeStep is
    // ahead of the current step (clock rollback, NTP jump, restored .db) and on
    // a malformed secret. Unguarded that is a 500 on every login and a
    // permanent lockout. Treat it as a failed attempt.
    console.error('[auth] TOTP verificatie faalde:', err.message);
    return null;
  }
  return result.valid ? result.timeStep : null;
}

module.exports = { newSecret, buildUri, enrollmentPayload, verifyTotp, ISSUER };
