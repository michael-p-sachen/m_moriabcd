// Uploads PDFs + the video to Shopify Files via the Admin GraphQL API.
//
// Flow per file:
//   1. stagedUploadsCreate -> get a signed GCS POST target
//   2. POST the binary to that target (uses `curl` to stream big files cleanly)
//   3. fileCreate with the resourceUrl from step 1
//   4. Poll node(id) until fileStatus = READY, capture the CDN url
//
// Env: SHOPIFY_SHOP_DOMAIN (e.g. mmoriabc.myshopify.com), SHOPIFY_ADMIN_TOKEN
// Output: scripts/shopify-uploads.json — { filename: { id, url, kind } }
// State:  scripts/.shopify-upload-state.json — resume marker (same shape)
//
// Skip already-uploaded files (by filename) so re-runs are cheap.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stat } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PACK_DIR = '/Users/michaelsachen/Downloads/pack/documents';

const FILES = [
  'a_ibrid0-document.pdf',
  'b_ibrid0-document.pdf',
  'c_ibrid0-document.pdf',
  'edizi0ne-document.pdf',
  'esposizi0ne-document.pdf',
  'f0918-document.pdf',
  'l0318-document.pdf',
  'libr0-document.pdf',
  'm0616-document.pdf',
  'm_moriabc-document.pdf',
  'm_moriabcd-video.mp4',
  'manifest0-document.pdf',
  'n0917-document.pdf',
];

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

if (!SHOP || !TOKEN) {
  console.error('Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_TOKEN. Source .env first.');
  process.exit(1);
}

const STATE_PATH = path.join(ROOT, 'scripts/.shopify-upload-state.json');
const OUTPUT_PATH = path.join(ROOT, 'scripts/shopify-uploads.json');

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');

const ENDPOINT = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

async function gql(query, variables) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${text}`);
  const json = JSON.parse(text);
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

const STAGED = `
mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets { url resourceUrl parameters { name value } }
    userErrors { field message }
  }
}`;

const FILE_CREATE = `
mutation fileCreate($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files {
      id
      fileStatus
      alt
      ... on GenericFile { url }
      ... on Video { sources { url mimeType format fileSize } }
      ... on MediaImage { image { url } }
    }
    userErrors { field message code }
  }
}`;

const FILE_NODE = `
query fileNode($id: ID!) {
  node(id: $id) {
    id
    ... on GenericFile { fileStatus url }
    ... on Video {
      fileStatus
      sources { url mimeType format height width fileSize }
      originalSource { url }
    }
    ... on MediaImage { fileStatus image { url } }
  }
}`;

const FILES_BY_QUERY = `
query filesByQuery($query: String!) {
  files(first: 5, query: $query) {
    nodes {
      id
      fileStatus
      alt
      ... on GenericFile { url }
      ... on Video { sources { url mimeType format } }
      ... on MediaImage { image { url } }
    }
  }
}`;

function mimeFor(name) {
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.mp4')) return 'video/mp4';
  throw new Error(`Unknown mime for ${name}`);
}
function resourceFor(name) {
  if (name.endsWith('.mp4')) return 'VIDEO';
  return 'FILE';
}

async function stagedFor(name, size) {
  const data = await gql(STAGED, {
    input: [{
      filename: name,
      mimeType: mimeFor(name),
      resource: resourceFor(name),
      fileSize: String(size),
      httpMethod: 'POST',
    }],
  });
  const errs = data.stagedUploadsCreate.userErrors;
  if (errs?.length) throw new Error(`stagedUploadsCreate: ${JSON.stringify(errs)}`);
  const target = data.stagedUploadsCreate.stagedTargets[0];
  if (!target) throw new Error('No staged target returned');
  return target;
}

function uploadWithCurl(target, filePath, label, sizeBytes) {
  return new Promise((resolve, reject) => {
    const args = ['--fail-with-body', '-sS', '-X', 'POST'];
    for (const p of target.parameters) {
      args.push('-F', `${p.name}=${p.value}`);
    }
    args.push('-F', `file=@${filePath}`);
    args.push(target.url);
    const t0 = Date.now();
    const c = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    c.stdout.on('data', (d) => (stdout += d.toString()));
    c.stderr.on('data', (d) => (stderr += d.toString()));

    // Heartbeat so we can see progress for large files (curl is silent with -sS).
    // Reads /proc-equivalent via lsof to get curl's socket send count is unreliable on macOS,
    // so we just report elapsed time + projected throughput from wall clock.
    const heartbeat = setInterval(() => {
      const elapsed = (Date.now() - t0) / 1000;
      process.stdout.write(`  ... still uploading ${label} (${elapsed.toFixed(0)}s elapsed)\n`);
    }, 10_000);

    c.on('close', (code) => {
      clearInterval(heartbeat);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const mbps = sizeBytes ? (sizeBytes / 1024 / 1024 / (secs || 1)).toFixed(1) : null;
      if (code === 0) {
        console.log(`  uploaded ${label} in ${secs}s${mbps ? ` (~${mbps} MB/s)` : ''}`);
        resolve();
      } else {
        reject(new Error(`curl exited ${code} for ${label}: ${stderr || stdout}`));
      }
    });
  });
}

async function registerFile(target, name) {
  const data = await gql(FILE_CREATE, {
    files: [{
      alt: name,
      contentType: resourceFor(name),
      originalSource: target.resourceUrl,
    }],
  });
  const errs = data.fileCreate.userErrors;
  if (errs?.length) throw new Error(`fileCreate: ${JSON.stringify(errs)}`);
  const file = data.fileCreate.files[0];
  if (!file) throw new Error('No file returned from fileCreate');
  return file;
}

function extractUrl(node) {
  if (!node) return null;
  if (node.url) return node.url;
  if (node.image?.url) return node.image.url;
  if (node.sources?.length) {
    // For video: prefer the largest mp4 source.
    const mp4 = node.sources.filter((s) => s.mimeType === 'video/mp4' || s.format === 'mp4');
    const pick = (mp4.length ? mp4 : node.sources).slice().sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0))[0];
    return pick?.url || null;
  }
  if (node.originalSource?.url) return node.originalSource.url;
  return null;
}

async function pollUntilReady(id, name) {
  const deadline = Date.now() + 15 * 60 * 1000; // 15 min cap (video transcode can take a while)
  let lastStatus = null;
  while (Date.now() < deadline) {
    const data = await gql(FILE_NODE, { id });
    const node = data.node;
    if (node?.fileStatus !== lastStatus) {
      console.log(`  ${name} status: ${node?.fileStatus}`);
      lastStatus = node?.fileStatus;
    }
    if (node?.fileStatus === 'READY') {
      const url = extractUrl(node);
      if (!url) throw new Error(`READY but no URL for ${name}: ${JSON.stringify(node)}`);
      return url;
    }
    if (node?.fileStatus === 'FAILED') {
      throw new Error(`FAILED: ${name}`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`Timed out waiting for ${name} to become READY`);
}

async function findExisting(name) {
  const data = await gql(FILES_BY_QUERY, { query: `filename:${name}` });
  return data.files.nodes.find((n) => n) || null;
}

async function main() {
  const state = readJson(STATE_PATH);
  const result = { ...state };

  for (const name of FILES) {
    const filePath = path.join(PACK_DIR, name);
    if (!fs.existsSync(filePath)) {
      console.error(`MISSING locally: ${filePath}`);
      process.exit(1);
    }

    if (result[name]?.url) {
      console.log(`= ${name} already uploaded -> ${result[name].url}`);
      continue;
    }

    const stats = await stat(filePath);
    const mb = (stats.size / 1024 / 1024).toFixed(1);
    console.log(`\n> ${name} (${mb} MB)`);

    // Check if Shopify already has it (covers cases where a prior run uploaded but the state file is missing).
    const existing = await findExisting(name);
    if (existing && existing.fileStatus === 'READY') {
      const url = extractUrl(existing);
      if (url) {
        console.log(`  found existing in Shopify -> ${url}`);
        result[name] = { id: existing.id, url, kind: resourceFor(name), reused: true };
        writeJson(STATE_PATH, result);
        writeJson(OUTPUT_PATH, result);
        continue;
      }
    }

    const target = await stagedFor(name, stats.size);
    await uploadWithCurl(target, filePath, `${name} (${mb} MB)`, stats.size);
    const file = await registerFile(target, name);
    const url = await pollUntilReady(file.id, name);
    result[name] = { id: file.id, url, kind: resourceFor(name) };
    console.log(`  ready -> ${url}`);
    writeJson(STATE_PATH, result);
    writeJson(OUTPUT_PATH, result);
  }

  writeJson(OUTPUT_PATH, result);
  console.log(`\nDone. Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
