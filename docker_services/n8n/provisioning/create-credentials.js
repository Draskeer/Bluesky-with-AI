/**
 * Crée les credentials n8n directement en SQLite avec chiffrement AES-256-CBC.
 * Même approche que seed-datatables.js — aucune dépendance à l'API REST.
 *
 * n8n chiffre les credentials avec :
 *   key = SHA256(N8N_ENCRYPTION_KEY)
 *   iv  = random 16 bytes
 *   AES-256-CBC(JSON.stringify(data), key, iv)
 *   stocké sous : JSON.stringify({ iv: hex, content: hex })
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

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

// ── Chiffrement identique à n8n Cipher.encrypt() ──
function encrypt(data) {
  const key      = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv       = crypto.randomBytes(16);
  const cipher   = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return JSON.stringify({ iv: iv.toString('hex'), content: encrypted.toString('hex') });
}

// ── SQLite loader (même technique que seed-datatables.js) ──
function loadSqlite3() {
  const base = '/usr/local/lib/node_modules/n8n/node_modules';
  try { return require(path.join(base, 'sqlite3')); } catch {}
  const pnpm = path.join(base, '.pnpm');
  const dir  = fs.readdirSync(pnpm).find((d) => d.startsWith('sqlite3@'));
  if (!dir) throw new Error('module sqlite3 introuvable dans n8n');
  return require(path.join(pnpm, dir, 'node_modules', 'sqlite3'));
}

const run = (db, sql, p = []) => new Promise((res, rej) => db.run(sql, p, function(e) { e ? rej(e) : res(this); }));
const get = (db, sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
const all = (db, sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));
const sleep = (ms)            => new Promise((res) => setTimeout(res, ms));

const NOW = "STRFTIME('%Y-%m-%dT%H:%M:%f','NOW')";

(async () => {
  // Attendre que le fichier DB existe
  for (let i = 0; i < 30; i++) {
    if (fs.existsSync(DB_PATH)) break;
    console.log(`[creds] DB introuvable, attente... (${i * 2}s)`);
    await sleep(2000);
  }
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[creds] DB introuvable apres 60s : ${DB_PATH}`);
    process.exit(1);
  }

  const sqlite3 = loadSqlite3().verbose();
  const db      = new sqlite3.Database(DB_PATH);
  db.configure('busyTimeout', 30000);

  // Attendre que le projet personnel existe (n8n l'initialise au démarrage)
  let projectId = null;
  for (let i = 0; i < 30; i++) {
    const proj = await get(db, "SELECT id FROM project WHERE type='personal' ORDER BY createdAt LIMIT 1");
    if (proj) { projectId = proj.id; break; }
    console.log(`[creds] Projet personnel absent, attente... (${i * 3}s)`);
    await sleep(3000);
  }
  if (!projectId) {
    console.error('[creds] Projet personnel introuvable apres 90s — n8n ne s est pas initialise correctement');
    db.close();
    process.exit(1);
  }
  console.log(`[creds] Projet personnel : ${projectId}`);

  // Introspect shared_credentials pour savoir si projectId ou userId
  const scCols   = (await all(db, 'PRAGMA table_info(shared_credentials)')).map((c) => c.name);
  const ownerCol = scCols.includes('projectId') ? 'projectId' : 'userId';
  const hasRole  = scCols.includes('role');
  console.log(`[creds] shared_credentials.ownerCol = ${ownerCol}, hasRole = ${hasRole}`);

  // Si userId, récupérer l'ID du owner
  let ownerId = projectId;
  if (ownerCol === 'userId') {
    const user = await get(db, "SELECT id FROM \"user\" WHERE roleSlug='global:owner' LIMIT 1");
    ownerId = user?.id;
    if (!ownerId) {
      console.error('[creds] User owner introuvable');
      db.close();
      process.exit(1);
    }
    console.log(`[creds] User owner : ${ownerId}`);
  }

  await run(db, 'BEGIN IMMEDIATE');

  for (const cred of CREDENTIALS) {
    const existing = await get(db, 'SELECT id FROM credentials_entity WHERE id=?', [cred.id]);
    if (existing) {
      console.log(`[creds] Deja present : ${cred.name} (${cred.id})`);
    } else {
      const encData = encrypt(cred.data);
      await run(
        db,
        `INSERT INTO credentials_entity (id, name, type, data, createdAt, updatedAt) VALUES (?,?,?,?,${NOW},${NOW})`,
        [cred.id, cred.name, cred.type, encData]
      );
      console.log(`[creds] Cree : ${cred.name} (${cred.id})`);
    }

    // Lier au projet/user si pas déjà fait
    const sharedCheck = await get(
      db,
      `SELECT credentialsId FROM shared_credentials WHERE credentialsId=? AND ${ownerCol}=?`,
      [cred.id, ownerId]
    );
    if (!sharedCheck) {
      const now = new Date().toISOString();
      if (hasRole) {
        await run(
          db,
          `INSERT INTO shared_credentials (credentialsId, ${ownerCol}, role, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
          [cred.id, ownerId, 'credential:owner', now, now]
        );
      } else {
        await run(
          db,
          `INSERT INTO shared_credentials (credentialsId, ${ownerCol}, createdAt, updatedAt) VALUES (?,?,?,?)`,
          [cred.id, ownerId, now, now]
        );
      }
      console.log(`[creds] Lie au ${ownerCol} : ${cred.name}`);
    }
  }

  await run(db, 'COMMIT');
  db.close();
  console.log('[creds] Termine.');
})().catch((e) => {
  console.error('[creds] ERREUR :', e.message);
  process.exit(1);
});
