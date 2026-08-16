#!/usr/bin/env node
//
// Haal een OAuth refresh token op voor Google Bedrijfsprofiel of Google Ads.
//
//   node server/oauth-setup.js gbp
//   node server/oauth-setup.js ads
//
// Beide API's werken met gebruikerseigen data en accepteren daarom geen service
// account: Google's documentatie schrijft een OAuth 2.0 client ID voor. Dit
// scriptje doet de toestemmingsflow eenmalig en slaat de refresh token op in de
// settings-tabel, zodat de server hem daarna zelf kan verversen.
//
// Vooraf nodig: een OAuth client ID van het type "Desktop app" in de Google
// Cloud Console (APIs & Services -> Credentials), met client ID en secret
// ingevuld bij Instellingen of in .env.local.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const readline = require('readline');
const axios = require('axios');
const db = require('./db');
const { PRODUCTS, getCredentials } = require('./services/googleOAuth');

// Desktop-clients gebruiken een loopback-redirect; die hoeft niet te draaien,
// we plakken de code handmatig over.
const REDIRECT_URI = 'http://localhost';

const product = process.argv[2];

if (!product || !PRODUCTS[product]) {
  console.error(`Gebruik: node server/oauth-setup.js <${Object.keys(PRODUCTS).join('|')}>`);
  console.error('');
  console.error('  gbp   Google Bedrijfsprofiel (locaties en statistieken)');
  console.error('  ads   Google Ads (campagnecijfers)');
  process.exit(1);
}

const config = PRODUCTS[product];
const creds = getCredentials(product);

if (!creds.clientId || !creds.clientSecret) {
  console.error(`Er is nog geen OAuth client ingesteld voor ${config.label}.`);
  console.error('');
  console.error('1. Ga naar https://console.cloud.google.com/apis/credentials');
  console.error('2. Create credentials -> OAuth client ID -> type "Desktop app"');
  console.error('3. Vul client ID en secret in bij Instellingen in de app,');
  console.error('   of zet GOOGLE_OAUTH_CLIENT_ID en GOOGLE_OAUTH_CLIENT_SECRET in .env.local');
  process.exit(1);
}

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: creds.clientId,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: config.scope,
  access_type: 'offline',
  // Zonder prompt=consent geeft Google bij een tweede autorisatie géén nieuwe
  // refresh token terug, en dan lijkt het script te werken maar sla je niets op.
  prompt: 'consent'
}).toString();

console.log('');
console.log(`Toestemming vragen voor: ${config.label}`);
console.log(`Scope: ${config.scope}`);
console.log('');
console.log('1. Open deze URL in je browser:');
console.log('');
console.log(`   ${authUrl}`);
console.log('');
console.log('2. Log in met het account dat toegang heeft tot ' + config.label + '.');
console.log('3. Je browser springt daarna naar een localhost-adres dat niet laadt.');
console.log('   Dat is normaal — kopieer de waarde van "code=" uit de adresbalk.');
console.log('');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Plak de code hier: ', async (rawCode) => {
  rl.close();

  const code = decodeURIComponent(String(rawCode).trim());
  if (!code) {
    console.error('Geen code ingevoerd.');
    process.exit(1);
  }

  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    });

    const refreshToken = response.data.refresh_token;
    if (!refreshToken) {
      console.error('');
      console.error('Google gaf geen refresh token terug. Dat gebeurt als je deze app');
      console.error('al eerder hebt geautoriseerd. Trek de toegang in via');
      console.error('https://myaccount.google.com/permissions en probeer het opnieuw.');
      process.exit(1);
    }

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(config.refreshTokenKey, refreshToken);

    console.log('');
    console.log(`Gelukt. De refresh token voor ${config.label} is opgeslagen als "${config.refreshTokenKey}".`);
    console.log('Herstart de server om de koppeling te activeren.');
  } catch (err) {
    const detail = err.response?.data?.error_description || err.response?.data?.error || err.message;
    console.error('');
    console.error(`Uitwisselen van de code mislukte: ${detail}`);
    if (/redirect_uri_mismatch/i.test(String(detail))) {
      console.error(`Controleer of de OAuth client van het type "Desktop app" is; dit script gebruikt ${REDIRECT_URI} als redirect.`);
    }
    process.exit(1);
  }
});
