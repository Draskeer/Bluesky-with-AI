/**
 * Remplace les IDs de credentials dans un workflow n8n exporté.
 * Lit /tmp/cred-mapping.json (écrit par create-credentials.js).
 * Usage: node patch-workflow.js <input.json> [output.json]
 */
const fs = require('fs');

const mappingPath = '/tmp/cred-mapping.json';
const inputPath   = process.argv[2];
const outputPath  = process.argv[3] || '/tmp/patched-workflow.json';

if (!inputPath) {
  console.error('[patch] Usage: node patch-workflow.js <input.json> [output.json]');
  process.exit(1);
}

if (!fs.existsSync(mappingPath)) {
  console.error(`[patch] Mapping introuvable : ${mappingPath}`);
  process.exit(1);
}

const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const wf      = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

for (const node of (wf.nodes || [])) {
  if (!node.credentials) continue;
  for (const [type, ref] of Object.entries(node.credentials)) {
    const newId = mapping[ref.name];
    if (newId && newId !== ref.id) {
      console.log(`[patch] ${node.name} [${type}] : ${ref.id} → ${newId}`);
      ref.id = newId;
    }
  }
}

fs.writeFileSync(outputPath, JSON.stringify(wf, null, 2));
console.log(`[patch] Workflow patché → ${outputPath}`);
