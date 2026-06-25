/**
 * Crée les credentials n8n directement en SQLite.
 * Lit le cipher.js compilé de n8n pour utiliser exactement le même algorithme de chiffrement.
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');

const ENCRYPTION_KEY = process.env.N8N_ENCRYPTION_KEY;
const DB_PATH        = process.env.N8N_DB_PATH || '/home/node/.n8n/.n8n/database.sqlite';

if (!ENCRYPTION_KEY) {
  console.error('[creds] N8N_ENCRYPTION_KEY manquant');
  process.exit(1);
}

const CREDENTIALS = [
  {
    id: 'AjUxu8oW8xTpjjAF',
    name: 'Postgres account',
    type: 'postgres',
    data: {
      host:     process.env.PG_HOST     || 'postgres',
      port:     parseInt(process.env.PG_PORT || '5432'),
      database: process.env.PG_DB       || 'bluesky_ai',
      user:     process.env.PG_USER     || 'bluesky',
      password: process.env.PG_PASSWORD || 'bluesky_secret',
      ssl:      'disable',
    },
  },
  {
    id: 'JMEmm98ahxB3zJ71',
    name: 'Qdrant account',
    type: 'qdrantApi',
    data: {
      qdrantUrl: process.env.QDRANT_URL     || 'http://qdrant:6333',
      apiKey:    process.env.QDRANT_API_KEY || '',
    },
  },
  {
    id: 'DSrdobixLxaxdSEf',
    name: 'OpenAi account',
    type: 'openAiApi',
    data: {
      apiKey: 'sk-noauth',
      url:    process.env.LLM_BASE_URL || 'http://llm-server:8000/v1',
    },
  },
];

// ── Découverte du cipher n8n ──
function findCipherSource() {
  try {
    const result = execSync(
      'find /usr/local/lib/node_modules/n8n -name "cipher.js" 2>/dev/null | head -3',
      { encoding: 'utf8' }
    ).trim();
    const files = result.split('\n').filter(Boolean);
    console.log('[creds] cipher.js trouvé(s):', files);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      if (src.includes('createCipheriv') || src.includes('aes-256')) return src;
    }
  } catch {}
  return null;
}

function buildEncryptFn() {
  const src = findCipherSource();

  if (src) {
    // Détecter l'encodage (hex ou base64)
    const useBase64 = src.includes("'base64'") || src.includes('"base64"');
    // Détecter l'algo de hash pour la clé
    const hashMatch = src.match(/createHash\(['"](\w+)['"]\)/);
    const hashAlgo  = hashMatch ? hashMatch[1] : 'sha256';
    console.log(`[creds] Cipher détecté — hash: ${hashAlgo}, encoding: ${useBase64 ? 'base64' : 'hex'}`);

    return function encrypt(data) {
      const key      = crypto.createHash(hashAlgo).update(ENCRYPTION_KEY).digest();
      const iv       = crypto.randomBytes(16);
      const cipher   = crypto.createCipheriv('aes-256-cbc', key, iv);
      const enc      = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
      const encoding = useBase64 ? 'base64' : 'hex';
      return JSON.stringify({ iv: iv.toString(encoding), content: enc.toString(encoding) });
    };
  }

  // Fallback : SHA256 + hex (n8n v1.x standard)
  console.log('[creds] cipher.js non trouvé — fallback SHA256+hex');
  return function encrypt(data) {
    const key    = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const iv     = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const enc    = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    return JSON.stringify({ iv: iv.toString('hex'), content: enc.toString('hex') });
  };
}

// ── SQLite loader ──
function loadSqlite3() {
  const base = '/usr/local/lib/node_modules/n8n/node_modules';
  try { return require(path.join(base, 'sqlite3')); } catch {}
  const pnpm = path.join(base, '.pnpm');
  const dir  = fs.readdirSync(pnpm).find((d) => d.startsWith('sqlite3@'));
  if (!dir) throw new Error('module sqlite3 introuvable dans n8n');
  return require(path.join(pnpm, dir, 'node_modules', 'sqlite3'));
}

const run   = (db, sql, p = []) => new Promise((res, rej) => db.run(sql, p, function(e) { e ? rej(e) : res(this); }));
const get   = (db, sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
const all   = (db, sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));
const sleep = (ms)               => new Promise((res) => setTimeout(res, ms));
const NOW   = "STRFTIME('%Y-%m-%dT%H:%M:%f','NOW')";

(async () => {
  const encrypt = buildEncryptFn();

  // Attendre que la DB existe
  for (let i = 0; i < 30; i++) {
    if (fs.existsSync(DB_PATH)) break;
    console.log(`[creds] DB introuvable, attente... (${i * 2}s)`);
    await sleep(2000);
  }
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[creds] DB introuvable après 60s : ${DB_PATH}`);
    process.exit(1);
  }

  const sqlite3 = loadSqlite3().verbose();
  const db      = new sqlite3.Database(DB_PATH);
  db.configure('busyTimeout', 30000);

  // Attendre le projet personnel
  let projectId = null;
  for (let i = 0; i < 30; i++) {
    const proj = await get(db, "SELECT id FROM project WHERE type='personal' ORDER BY createdAt LIMIT 1");
    if (proj) { projectId = proj.id; break; }
    console.log(`[creds] Projet personnel absent, attente... (${i * 3}s)`);
    await sleep(3000);
  }
  if (!projectId) {
    console.error('[creds] Projet personnel introuvable après 90s');
    db.close(); process.exit(1);
  }
  console.log(`[creds] Projet personnel : ${projectId}`);

  // Introspect shared_credentials
  const scCols   = (await all(db, 'PRAGMA table_info(shared_credentials)')).map((c) => c.name);
  const ownerCol = scCols.includes('projectId') ? 'projectId' : 'userId';
  const hasRole  = scCols.includes('role');
  console.log(`[creds] shared_credentials — ownerCol: ${ownerCol}, hasRole: ${hasRole}`);

  let ownerId = projectId;
  if (ownerCol === 'userId') {
    const user = await get(db, "SELECT id FROM \"user\" WHERE roleSlug='global:owner' LIMIT 1");
    ownerId = user?.id;
    if (!ownerId) { console.error('[creds] User owner introuvable'); db.close(); process.exit(1); }
  }

  await run(db, 'BEGIN IMMEDIATE');

  for (const cred of CREDENTIALS) {
    const existing = await get(db, 'SELECT id FROM credentials_entity WHERE id=?', [cred.id]);
    if (!existing) {
      const encData = encrypt(cred.data);
      await run(
        db,
        `INSERT INTO credentials_entity (id, name, type, data, createdAt, updatedAt) VALUES (?,?,?,?,${NOW},${NOW})`,
        [cred.id, cred.name, cred.type, encData]
      );
      console.log(`[creds] Créé : ${cred.name}`);
    } else {
      console.log(`[creds] Déjà présent : ${cred.name}`);
    }

    // Lier au projet/user
    const linked = await get(
      db,
      `SELECT credentialsId FROM shared_credentials WHERE credentialsId=? AND ${ownerCol}=?`,
      [cred.id, ownerId]
    );
    if (!linked) {
      const now = new Date().toISOString();
      if (hasRole) {
        await run(db,
          `INSERT INTO shared_credentials (credentialsId,${ownerCol},role,createdAt,updatedAt) VALUES (?,?,?,?,?)`,
          [cred.id, ownerId, 'credential:owner', now, now]);
      } else {
        await run(db,
          `INSERT INTO shared_credentials (credentialsId,${ownerCol},createdAt,updatedAt) VALUES (?,?,?,?)`,
          [cred.id, ownerId, now, now]);
      }
      console.log(`[creds] Lié au ${ownerCol} : ${cred.name}`);
    }
  }

  await run(db, 'COMMIT');
  db.close();
  console.log('[creds] Terminé.');
})().catch((e) => {
  console.error('[creds] ERREUR :', e.message);
  process.exit(1);
});
