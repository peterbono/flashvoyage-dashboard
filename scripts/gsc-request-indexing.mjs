#!/usr/bin/env node
/**
 * gsc-request-indexing.mjs — request indexing for FlashVoyage URLs via the
 * Google Indexing API (https://indexing.googleapis.com/v3/urlNotifications:publish).
 *
 * Usage:
 *   node scripts/gsc-request-indexing.mjs                     # default priority list
 *   node scripts/gsc-request-indexing.mjs <url> [<url> ...]   # explicit URLs
 *   node scripts/gsc-request-indexing.mjs --deleted <url>     # signal URL removal
 *   node scripts/gsc-request-indexing.mjs --check <url>       # check quota + auth (no write)
 *
 * Env:
 *   GA4_SERVICE_ACCOUNT_PATH   path to the SA JSON
 *                              (default: ~/flashvoyage-content/ga4-service-account.json)
 *
 * Caveats — read before relying on this:
 *  - The Indexing API is OFFICIALLY scoped to JobPosting + BroadcastEvent
 *    structured data. For regular content, Google may queue a crawl or may
 *    ignore the request (undocumented behavior). In practice it triggers a
 *    recrawl for most submissions, just without a guarantee.
 *  - The service account MUST be added as an OWNER of the GSC property
 *    (not just "user" — Indexing API requires owner). 403 PERMISSION_DENIED
 *    means it isn't. Fix: GSC → Settings → Users and permissions → Add user
 *    → SA email → Permission: Owner.
 *  - Quota: 200 URLs / project / day.
 *  - Zero npm deps — uses native `crypto` + `fetch` to keep this out of the
 *    Next.js build graph.
 */
import { readFileSync } from 'fs';
import { createSign } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';

const SA_PATH = process.env.GA4_SERVICE_ACCOUNT_PATH
  || join(homedir(), 'flashvoyage-content/ga4-service-account.json');

const DEFAULT_URLS = [
  // Freshly published / freshly edited (uncrawled or stale-crawled)
  'https://flashvoyage.com/meilleur-esim-thailande-2026/',
  'https://flashvoyage.com/assurance-voyage-vietnam-rapatriement-frais-caches-2026/',
  'https://flashvoyage.com/japon-couple-15-jours-budget-tout-compris-2026/',
  'https://flashvoyage.com/bali-vs-thailande-premier-voyage-asie-comparatif/',
  'https://flashvoyage.com/bali-lombok-gili-10-jours-itineraire-budget-2026/',
  'https://flashvoyage.com/esim-philippines-globe-smart-comparatif-2026/',
  // The 12 pages cleaned on 2026-05-08 (spam paragraph removal)
  'https://flashvoyage.com/asie-du-sud-est-choix-ditineraires-pour-un-voyage-hors-des-sentiers-battus/',
  'https://flashvoyage.com/optimiser-son-visa-de-nomade-digital-en-asie-du-sud-est-strategies-et-ecueils/',
  'https://flashvoyage.com/voyager-2-semaines-en-thailande-arbitrer-entre-bangkok-chiang-mai-et-krabi-sans-sacrifier-lauthenticite/',
  'https://flashvoyage.com/philippines-les-5-frais-caches-qui-explosent-ton-budget-de-voyage/',
  'https://flashvoyage.com/vietnam-central-13-jours-3-choix-impossibles-a-faire-et-comment-les-trancher/',
  'https://flashvoyage.com/philippines-10-jours-itineraire-plages-budget-2026/',
  'https://flashvoyage.com/pourquoi-ton-premier-mois-en-coree-du-sud-te-coutera-plus-cher-que-prevu/',
  'https://flashvoyage.com/vietnam-vs-thailande-en-2026-larbitrage-crucial-pour-un-premier-voyage/',
];

// ── JWT-based service-account auth ──────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function getAccessToken(sa, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const toSign = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(toSign);
  const sig = b64url(signer.sign(sa.private_key));
  const jwt = `${toSign}.${sig}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`token exchange failed [${r.status}]: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Main ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDeleted = args.includes('--deleted');
const isCheck = args.includes('--check');
const cliUrls = args.filter(a => !a.startsWith('--'));
const urls = cliUrls.length > 0 ? cliUrls : DEFAULT_URLS;
const notifType = isDeleted ? 'URL_DELETED' : 'URL_UPDATED';

let sa;
try {
  sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'));
} catch (e) {
  console.error(`[INDEX] Cannot read service account at ${SA_PATH}: ${e.message}`);
  process.exit(2);
}

console.log(`[INDEX] SA: ${sa.client_email}`);
console.log(`[INDEX] Mode: ${isCheck ? 'CHECK ONLY (no submit)' : notifType}`);
console.log(`[INDEX] URLs to ${isCheck ? 'verify' : 'submit'}: ${urls.length}\n`);

const token = await getAccessToken(sa, 'https://www.googleapis.com/auth/indexing');

if (isCheck) {
  // Just probe metadata endpoint — doesn't burn quota
  for (const url of urls) {
    const r = await fetch(
      `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(url)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await r.json();
    const path = url.replace('https://flashvoyage.com', '');
    if (r.ok) {
      const upd = data.latestUpdate;
      console.log(`  ✓ ${path.padEnd(70)}  last=${upd?.notifyTime?.slice(0,19) || 'never'} type=${upd?.type || '-'}`);
    } else {
      const msg = data?.error?.message || JSON.stringify(data);
      console.log(`  ✗ ${path.padEnd(70)}  [${r.status}] ${msg.slice(0,80)}`);
      if (r.status === 403 && msg.includes('has not been used in project')) {
        const m = msg.match(/https:\/\/console\.developers\.google\.com\S+/);
        console.error(`\n  Indexing API isn't enabled in the SA's project. Enable here:`);
        if (m) console.error(`  ${m[0]}\n  Then wait 1-2 min and re-run.\n`);
        break;
      }
    }
  }
  process.exit(0);
}

let ok = 0, failed = 0;
for (const url of urls) {
  const r = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, type: notifType }),
  });
  const data = await r.json();
  const path = url.replace('https://flashvoyage.com', '');
  if (r.ok) {
    const ts = data.urlNotificationMetadata?.latestUpdate?.notifyTime || 'queued';
    console.log(`  ✓ ${path.padEnd(70)}  → ${ts}`);
    ok++;
  } else {
    const code = r.status;
    const msg = data?.error?.message || JSON.stringify(data);
    console.log(`  ✗ ${path.padEnd(70)}  [${code}] ${msg.slice(0,100)}`);
    failed++;
    if (code === 403) {
      if (msg.includes('has not been used in project')) {
        const m = msg.match(/https:\/\/console\.developers\.google\.com\S+/);
        console.error(`\n  Indexing API isn't enabled in the SA's GCP project. Enable here:`);
        if (m) console.error(`  ${m[0]}\n  Then wait 1-2 min and re-run.\n`);
      } else {
        console.error(`\n  ${sa.client_email} is not an Owner of the GSC property.`);
        console.error(`  Fix: Search Console → Settings → Users and permissions → Add user`);
        console.error(`       → "${sa.client_email}" → Permission: Owner.\n`);
      }
      break;
    }
    if (code === 429) {
      console.error(`\n  429 — daily quota exhausted (200/day). Try again tomorrow.\n`);
      break;
    }
  }
}

console.log(`\n[INDEX] Done: ${ok} ok, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
