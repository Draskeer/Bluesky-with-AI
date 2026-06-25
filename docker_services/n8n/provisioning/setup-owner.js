const bcryptjs   = require('/usr/local/lib/node_modules/n8n/node_modules/.pnpm/bcryptjs@2.4.3/node_modules/bcryptjs');
const sqlite3mod = require('/usr/local/lib/node_modules/n8n/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3');

const email     = process.env.N8N_OWNER_EMAIL     || 'admin@example.com';
const password  = process.env.N8N_OWNER_PASSWORD  || 'Admin123!';
const firstName = process.env.N8N_OWNER_FIRSTNAME || 'Admin';
const lastName  = process.env.N8N_OWNER_LASTNAME  || 'User';
const dbPath    = '/home/node/.n8n/.n8n/database.sqlite';

const hash = bcryptjs.hashSync(password, 10);
const db = new sqlite3mod.Database(dbPath);

db.serialize(() => {
  db.run('BEGIN IMMEDIATE', err => { if (err) { console.error('[owner] BEGIN:', err.message); process.exit(1); } });

  db.run(
    'UPDATE "user" SET email=?, password=?, firstName=?, lastName=? WHERE roleSlug=?',
    [email, hash, firstName, lastName, 'global:owner'],
    function(err) {
      if (err) console.error('[owner] UPDATE user:', err.message);
      else console.log('[owner] user mis a jour (' + this.changes + ' ligne) : ' + email);
    }
  );

  db.run(
    "UPDATE settings SET value='true' WHERE key='userManagement.isInstanceOwnerSetUp'",
    function(err) {
      if (err) console.error('[owner] UPDATE settings:', err.message);
      else console.log('[owner] isInstanceOwnerSetUp -> true (' + this.changes + ' ligne)');
    }
  );

  db.run('COMMIT', err => {
    if (err) console.error('[owner] COMMIT:', err.message);
    else console.log('[owner] Setup termine pour : ' + email);
    db.close();
  });
});