#!/usr/bin/env bash
# sync-costs.sh — Sync cost data to Supabase daily_costs table
# Runs via cron: 30 23 * * * /path/to/sync-costs.sh
#
# Expects:
#   SUPABASE_URL     — e.g., https://lhwkbjnwmfudpjbbmkrs.supabase.co
#   SUPABASE_ANON_KEY — the anon key
#   COSTS_DIR        — directory containing YYYY-MM-DD.json files (default: ~/ops-data/costs)

set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-https://lhwkbjnpmfudpjbbmkrs.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
COSTS_DIR="${COSTS_DIR:-$HOME/ops-data/costs}"

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "ERROR: SUPABASE_ANON_KEY not set" >&2
  exit 1
fi

# Process last 7 days
for i in $(seq 0 6); do
  DATE=$(date -d "-${i} days" +%Y-%m-%d 2>/dev/null || date -v-${i}d +%Y-%m-%d)
  FILE="$COSTS_DIR/$DATE.json"

  if [ ! -f "$FILE" ]; then
    continue
  fi

  echo "Processing $DATE..."

  # Extract costs from JSON (adapt field names to actual structure)
  # Expected JSON structure (flexible — script handles missing fields):
  # {
  #   "openai": { "tokens": 12345, "cost": 0.1234 },
  #   "anthropic": { "tokens": 67890, "cost": 0.5678 },
  #   "moonshot": { "tokens": 0, "cost": 0 }
  # }

  OPENAI_TOKENS=$(jq -r '.openai.tokens // 0' "$FILE")
  OPENAI_COST=$(jq -r '.openai.cost // 0' "$FILE")
  ANTHROPIC_TOKENS=$(jq -r '.anthropic.tokens // 0' "$FILE")
  ANTHROPIC_COST=$(jq -r '.anthropic.cost // 0' "$FILE")
  MOONSHOT_TOKENS=$(jq -r '.moonshot.tokens // 0' "$FILE")
  MOONSHOT_COST=$(jq -r '.moonshot.cost // 0' "$FILE")

  # Calculate total
  TOTAL_COST=$(echo "$OPENAI_COST + $ANTHROPIC_COST + $MOONSHOT_COST" | bc)

  # Read full file as raw_data
  RAW_DATA=$(cat "$FILE")

  # Upsert via Supabase REST API (ON CONFLICT date)
  PAYLOAD=$(jq -n \
    --arg date "$DATE" \
    --argjson openai_tokens "$OPENAI_TOKENS" \
    --argjson openai_cost "$OPENAI_COST" \
    --argjson anthropic_tokens "$ANTHROPIC_TOKENS" \
    --argjson anthropic_cost "$ANTHROPIC_COST" \
    --argjson moonshot_tokens "$MOONSHOT_TOKENS" \
    --argjson moonshot_cost "$MOONSHOT_COST" \
    --argjson total_cost "$TOTAL_COST" \
    --argjson raw_data "$RAW_DATA" \
    '{
      date: $date,
      openai_tokens: $openai_tokens,
      openai_cost: $openai_cost,
      anthropic_tokens: $anthropic_tokens,
      anthropic_cost: $anthropic_cost,
      moonshot_tokens: $moonshot_tokens,
      moonshot_cost: $moonshot_cost,
      total_cost: $total_cost,
      raw_data: $raw_data
    }')

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${SUPABASE_URL}/rest/v1/daily_costs" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "$PAYLOAD")

  if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
    echo "  ✓ $DATE synced (HTTP $HTTP_STATUS)"
  else
    echo "  ✗ $DATE failed (HTTP $HTTP_STATUS)" >&2
  fi
done

echo "Done."
