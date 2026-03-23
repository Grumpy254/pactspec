#!/bin/bash
# Seed the local registry with demo agents
# Usage: REGISTRY=http://localhost:3001 ./scripts/seed-agents.sh

REGISTRY="${REGISTRY:-http://localhost:3001}"
AGENT_DIR="$(dirname "$0")/../agents"

echo "Seeding registry at $REGISTRY..."
echo ""

for spec in "$AGENT_DIR"/*.pactspec.json; do
  NAME=$(basename "$spec")
  echo -n "  Publishing $NAME... "

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$REGISTRY/api/agents" \
    -H "Content-Type: application/json" \
    -H "X-Agent-ID: pactspec-demo" \
    -d @"$spec" 2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" = "201" ]; then
    SPEC_ID=$(echo "$BODY" | grep -o '"spec_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "OK ($SPEC_ID)"
  else
    ERROR=$(echo "$BODY" | grep -o '"error":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "FAILED ($HTTP_CODE: $ERROR)"
  fi
done

echo ""
echo "Done. Check $REGISTRY to see the registry."
