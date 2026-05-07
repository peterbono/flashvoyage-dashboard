#!/usr/bin/env bash
# FlashVoyage GSC fixes — one-shot script
# Runs the 2 WordPress edits that resolve the GSC flags from 2026-05-07.
#
# Usage:
#   1. Pull creds:    vercel env pull .env.local
#   2. Source them:   set -a; source .env.local; set +a
#   3. Run:           bash scripts/gsc-fix.sh           # dry-run, shows what it WILL do
#                     bash scripts/gsc-fix.sh --apply   # actually does it
#
# Required env: WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD

set -euo pipefail

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

: "${WORDPRESS_URL:?need WORDPRESS_URL}"
: "${WORDPRESS_USERNAME:?need WORDPRESS_USERNAME}"
: "${WORDPRESS_APP_PASSWORD:?need WORDPRESS_APP_PASSWORD}"

# Vercel env pull encodes values with literal "\n" suffixes (dotenv-style escape
# for an embedded newline). bash `source` doesn't decode that, so strip it.
strip_dotenv_escapes() { printf '%s' "$1" | sed 's/\\n$//; s/\\r$//'; }
WP_USER=$(strip_dotenv_escapes "$WORDPRESS_USERNAME")
WP_PASS=$(strip_dotenv_escapes "$WORDPRESS_APP_PASSWORD")
WP=$(strip_dotenv_escapes "$WORDPRESS_URL")
WP="${WP%/}"
AUTH=$(printf '%s:%s' "$WP_USER" "$WP_PASS" | base64 | tr -d '\n')
HDR=(-H "Authorization: Basic $AUTH" -H "Content-Type: application/json")

echo "==> Mode: $([ "$APPLY" = true ] && echo 'APPLY (writes will happen)' || echo 'DRY-RUN (no writes)')"
echo "==> Target: $WP"
echo

# ---------- 1. Orphan post: cerisiers-sans-la-foule-2 ----------
echo "==> [1/2] Looking for orphan post slug 'voyager-au-japon-quand-voir-les-cerisiers-sans-la-foule-2'"
ORPHAN=$(curl -sS "$WP/wp-json/wp/v2/posts?slug=voyager-au-japon-quand-voir-les-cerisiers-sans-la-foule-2&status=publish,draft,private,future,pending" "${HDR[@]}")
ORPHAN_ID=$(echo "$ORPHAN" | jq -r '.[0].id // empty')

if [[ -z "$ORPHAN_ID" ]]; then
  echo "    Not found via slug. Searching by title..."
  ORPHAN=$(curl -sS "$WP/wp-json/wp/v2/posts?search=cerisiers&per_page=10" "${HDR[@]}")
  echo "$ORPHAN" | jq -r '.[] | "  candidate: id=\(.id)  slug=\(.slug)  link=\(.link)"'
  ORPHAN_ID=$(echo "$ORPHAN" | jq -r '[.[] | select(.slug | endswith("-2"))][0].id // empty')
fi

if [[ -n "$ORPHAN_ID" ]]; then
  echo "    Found orphan: id=$ORPHAN_ID"
  if $APPLY; then
    echo "    -> Trashing post $ORPHAN_ID..."
    curl -sS -X DELETE "$WP/wp-json/wp/v2/posts/$ORPHAN_ID" "${HDR[@]}" | jq '{id, status, slug}'
    echo "    Done. (Use ?force=true to permanently delete; trash is reversible.)"
  else
    echo "    [dry-run] would DELETE $WP/wp-json/wp/v2/posts/$ORPHAN_ID"
  fi
else
  echo "    No orphan found — may already be cleaned up. Skipping."
fi
echo

# ---------- 2. Strip Product/Offer JSON-LD from eSIM post ----------
ESIM_SLUG="esim-philippines-globe-smart-comparatif-2026"
echo "==> [2/2] Fetching eSIM post (slug=$ESIM_SLUG)"
ESIM=$(curl -sS "$WP/wp-json/wp/v2/posts?slug=$ESIM_SLUG&context=edit" "${HDR[@]}")
ESIM_ID=$(echo "$ESIM" | jq -r '.[0].id // empty')

if [[ -z "$ESIM_ID" ]]; then
  echo "    ERROR: eSIM post not found. Aborting step 2."
  exit 1
fi
echo "    Found eSIM post: id=$ESIM_ID"

# Get raw content
RAW=$(echo "$ESIM" | jq -r '.[0].content.raw')
if [[ -z "$RAW" || "$RAW" == "null" ]]; then
  echo "    ERROR: could not read content.raw — your app password may lack edit_posts cap. Aborting."
  exit 1
fi

# Strip every <script type="application/ld+json"> block whose JSON contains "@type":"Product"
# (preserves FAQPage and any other JSON-LD blocks)
NEW=$(printf '%s' "$RAW" | python3 -c '
import sys, re, json
html = sys.stdin.read()
pattern = re.compile(r"<script[^>]*application/ld\+json[^>]*>(.*?)</script>", re.DOTALL | re.IGNORECASE)
removed = 0
def repl(m):
    global removed
    body = m.group(1).strip()
    try:
        data = json.loads(body)
    except Exception:
        return m.group(0)  # leave malformed blocks alone
    def has_product(node):
        if isinstance(node, dict):
            t = node.get("@type")
            if t == "Product" or (isinstance(t, list) and "Product" in t):
                return True
            if "offers" in node:  # belt + suspenders
                return True
            return any(has_product(v) for v in node.values())
        if isinstance(node, list):
            return any(has_product(x) for x in node)
        return False
    if has_product(data):
        removed += 1
        return ""
    return m.group(0)
out = pattern.sub(repl, html)
sys.stderr.write(f"removed_blocks={removed}\n")
sys.stdout.write(out)
' 2> /tmp/fv-removed.txt)

REMOVED=$(cat /tmp/fv-removed.txt | sed -n 's/removed_blocks=//p')
echo "    JSON-LD blocks containing Product/Offer removed: $REMOVED"

if [[ "$REMOVED" == "0" ]]; then
  echo "    Nothing to do — already clean. Skipping update."
else
  DIFF_BEFORE=$(printf '%s' "$RAW" | wc -c | tr -d ' ')
  DIFF_AFTER=$(printf '%s' "$NEW" | wc -c | tr -d ' ')
  echo "    content.raw: $DIFF_BEFORE chars -> $DIFF_AFTER chars (delta: $((DIFF_BEFORE - DIFF_AFTER)))"

  if $APPLY; then
    echo "    -> Updating post $ESIM_ID..."
    PAYLOAD=$(jq -n --arg c "$NEW" '{content: $c}')
    RESP=$(curl -sS -X POST "$WP/wp-json/wp/v2/posts/$ESIM_ID" "${HDR[@]}" -d "$PAYLOAD")
    echo "$RESP" | jq '{id, slug, modified, status}'
    echo "    Done. Visit $WP/$ESIM_SLUG/ and view-source to confirm Product/Offer JSON-LD is gone."
  else
    echo "    [dry-run] would POST $WP/wp-json/wp/v2/posts/$ESIM_ID with stripped content"
    echo "    First 200 chars of NEW content:"
    printf '%s' "$NEW" | head -c 200
    echo "..."
  fi
fi

echo
echo "==> Done. Next manual steps (Cloudflare + GSC + Permalinks): see README-gsc-fix.md"
