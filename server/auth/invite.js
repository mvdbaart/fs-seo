#!/usr/bin/env node
//
// Create (or reset) an account from the command line and print its enroll link.
//
//   node server/auth/invite.js jan@frissestart.nl "Jan" admin
//
// This is how the FIRST admin is created. It is deliberately not an HTTP route:
// a "allowed while the users table is empty" endpoint is a land-grab race —
// between the server going live on a public domain and you finishing your
// enrollment, anyone could claim an admin account, and that window reopens
// whenever the last user is removed. A CLI has no attack surface at all.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const auth = require('./service');

const [email, name = '', role = 'member'] = process.argv.slice(2);

if (!email) {
  console.error('Gebruik: node server/auth/invite.js <email> [naam] [admin|member]');
  process.exit(1);
}

try {
  const existing = auth.getUserByEmail(email);
  const { user, token, expiresAt } = auth.createOrResetInvite({ email, name, role });

  const base = process.env.FS_SEO_BASE_URL || 'http://localhost:3005';
  const hours = Math.round((expiresAt - Date.now()) / 3600000);

  console.log('');
  console.log(existing ? `Account gereset: ${user.email} (${user.role})` : `Account aangemaakt: ${user.email} (${user.role})`);
  if (existing) console.log('De oude authenticator en herstelcodes werken niet meer.');
  console.log('');
  console.log(`Aanmeldlink (${hours} uur geldig):`);
  console.log(`${base}/?enroll=${token}`);
  console.log('');
} catch (err) {
  console.error('Mislukt:', err.message);
  process.exit(1);
}
