#!/usr/bin/env python3
"""Idempotently mirror the documented Polymarket snapshot into Hyperwood."""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DATA_PATH = Path(__file__).with_name("brazil-presidential-election-outcomes.json")
API_BASE = os.environ.get("ELECTION_SYNC_BASE_URL")
TOKEN = os.environ.get("ELECTION_SYNC_TOKEN")
SOURCE_EVENT_URL = "https://polymarket.com/event/brazil-presidential-election"


def fail(message):
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def request(method, path, body=None):
    payload = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"accept": "application/json", "x-bootstrap-token": TOKEN}
    if payload is not None:
        headers["content-type"] = "application/json"
    req = urllib.request.Request(
        f"{API_BASE}/api/v1{path}",
        data=payload,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        response_body = error.read().decode("utf-8", errors="replace")
        fail(f"{method} {path} returned HTTP {error.code}: {response_body}")
    except urllib.error.URLError as error:
        fail(f"{method} {path} failed: {error.reason}")


def all_markets():
    items = []
    offset = 0
    while True:
        query = urllib.parse.urlencode({"limit": 100, "offset": offset})
        result = request("GET", f"/markets?{query}")
        items.extend(result["markets"])
        if not result["pagination"]["hasMore"]:
            return items
        offset += 100


def main():
    if not API_BASE or not TOKEN:
        fail("set ELECTION_SYNC_BASE_URL and ELECTION_SYNC_TOKEN")
    if "--apply" not in sys.argv:
        fail("no changes made; pass --apply to create, update, resolve, and settle markets")

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    markets = all_markets()
    event_markets = [
        market for market in markets if market["event"]["slug"] == data["eventSlug"]
    ]
    event = event_markets[0]["event"] if event_markets else None
    currency = event_markets[0]["currency"] if event_markets else os.environ.get(
        "ELECTION_SYNC_CURRENCY"
    )
    if not currency:
        fail(
            "cannot determine a supported market currency; "
            "set ELECTION_SYNC_CURRENCY"
        )

    if event is None:
        created = request(
            "POST",
            "/internal/markets/events",
            {
                "slug": data["eventSlug"],
                "title": data["eventTitle"],
                "summary": data["eventSummary"],
                "category": "Política",
                "startsAt": "2026-10-04T00:00:00.000Z",
                "endsAt": data["eventEndsAt"],
            },
        )
        event = created["event"]
        print(f"Evento criado: {event['id']}")
    else:
        event_changes = {
            "title": data["eventTitle"],
            "summary": data["eventSummary"],
            "endsAt": data["eventEndsAt"],
        }
        if any(event.get(field) != value for field, value in event_changes.items()):
            updated = request(
                "PATCH",
                f"/internal/markets/events/{event['id']}",
                event_changes,
            )
            event = updated["event"]
            print(f"Evento atualizado: {event['id']}")
        else:
            print(f"Evento já sincronizado: {event['id']}")

    markets_by_slug = {market["slug"]: market for market in event_markets}
    summary = (
        "Contrato individual sobre o vencedor da eleição presidencial brasileira "
        "de 2026. O status e, para mercados ativos, a cotação inicial foram "
        f"espelhados da Polymarket em {data['updatedAt']}; consulte as regras e "
        "fontes antes de negociar."
    )

    for outcome in data["outcomes"]:
        market = markets_by_slug.get(outcome["slug"])
        if market is None:
            created = request(
                "POST",
                "/internal/markets",
                {
                    "eventId": event["id"],
                    "slug": outcome["slug"],
                    "title": outcome["title"],
                    "summary": summary,
                    "currency": currency,
                    "status": (
                        "active"
                        if outcome["marketStatus"] == "active"
                        else "draft"
                    ),
                    "tags": ["Brasil 2026", "eleição presidencial"],
                    "resolutionRules": data["resolutionRules"],
                    "resolutionSources": data["resolutionSources"],
                    "yesPriceBps": outcome["yesPriceBps"],
                    "noPriceBps": 10000 - outcome["yesPriceBps"],
                    "volumeUsdMinor": 0,
                    "opensAt": "2026-10-04T00:00:00.000Z",
                    "closesAt": data["closingAt"],
                    "resolvesAt": data["resolutionAt"],
                },
            )
            market = created["market"]
            markets_by_slug[outcome["slug"]] = market
            print(f"Mercado criado: {outcome['slug']} ({market['id']})")
        elif outcome["marketStatus"] == "active":
            if market["status"] != "active":
                fail(
                    f"{outcome['slug']} should remain active, "
                    f"but current status is {market['status']}"
                )
            market_detail = request("GET", f"/markets/{market['id']}")["market"]
            market_changes = {
                "title": outcome["title"],
                "summary": summary,
                "resolutionRules": data["resolutionRules"],
                "resolutionSources": data["resolutionSources"],
                "yesPriceBps": outcome["yesPriceBps"],
                "noPriceBps": 10000 - outcome["yesPriceBps"],
                "closesAt": data["closingAt"],
                "resolvesAt": data["resolutionAt"],
            }
            if any(
                market_detail.get(field) != value
                for field, value in market_changes.items()
            ):
                updated = request(
                    "PATCH",
                    f"/internal/markets/{market['id']}",
                    market_changes,
                )
                market = updated["market"]
                markets_by_slug[outcome["slug"]] = market
                print(
                    f"Mercado ativo atualizado: {outcome['slug']} "
                    f"({outcome['yesPriceBps'] / 100:.2f}%)"
                )
            else:
                print(f"Mercado ativo já sincronizado: {outcome['slug']}")
            continue

        if outcome["marketStatus"] != "resolved_no":
            continue

        detail = request("GET", f"/markets/{market['id']}")["market"]
        if detail["status"] == "settled":
            if not detail["resolution"] or detail["resolution"]["outcome"] != "no":
                fail(f"{outcome['slug']} is settled with an unexpected outcome")
            print(f"Já liquidado: {outcome['slug']}")
            continue
        if detail["status"] in {"cancelled", "voided", "disputed"}:
            fail(f"{outcome['slug']} has incompatible status {detail['status']}")

        if detail["resolution"] is None:
            request(
                "POST",
                f"/internal/markets/{market['id']}/resolve",
                {
                    "outcome": "no",
                    "evidenceSummary": (
                        f"Status espelhado da Polymarket em {data['updatedAt']}: "
                        "o contrato correspondente está resolvido como Não. "
                        "Este registro documenta o espelhamento do mercado de "
                        "referência e não afirma que a eleição presidencial "
                        "brasileira de 2026 já tenha vencedor definitivo."
                    ),
                    "evidenceSources": [SOURCE_EVENT_URL],
                    "approvedBy": "polymarket-sync-2026-10-05",
                },
            )
            print(f"Resolução No registrada: {outcome['candidate']}")
        elif detail["resolution"]["outcome"] != "no":
            fail(
                f"{outcome['slug']} already has an unexpected "
                f"resolution: {detail['resolution']['outcome']}"
            )

        settled = request("POST", f"/internal/markets/{market['id']}/settle")
        print(
            f"Liquidado: {outcome['candidate']} "
            f"(payouts={len(settled.get('payouts', []))})"
        )

    print(
        "Sincronização concluída. Os quatro mercados auxiliares do evento "
        "não foram modificados."
    )


if __name__ == "__main__":
    main()
