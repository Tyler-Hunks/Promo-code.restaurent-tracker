#!/usr/bin/env bash
# One-shot helper: verifies the (freshly updated) SUPABASE_URL / SUPABASE_ANON_KEY
# point at a live project that has the new columns, then pushes those two
# secrets to the deployed Cloudflare Worker. Never prints secret values.
set -u
LOG=/tmp/sync-result.log
: > "$LOG"
say() { echo "$1" | tee -a "$LOG"; }

BASE="${SUPABASE_URL%/}"
REF=$(printf '%s' "$BASE" | sed 's|https://||;s|\..*||')
say "INFO: project ref currently in env: $REF"
case "$BASE" in
  *zghmbcsaamwdywmiqttr*)
    say "FAIL: environment still has the old dead project URL"
    exit 0
    ;;
esac
say "STEP1 OK: new SUPABASE_URL present in environment"

code_camp=$(curl -s -o /tmp/camp.json -w '%{http_code}' --max-time 25 \
  "$BASE/rest/v1/email_campaigns?select=id,main_scripts&limit=0" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY")
code_tmpl=$(curl -s -o /tmp/tmpl.json -w '%{http_code}' --max-time 25 \
  "$BASE/rest/v1/email_campaign_templates?select=id,default_main_scripts&limit=0" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY")
say "STEP2: email_campaigns.main_scripts HTTP=$code_camp body=$(head -c 300 /tmp/camp.json)"
say "STEP2: email_campaign_templates.default_main_scripts HTTP=$code_tmpl body=$(head -c 300 /tmp/tmpl.json)"

if [ "$code_camp" != "200" ] || [ "$code_tmpl" != "200" ]; then
  say "STOP: columns not visible in this project - NOT pushing secrets to Cloudflare"
  exit 0
fi
say "STEP2 OK: both new columns are visible in the new project"

say "STEP3: pushing secrets to the deployed Worker (promo-code-manager)..."
if printf '%s' "$SUPABASE_URL" | npx wrangler secret put SUPABASE_URL >>"$LOG" 2>&1; then
  say "SUPABASE_URL pushed to Cloudflare"
else
  say "FAIL pushing SUPABASE_URL (see log)"
fi
if printf '%s' "$SUPABASE_ANON_KEY" | npx wrangler secret put SUPABASE_ANON_KEY >>"$LOG" 2>&1; then
  say "SUPABASE_ANON_KEY pushed to Cloudflare"
else
  say "FAIL pushing SUPABASE_ANON_KEY (see log)"
fi
say "DONE"
