const axios = require('axios');
const db = require('../server/db');

async function test() {
  const keyRow = db.prepare("SELECT value FROM settings WHERE key = 'serp_api_key'").get();
  const key = process.env.FS_SERPER_API || (keyRow ? keyRow.value : '');

  try {
    const res = await axios.post('https://google.serper.dev/places', {
      q: 'FrisseStart Nuenen',
      gl: 'nl',
      hl: 'nl'
    }, {
      headers: { 'X-API-KEY': key }
    });
    console.log('\n=== Serper /places API Result for FrisseStart Nuenen ===');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error(e.message);
  }
}

test();
