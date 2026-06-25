/**
 * Crée automatiquement les Data Tables n8n utilisées pour le logging du workflow,
 * avec des IDs FIXES qui correspondent à ceux référencés dans le workflow.
 *
 * n8n n'expose ni CLI ni API simple pour créer des data tables avec un ID imposé,
 * donc on insère directement dans la base SQLite de n8n (idempotent).
 *
 * Schéma n8n (vérifié) :
 *   data_table(id, name, projectId, createdAt, updatedAt)
 *   data_table_column(id, name, type, "index", dataTableId, createdAt, updatedAt)
 *   data_table_user_<id>(id INTEGER PK, createdAt, updatedAt, <colonnes...>)
 * Mapping type -> SQL : string=TEXT, number=REAL, boolean=BOOLEAN, date=DATETIME.
 */

const fs = require('fs');
const path = require('path');

function loadSqlite3() {
  const base = '/usr/local/lib/node_modules/n8n/node_modules';
  try { return require(path.join(base, 'sqlite3')); } catch (e) { /* fallback pnpm */ }
  const pnpm = path.join(base, '.pnpm');
  const dir = fs.readdirSync(pnpm).find((d) => d.startsWith('sqlite3@'));
  if (!dir) throw new Error('module sqlite3 introuvable dans n8n');
  return require(path.join(pnpm, dir, 'node_modules', 'sqlite3'));
}

const DB_PATH = process.env.N8N_DB_PATH || '/home/node/.n8n/.n8n/database.sqlite';

// IDs FIXES — doivent matcher les nodes Data Table du workflow
const TABLES = [
  { id: 'rqrEG335i7KYQrnO', name: 'Executions Infos', columns: ['status', 'message', 'user'] },
  { id: 'NatEuXcPKILe0pnO', name: 'Errors', columns: ['Step', 'Error', 'Last_Output'] },
];

const sqlite3 = loadSqlite3().verbose();

if (!fs.existsSync(DB_PATH)) {
  console.error(`[seed] base n8n introuvable: ${DB_PATH}`);
  process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);
db.configure('busyTimeout', 15000);

const run = (sql, params = []) => new Promise((res, rej) => db.run(sql, params, function (e) { e ? rej(e) : res(this); }));
const get = (sql, params = []) => new Promise((res, rej) => db.get(sql, params, (e, r) => (e ? rej(e) : res(r))));
const NOW = "STRFTIME('%Y-%m-%d %H:%M:%f','NOW')";

(async () => {
  const proj = await get("SELECT id FROM project WHERE type='personal' ORDER BY createdAt LIMIT 1");
  if (!proj) {
    console.log('[seed] Aucun projet personnel trouvé (owner n8n pas encore configuré). '
      + 'Termine la configuration du compte dans l\'UI puis relance le provisioning. Skip.');
    db.close();
    return;
  }
  const projectId = proj.id;

  for (const t of TABLES) {
    await run(
      `INSERT OR IGNORE INTO data_table (id,name,projectId,createdAt,updatedAt) VALUES (?,?,?,${NOW},${NOW})`,
      [t.id, t.name, projectId],
    );

    let colDefs = '';
    for (let i = 0; i < t.columns.length; i++) {
      const c = t.columns[i];
      await run(
        `INSERT OR IGNORE INTO data_table_column (id,name,type,"index",dataTableId,createdAt,updatedAt) VALUES (?,?,?,?,?,${NOW},${NOW})`,
        [(t.id + '_' + c).slice(0, 36), c, 'string', i, t.id],
      );
      colDefs += `, "${c}" TEXT`;
    }

    await run(
      `CREATE TABLE IF NOT EXISTS "data_table_user_${t.id}" (`
      + `"id" integer PRIMARY KEY NOT NULL, `
      + `"createdAt" datetime(3) NOT NULL DEFAULT (${NOW}), `
      + `"updatedAt" datetime(3) NOT NULL DEFAULT (${NOW})${colDefs})`,
    );

    console.log(`[seed] data table OK: ${t.name} (${t.id}) -> [${t.columns.join(', ')}]`);
  }

  db.close();
  console.log('[seed] terminé.');
})().catch((e) => {
  console.error('[seed] ERREUR:', e.message);
  db.close();
  process.exit(1);
});
