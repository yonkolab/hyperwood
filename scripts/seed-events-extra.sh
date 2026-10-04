#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SEED_BASE_URL:-https://hyperwood.yonkolab.xyz}"
TOKEN="${SEED_TOKEN:?SEED_TOKEN is required}"

echo ">>> lendo ${1:-scripts/seed-events-extra-2026-10.json}"

python3 - "$1" <<'PYEOF'
import json, sys, urllib.request

events_file = sys.argv[1]
base_url = __import__('os').environ.get('SEED_BASE_URL', 'https://hyperwood.yonkolab.xyz')
token = __import__('os').environ['SEED_TOKEN']

with open(events_file, encoding="utf-8") as f:
    events = json.load(f)["events"]

def api(path, body):
    req = urllib.request.Request(
        f"{base_url}{path}",
        method="POST",
        data=json.dumps(body).encode(),
        headers={
            "content-type": "application/json",
            "x-bootstrap-token": token,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

total = 0
for event in events:
    event_payload = {k: v for k, v in event.items() if k != "markets"}
    event_response = api("/api/v1/internal/markets/events", event_payload)
    event_id = event_response["event"]["id"]
    print(f"evento: {event['slug']} ({event_id})")

    for market in event.get("markets", []):
        market_response = api(
            "/api/v1/internal/markets",
            {**market, "eventId": event_id, "status": "active"},
        )
        total += 1
        print(f"  mercado: {market['slug']} ({market_response['market']['id']})")

print(f"\n{total} mercados criados em {len(events)} eventos")
PYEOF
