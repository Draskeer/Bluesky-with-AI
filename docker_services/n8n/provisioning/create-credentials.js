/**
 * Crée les credentials n8n via l'API REST.
 * Compatible n8n v1.x (JWT dans le body) et anciennes versions (cookie).
 * Requiert le cookie browserId pour la protection CSRF de n8n v1.x.
 */
const http = require('http');
const fs   = require('fs');
const { randomUUID } = require('crypto');

const N8N_HOST    = 'n8n';
const N8N_PORT    = 5678;
const OWNER_EMAIL = process.env.N8N_OWNER_EMAIL;
const OWNER_PASS  = process.env.N8N_OWNER_PASSWORD;
const BROWSER_ID  = randomUUID();

if (!OWNER_EMAIL || !OWNER_PASS) {
  console.error('[creds] N8N_OWNER_EMAIL / N8N_OWNER_PASSWORD manquants');
  process.exit(1);
}

const CREDENTIALS = [
  {
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
    name: 'Qdrant account',
    type: 'qdrantApi',
    data: {
      qdrantUrl: process.env.QDRANT_URL     || 'http://qdrant:6333',
      apiKey:    process.env.QDRANT_API_KEY || '',
    },
  },
  {
    name: 'OpenAi account',
    type: 'openAiApi',
    data: {
      apiKey: 'sk-noauth',
      url:    process.env.LLM_BASE_URL || 'http://llm-server:8000/v1',
    },
  },
];

// ── HTTP helper ──────────────────────────────────────────────────────────────

function httpRequest(path, method, body, authHeaders) {
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const headers = {
    'Accept': 'application/json',
    'Cookie': `browserId=${BROWSER_ID}`,
    ...authHeaders,
  };
  if (bodyStr) {
    headers['Content-Type']   = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(bodyStr);
  }

  return new Promise((resolve, reject) => {
    const req = http.request({ host: N8N_HOST, port: N8N_PORT, path, method, headers }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Auth ─────────────────────────────────────────────────────────────────────

async function login() {
  for (let i = 0; i < 25; i++) {
    try {
      const res = await httpRequest('/rest/login', 'POST', {
        emailOrLdapLoginId: OWNER_EMAIL, password: OWNER_PASS,
      }, {});

      console.log(`[creds] Login -> HTTP ${res.status} | ${res.body.slice(0, 300)}`);

      if (res.status === 200) {
        let parsed;
        try { parsed = JSON.parse(res.body); } catch { parsed = {}; }

        // n8n v1.x : JWT dans le body
        const token = parsed?.data?.token || parsed?.token;
        if (token) {
          console.log('[creds] Login OK (JWT Bearer)');
          return { Authorization: `Bearer ${token}` };
        }

        // Anciennes versions : cookie de session
        const cookieHdr = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        if (cookieHdr) {
          console.log('[creds] Login OK (session cookie)');
          return { Cookie: `browserId=${BROWSER_ID}; ${cookieHdr}` };
        }

        // n8n pas encore configuré (setup-owner pas encore passé)
        const isSetUp = parsed?.data?.isOwnerSetUp ?? parsed?.isOwnerSetUp;
        if (isSetUp === false) {
          console.log('[creds] n8n pas encore configuré, attente setup-owner...');
        }
      }
    } catch (e) {
      console.log(`[creds] n8n inaccessible : ${e.message}`);
    }
    await sleep(3000);
  }
  throw new Error('Login échoué après ~75s');
}

// ── Credentials API ──────────────────────────────────────────────────────────

async function listCredentials(auth) {
  const res = await httpRequest('/rest/credentials', 'GET', null, auth);
  if (res.status !== 200) throw new Error(`GET /rest/credentials -> ${res.status}: ${res.body.slice(0, 200)}`);
  const parsed = JSON.parse(res.body);
  return parsed.data || parsed || [];
}

async function createCredential(auth, cred) {
  const res = await httpRequest('/rest/credentials', 'POST', cred, auth);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`POST /rest/credentials -> ${res.status}: ${res.body.slice(0, 200)}`);
  }
  const parsed = JSON.parse(res.body);
  return parsed.data || parsed;
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const auth     = await login();
  const existing = await listCredentials(auth);
  const byName   = new Map(existing.map(c => [c.name, c.id]));
  const mapping  = {};

  for (const cred of CREDENTIALS) {
    if (byName.has(cred.name)) {
      mapping[cred.name] = byName.get(cred.name);
      console.log(`[creds] Déjà présent : ${cred.name} (id=${mapping[cred.name]})`);
    } else {
      const created = await createCredential(auth, cred);
      mapping[cred.name] = created.id;
      console.log(`[creds] Créé : ${cred.name} (id=${created.id})`);
    }
  }

  fs.writeFileSync('/tmp/cred-mapping.json', JSON.stringify(mapping, null, 2));
  console.log('[creds] Mapping → /tmp/cred-mapping.json');
  console.log('[creds] Terminé.');
})().catch(e => {
  console.error('[creds] ERREUR :', e.message);
  process.exit(1);
});
