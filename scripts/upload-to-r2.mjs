// Uploads PDFs to Cloudflare R2 via the S3-compatible API with multipart upload.
// Streams files in 10 MB parts, parallel uploads per file, parallel files at file-level.
//
// Env:
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_ENDPOINT           https://<account_id>.r2.cloudflarestorage.com
//   R2_BUCKET             mmoria
//   R2_PUBLIC_PREFIX      https://pub-xxxx.r2.dev  (used for the output map URLs)
//   R2_CONCURRENCY        number of files in flight at once (default 3)
//
// Output:
//   scripts/r2-uploads.json — { filename: { url } }
//   scripts/.r2-upload-state.json (resume marker, same shape)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat } from 'node:fs/promises';

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'node:https';

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
  'manifest0-document.pdf',
  'n0917-document.pdf',
];

const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const ENDPOINT = process.env.R2_ENDPOINT;
const BUCKET = process.env.R2_BUCKET;
const PUBLIC_PREFIX = process.env.R2_PUBLIC_PREFIX || '';
const CONCURRENCY = Number(process.env.R2_CONCURRENCY || 3);

if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !ENDPOINT || !BUCKET) {
  console.error('Missing one of R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT / R2_BUCKET.');
  process.exit(1);
}

const STATE_PATH = path.join(ROOT, 'scripts/.r2-upload-state.json');
const OUTPUT_PATH = path.join(ROOT, 'scripts/r2-uploads.json');
const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');

// Tune HTTPS agent for slow links: keep connections alive, generous timeouts.
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 8,
  timeout: 300_000, // 5 min idle timeout — survive slow part transfers
});

const s3 = new S3Client({
  region: 'auto',
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  maxAttempts: 5,
  requestHandler: new NodeHttpHandler({
    httpsAgent,
    requestTimeout: 600_000, // 10 min per part
    connectionTimeout: 30_000,
  }),
});

async function uploadOnce(name, filePath, size) {
  const body = fs.createReadStream(filePath);
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: name,
      Body: body,
      ContentType: 'application/pdf',
    },
    partSize: 5 * 1024 * 1024, // 5 MB — smallest allowed; finishes each part fast on slow links
    queueSize: 1, // serial parts; multi-stream parallelism caused EPIPE on slow link
    leavePartsOnError: false,
  });

  const mb = (size / 1024 / 1024).toFixed(1);
  const t0 = Date.now();
  let lastReport = 0;
  upload.on('httpUploadProgress', (p) => {
    const now = Date.now();
    if (now - lastReport >= 15_000) {
      lastReport = now;
      const pct = p.total ? ((p.loaded / p.total) * 100).toFixed(0) : '??';
      const mbDone = (p.loaded / 1024 / 1024).toFixed(0);
      const el = ((now - t0) / 1000).toFixed(0);
      process.stdout.write(`  ...   ${name}: ${pct}% (${mbDone}/${mb} MB) at ${el}s\n`);
    }
  });

  await upload.done();
}

async function uploadOne(name) {
  const filePath = path.join(PACK_DIR, name);
  if (!fs.existsSync(filePath)) throw new Error(`Missing locally: ${filePath}`);
  const s = await stat(filePath);
  const mb = (s.size / 1024 / 1024).toFixed(1);

  const MAX_ATTEMPTS = 4;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now();
    const label = attempt === 1 ? `[start]` : `[retry ${attempt}/${MAX_ATTEMPTS}]`;
    console.log(`${label} ${name} (${mb} MB)`);
    try {
      await uploadOnce(name, filePath, s.size);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const rate = (s.size / 1024 / 1024 / Math.max(parseFloat(secs), 0.1)).toFixed(1);
      console.log(`[done ] ${name} in ${secs}s (~${rate} MB/s)`);
      const url = PUBLIC_PREFIX ? `${PUBLIC_PREFIX.replace(/\/$/, '')}/${name}` : '';
      return { name, url };
    } catch (e) {
      lastErr = e;
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.error(`[fail*] ${name} attempt ${attempt} after ${secs}s: ${e.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const backoff = Math.min(30, 2 ** attempt) * 1000;
        console.error(`  backing off ${backoff / 1000}s before retry...`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw lastErr;
}

async function main() {
  const state = readJson(STATE_PATH);
  const result = { ...state };
  const todo = FILES.filter((n) => !(n in result));

  if (todo.length === 0) {
    console.log('All files already in state. Nothing to upload.');
    writeJson(OUTPUT_PATH, result);
    return;
  }
  console.log(`Uploading ${todo.length}/${FILES.length} files (concurrency ${CONCURRENCY}) to ${BUCKET}.`);
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log('');

  const queue = todo.slice();
  const errors = [];

  async function worker() {
    while (queue.length) {
      const name = queue.shift();
      try {
        const r = await uploadOne(name);
        result[name] = { url: r.url };
        writeJson(STATE_PATH, result);
        writeJson(OUTPUT_PATH, result);
      } catch (e) {
        errors.push({ name, error: e.message });
        console.error(`[fail ] ${name}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  writeJson(OUTPUT_PATH, result);
  console.log(`\nWrote ${OUTPUT_PATH}`);
  if (errors.length) {
    console.error(`${errors.length} file(s) failed:`);
    for (const e of errors) console.error(`  ${e.name}: ${e.error}`);
    process.exit(1);
  }
  console.log('All uploaded.');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
