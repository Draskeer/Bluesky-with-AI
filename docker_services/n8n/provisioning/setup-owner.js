/**
 * Crée le compte owner n8n via l'API REST /rest/owner/setup.
 * Compatible n8n v2.x (la colonne roleSlug n'existe plus dans la table user).
 */
const http = require('http');

const email     = process.env.N8N_OWNER_EMAIL     || 'admin@example.com';
const password  = process.env.N8N_OWNER_PASSWORD  || 'Admin123!';
const firstName = process.env.N8N_OWNER_FIRSTNAME || 'Admin';
const lastName  = process.env.N8N_OWNER_LASTNAME  || 'User';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: 'localhost', port: 5678, path }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function post(path, body) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: 'localhost', port: 5678, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  // Vérifier si l'instance est déjà configurée
  for (let i = 0; i < 10; i++) {
    try {
      const res = await get('/rest/settings');
      if (res.status === 200) {
        const settings = JSON.parse(res.body);
        const data = settings.data || settings;
        if (data?.userManagement?.isInstanceOwnerSetUp) {
          console.log('[owner] Instance déjà configurée, rien à faire.');
          return;
        }
        break;
      }
    } catch {}
    await sleep(2000);
  }

  // Créer le compte owner via l'API
  const res = await post('/rest/owner/setup', { email, firstName, lastName, password });

  if (res.status === 200 || res.status === 201) {
    console.log('[owner] Compte owner créé : ' + email);
  } else {
    console.error('[owner] Erreur setup owner HTTP ' + res.status + ' : ' + res.body.slice(0, 300));
    process.exit(1);
  }
}

main().catch(e => {
  console.error('[owner] ERREUR :', e.message);
  process.exit(1);
});
