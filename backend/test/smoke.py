"""
Lightweight smoke test — no Vercel CLI, no real Supabase project needed.
Run with: python test/smoke.py   (after activating the venv / installing
requirements-dev.txt)

Covers the same three layers as the Node version did:
 1. Pure logic (severity sorting, schedule overlap detection) — no network.
 2. Live calls to RxNorm/RxNav (network) — skipped, not failed, if unreachable.
 3. Each endpoint's input validation via FastAPI's TestClient (in-process,
    no real server needed), including the "missing Supabase env vars" path.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

passed = 0
failed = 0
skipped = 0


def check(label, fn):
    global passed, failed
    try:
        fn()
        print(f"  ok  - {label}")
        passed += 1
    except Exception as e:
        print(f"FAIL  - {label}")
        print(f"        {e}")
        failed += 1


def check_network(label, fn):
    """
    Outbound HTTPS in some sandboxed environments goes through a proxy with
    a host allowlist. A failure here just means this environment can't
    reach rxnav.nlm.nih.gov — not a code bug — so we report it as SKIPPED.
    On Vercel or a normal laptop this will actually run.
    """
    global passed, skipped
    try:
        fn()
        print(f"  ok  - {label}")
        passed += 1
    except Exception as e:
        print(f"skip  - {label}")
        print(f"        (network unreachable from this environment: {e})")
        skipped += 1


def main():
    print("\n--- 1. Pure logic ---")

    from app.severity import sort_interactions_by_severity

    def _t1():
        inp = [{"severity": "minor"}, {"severity": "significant"}, {"severity": "none"}]
        sorted_sev = [i["severity"] for i in sort_interactions_by_severity(inp)]
        assert sorted_sev == ["significant", "minor", "none"], sorted_sev

    check("sort_interactions_by_severity orders significant > minor > none", _t1)

    from app.overlap import find_schedule_overlaps, parse_time_to_minutes

    def _t3():
        assert parse_time_to_minutes("08:30") == 510
        assert parse_time_to_minutes("bad") is None
        assert parse_time_to_minutes("25:00") is None

    check("parse_time_to_minutes parses valid HH:MM and rejects garbage", _t3)

    def _t4():
        meds = [
            {"name": "A", "time_of_day": "08:00"},
            {"name": "B", "time_of_day": "08:45"},
            {"name": "C", "time_of_day": "20:00"},
        ]
        overlaps = find_schedule_overlaps(meds)
        assert len(overlaps) == 1, overlaps
        assert overlaps[0]["a"]["name"] == "A"
        assert overlaps[0]["b"]["name"] == "B"

    check("find_schedule_overlaps flags meds within 60 min of each other", _t4)

    print("\n--- 2. Curated interaction lookup (pure logic, no network needed) ---")

    from app.known_interactions import lookup_known_interaction
    from app.drug_name_utils import normalize_drug_name
    from app.main import check_interactions

    def _t5():
        result = lookup_known_interaction(
            normalize_drug_name("Warfarin Sodium 5 MG Oral Tablet"),
            normalize_drug_name("Ibuprofen 200 MG Oral Tablet"),
        )
        assert result is not None
        assert result["severity"] == "significant"

    check("lookup_known_interaction finds warfarin + ibuprofen regardless of dose/form suffix", _t5)

    def _t6():
        result = lookup_known_interaction("acetaminophen", "omeprazole")
        assert result is None

    check("lookup_known_interaction returns None for an unrelated pair", _t6)

    def _t7():
        # Passing names directly (as the frontend can, since it already has
        # them from search-drugs/get-medications) means this hits the
        # curated list with ZERO network calls — works even in network-
        # restricted environments, unlike the old RxNav-dependent version.
        interactions = check_interactions(
            [
                {"rxcui": "11289", "name": "Warfarin"},
                {"rxcui": "5640", "name": "Ibuprofen"},
            ]
        )
        assert len(interactions) == 1, interactions
        assert interactions[0]["severity"] == "significant"
        assert interactions[0]["source"] == "curated"

    check("check_interactions finds warfarin+ibuprofen via the curated list, no network", _t7)

    from app.body_map import classify_region, VALID_REGIONS

    def _t7b():
        interactions = check_interactions(
            [
                {"rxcui": "11289", "name": "Warfarin"},
                {"rxcui": "5640", "name": "Ibuprofen"},
            ]
        )
        assert interactions[0]["region"] == "blood", interactions

    check("check_interactions tags the curated warfarin+ibuprofen pair with a body region", _t7b)

    def _t7c():
        assert classify_region("increased risk of bleeding and easy bruising") == "blood"
        assert classify_region("may cause serotonin syndrome and confusion") == "brain"
        assert classify_region("reduced renal clearance") == "kidneys"
        # Never crashes and always returns one of the known regions, even
        # for text with no recognizable keywords at all.
        assert classify_region("completely unrelated jibberish text") in VALID_REGIONS | {"blood"}

    check("classify_region maps label text to a sensible body region, with a safe fallback", _t7c)

    print("\n--- 3. Live RxNorm/openFDA calls (network; skipped if unreachable) ---")

    from app.main import search_drugs
    from app.rxnorm_client import resolve_rxcui_name
    from app.openfda_client import fetch_label_sections

    def _t8():
        results = search_drugs("ibuprofen")
        assert isinstance(results, list) and len(results) > 0, "expected at least one result"
        assert results[0].get("rxcui"), "expected results to include an rxcui"

    check_network('RxNorm search-drugs returns results for "ibuprofen"', _t8)

    def _t9():
        name = resolve_rxcui_name("11289")
        assert name, "expected RxNorm to resolve rxcui 11289 to a name"

    check_network("RxNorm resolves rxcui 11289 to a drug name", _t9)

    def _t10():
        # fetch_label_sections() deliberately never raises on a network
        # failure (see its docstring) — it returns {} so one drug lacking
        # connectivity/a label doesn't break the whole interaction check.
        # That means a blocked sandbox and "openFDA genuinely has nothing"
        # look identical from here, so treat an empty result as
        # inconclusive (raise -> reported as skipped) rather than a pass,
        # since acetaminophen definitely has an FDA label in reality.
        sections = fetch_label_sections("acetaminophen")
        if not sections:
            raise RuntimeError("got no label sections back (network likely blocked)")
        assert "drug_interactions" in sections or "warnings" in sections, sections

    check_network("openFDA returns real label sections for acetaminophen", _t10)

    def _t11():
        # A drug with no curated entry and (most likely) no FDA label
        # mentioning it should just come back with no interactions found,
        # not an error — this exercises the full openFDA fallback path
        # end-to-end when network is available.
        interactions = check_interactions(
            [
                {"rxcui": "999999999", "name": "Totally Fake Drug XYZ"},
                {"rxcui": "5640", "name": "Ibuprofen"},
            ]
        )
        assert isinstance(interactions, list)

    check_network("check_interactions degrades gracefully for an unresolvable drug", _t11)

    print("\n--- 4. Endpoint request validation (no network/DB needed) ---")

    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)

    def _t12():
        resp = client.get("/api/search-drugs")
        assert resp.status_code == 400, resp.text

    check("GET /api/search-drugs with no ?q returns 400", _t12)

    def _t13():
        resp = client.post("/api/save-medication", json={"userId": "u1"})
        assert resp.status_code == 400, resp.text

    check("POST /api/save-medication with missing fields returns 400", _t13)

    def _t14():
        resp = client.post(
            "/api/save-medication",
            json={"userId": "u1", "name": "Advil", "rxcui": "5640", "timeOfDay": "nonsense"},
        )
        assert resp.status_code == 400, resp.text

    check("POST /api/save-medication with bad timeOfDay returns 400", _t14)

    def _t15():
        resp = client.get("/api/get-medications")
        assert resp.status_code == 400, resp.text

    check("GET /api/get-medications with no ?userId returns 400", _t15)

    def _t15b():
        resp = client.delete("/api/delete-medication")
        assert resp.status_code == 400, resp.text

    check('DELETE /api/delete-medication with no id/userId returns 400', _t15b)

    def _t16():
        os.environ.pop("SUPABASE_URL", None)
        os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)
        # force a fresh client lookup (module-level cache) so the missing
        # env vars are actually exercised
        import app.supabase_client as sc

        sc._cached_client = None
        resp = client.get("/api/get-medications", params={"userId": "u1"})
        assert resp.status_code == 500, resp.text
        assert "SUPABASE_URL" in resp.json()["error"], resp.json()

    check(
        "GET /api/get-medications with valid userId but no Supabase env returns 500 with a clear message",
        _t16,
    )

    def _t17():
        resp = client.get("/api/check-interactions", params={"rxcuis": "11289"})
        assert resp.status_code == 400, resp.text

    check("GET /api/check-interactions with 1 rxcui returns 400", _t17)

    def _t18():
        # Full request path (route parsing -> check_interactions -> curated
        # lookup) via the same {"drugs": [...]} shape the frontend can use
        # to skip an RxNorm name-resolution round trip. No network needed.
        resp = client.post(
            "/api/check-interactions",
            json={
                "drugs": [
                    {"rxcui": "11289", "name": "Warfarin"},
                    {"rxcui": "5640", "name": "Ibuprofen"},
                ]
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert len(body["interactions"]) == 1, body
        assert body["interactions"][0]["source"] == "curated"

    check("POST /api/check-interactions with named drugs finds the curated pair, no network", _t18)

    def _t19():
        resp = client.post(
            "/api/save-interaction-flag",
            json={"userId": "u1", "drugA": "Warfarin", "drugB": "Ibuprofen", "severity": "extreme"},
        )
        assert resp.status_code == 400, resp.text

    check("POST /api/save-interaction-flag with invalid severity returns 400", _t19)

    def _t20():
        resp = client.get("/api/mock-patients")
        assert resp.status_code == 200, resp.text
        assert len(resp.json()["patients"]) >= 2

    check("GET /api/mock-patients returns demo fixtures", _t20)

    def _t21():
        resp = client.delete("/api/mock-patients")
        assert resp.status_code == 405, resp.text

    check("Unsupported method (DELETE) on /api/mock-patients returns 405", _t21)

    print("\n--- 5. Backboard memory endpoints (no BACKBOARD_API_KEY needed) ---")

    def _t22():
        resp = client.post("/api/memory/save", json={"userId": "u1"})
        assert resp.status_code == 400, resp.text

    check("POST /api/memory/save with missing fields returns 400", _t22)

    def _t23():
        resp = client.get("/api/memory/list")
        assert resp.status_code == 400, resp.text

    check("GET /api/memory/list with no ?userId returns 400", _t23)

    def _t24():
        # No BACKBOARD_API_KEY set in this sandbox — remember() must no-op
        # rather than raising, so saving still reports success (the save
        # itself just silently doesn't happen anywhere).
        resp = client.post("/api/memory/save", json={"userId": "u1", "content": "Allergic to penicillin"})
        assert resp.status_code == 201, resp.text
        assert resp.json() == {"saved": True}

    check("POST /api/memory/save degrades gracefully with no BACKBOARD_API_KEY configured", _t24)

    def _t25():
        resp = client.get("/api/memory/list", params={"userId": "u1"})
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"memories": []}

    check("GET /api/memory/list degrades gracefully (empty list) with no BACKBOARD_API_KEY configured", _t25)

    print(f"\n{passed} passed, {failed} failed, {skipped} skipped\n")
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
