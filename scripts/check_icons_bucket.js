#!/usr/bin/env node
/**
 * Check the Supabase 'icons' bucket for element logos and other assets.
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/check_icons_bucket.js
 * Or set these in .env in the project root (script will load .env if present).
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function loadEnv() {
  const envPath = join(rootDir, '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const value = m[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const BUCKET = 'icons';
const ELEMENT_PATTERN = /^[a-z0-9]+-element\.png$/i;

function toPublicUrl(baseUrl, bucket, path) {
  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = path
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/');
  return `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${encodedBucket}/${encodedPath}`;
}

async function listBucket(prefix, limit = 100, offset = 0) {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/list/${encodeURIComponent(BUCKET)}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix,
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`List failed (${response.status}): ${text || response.statusText}`);
  }
  return response.json();
}

async function listAllPngFiles(prefix = '') {
  const files = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const entries = await listBucket(prefix, limit, offset);
    if (!Array.isArray(entries)) break;
    for (const entry of entries) {
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      if (!name) continue;
      const fullPath = prefix ? `${prefix}/${name}` : name;
      const lower = name.toLowerCase();
      const isFolder =
        entry.id === null &&
        (entry.metadata == null || typeof entry.metadata !== 'object') &&
        !lower.endsWith('.png');
      if (isFolder) {
        const nested = await listAllPngFiles(fullPath);
        files.push(...nested);
        continue;
      }
      if (!lower.endsWith('.png')) continue;
      files.push({
        name,
        path: fullPath,
        publicUrl: toPublicUrl(SUPABASE_URL, BUCKET, fullPath),
      });
    }
    if (entries.length < limit) break;
    offset += entries.length;
  }
  return files;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set in .env or environment.');
    process.exit(1);
  }
  console.log('Supabase URL:', SUPABASE_URL.replace(/\/\/.*@/, '//***@'));
  console.log('Bucket:', BUCKET);
  console.log('Listing files...\n');

  const files = await listAllPngFiles();
  const elementLogos = files.filter((f) => ELEMENT_PATTERN.test(f.name));
  const other = files.filter((f) => !ELEMENT_PATTERN.test(f.name));

  console.log('--- Element logos (<element-id>-element.png) ---');
  if (elementLogos.length === 0) {
    console.log('(none found)');
  } else {
    for (const f of elementLogos.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log('  ', f.name, '->', f.publicUrl);
    }
  }
  console.log('\n--- Other PNGs in bucket ---');
  if (other.length === 0) {
    console.log('(none)');
  } else {
    for (const f of other.slice(0, 30).sort((a, b) => a.path.localeCompare(b.path))) {
      console.log('  ', f.path);
    }
    if (other.length > 30) console.log('  ... and', other.length - 30, 'more');
  }
  console.log('\nTotal PNGs:', files.length);
  console.log('Element logos:', elementLogos.length);
  console.log('\nIcons bucket root for game:', `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}`);
  if (elementLogos.length > 0) {
    console.log('Example element URL:', elementLogos[0].publicUrl);
  }
  console.log('\nTo show element icons in the game when no Supabase asset URLs are loaded yet,');
  console.log('add VITE_SUPABASE_URL=' + SUPABASE_URL + ' to your .env (or .env.local).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
