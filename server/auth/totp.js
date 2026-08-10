// Thin wrapper around otplib v13.
//
// v13 is a full rewrite of the library: there is no `authenticator` export any
// more, verify() returns an object (never a boolean), and the tolerance option
// is `epochTolerance` in SECONDS rather than `window` in steps. verifySync()
// works with the default Noble crypto plugin, which keeps this in the same
// synchronous style as better-sqlite3 everywhere else in server/.

const QRCode = require('qrcode');

const ISSUER = process.env.FS_SEO_TOTP_ISSUER || 'FS SEO Prof.';

let otplibPromise = null;
function getOtplib() {
  if (!otplibPromise) {
    otplibPromise = import('otplib');
  }
  return otplibPromise;
}

async function newSecret() {
  const otplib = await getOtplib();
  return otplib.generateSecret();
}

async function buildUri(email, secret) {
  const otplib = await getOtplib();
  return otplib.generateURI({ issuer: ISSUER, label: email, secret });
}

async function enrollmentPayload(email, secret) {
  const uri = await buildUri(email, secret);
  return {
    uri,
    secret,
    qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 240 })
  };
}

/**
 * Verify a 6-digit code.
 * Returns the matched timeStep (a number) on success, or null on any failure.
 */
async function verifyTotp({ secret, token, afterTimeStep }) {
  const code = String(token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return null;
  if (!secret) return null;

  const opts = {
    secret,
    token: code,
    epochTolerance: [60, 60]
  };
  if (Number.isInteger(afterTimeStep) && afterTimeStep >= 0) {
    opts.afterTimeStep = afterTimeStep;
  }

  let result;
  try {
    const otplib = await getOtplib();
    result = otplib.verifySync(opts);
  } catch (err) {
    console.error('[auth] TOTP verificatie faalde:', err.message);
    return null;
  }
  return result.valid ? result.timeStep : null;
}

module.exports = { newSecret, buildUri, enrollmentPayload, verifyTotp, ISSUER };
