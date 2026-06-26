/**
 * Active tous les workflows n8n via l'API REST.
 */
const http = require('http');

const N8N_HOST    = 'n8n';
const N8N_PORT    = 5678;
const OWNER_EMAIL = process.env.N8N_OWNER_EMAIL;
const OWNER_PASS  = process.env.N8N_OWNER_PASSWORD;

function request(path, method, body, headers) {
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const hdrs = { Accept: 'application/json', ...headers };
  if (bodyStr) {
    hdrs['Content-Type']   = 'application/json';
    hdrs['Content-Length'] = Buffer.byteLength(bodyStr);
  }
  return new Promise((resolve, reject) => {
    const req = http.request({ host: N8N_HOST, port: N8N_PORT, path, method, headers: hdrs }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function login() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await request('/rest/login', 'POST',
        { emailOrLdapLoginId: OWNER_EMAIL, password: OWNER_PASS }, {});
      if (res.status === 200) {
        const parsed = JSON.parse(res.body);
        const token = parsed?.data?.token || parsed?.token;
        if (token) return { Authorization: `Bearer ${token}` };
        const cookie = (parsed?.headers?.['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        if (cookie) return { Cookie: cookie };
      }
    } catch {}
    await sleep(3000);
  }
  throw new Error('Login échoué');
}

(async () => {
  const auth = await login();

  const listRes = await request('/rest/workflows', 'GET', null, auth);
  if (listRes.status !== 200) throw new Error(`GET /rest/workflows -> ${listRes.status}`);
  const workflows = JSON.parse(listRes.body).data || [];

  for (const wf of workflows) {
    if (wf.active) {
      console.log(`[activate] Déjà actif : ${wf.name}`);
      continue;
    }
    const patchRes = await request(`/rest/workflows/${wf.id}`, 'PATCH',
      { active: true }, auth);
    if (patchRes.status === 200) {
      console.log(`[activate] Activé : ${wf.name} (${wf.id})`);
    } else {
      console.warn(`[activate] Échec ${wf.name} -> HTTP ${patchRes.status}`);
    }
  }

  console.log('[activate] Terminé.');
})().catch(e => {
  console.error('[activate] ERREUR :', e.message);
  process.exit(1);
});
