const path = require('path');
const db = require(path.join(__dirname, '../server/db'));

db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('business_name', 'FrisseStart Flex & Opleiden BV')").run();
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('business_address', 'De Tienden 26B, 5674 TB Nuenen')").run();
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('business_phone', '+31408459091')").run();

console.log('✅ NAP Bedrijfsgegevens succesvol opgeslagen in SQLite database!');
