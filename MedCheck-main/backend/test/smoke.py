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

    from app.voice_assistant import _parse_response

    def _t4a():
        raw = (
            '{"action": "switch_patient", "targetPatientName": "Grandma", '
            '"medicationName": null, "code": null, "responseText": "Switching to Grandma."}'
        )
        result = _parse_response(raw)
        assert result["action"] == "switch_patient"
        assert result["targetPatientName"] == "Grandma"

    check("voice_assistant._parse_response parses well-formed JSON", _t4a)

    def _t4b():
        # Gemini sometimes wraps JSON in ```json fences despite being told
        # not to -- must still extract it rather than failing.
        raw = '```json\n{"action": "mark_taken", "medicationName": "Warfarin", "responseText": "Got it."}\n```'
        result = _parse_response(raw)
        assert result["action"] == "mark_taken"
        assert result["medicationName"] == "Warfarin"

    check("voice_assistant._parse_response extracts JSON from a code fence", _t4b)

    def _t4c():
        # Not JSON at all -- must fall back to a spoken "answer" using the
        # raw text, rather than raising and losing the whole interaction.
        raw = "I'm not sure how to help with that."
        result = _parse_response(raw)
        assert result["action"] == "answer"
        assert result["responseText"] == raw

    check("voice_assistant._parse_response falls back gracefully on non-JSON text", _t4c)

    def _t4d():
        # An action Gemini invents that isn't one of the five valid ones
        # must be coerced to "answer" rather than propagated as-is.
        raw = '{"action": "delete_everything", "responseText": "Sure thing."}'
        result = _parse_response(raw)
        assert result["action"] == "answer"

    check("voice_assistant._parse_response coerces an invalid action to answer", _t4d)

    import threading as _threading
    import urllib.error as _urllib_error
    import app.gemini_client as _gc

    def _t4e():
        # Regression test for the exact bug reported live: several
        # concurrent requests for the SAME interaction explanation (the
        # app's several self-fetching components all asking for the same
        # medication list at once) must only ever trigger ONE real call to
        # Gemini — not one per caller — or normal use multiplies straight
        # into the free-tier rate limit. See _cached_gemini_call's
        # single-flight design in gemini_client.py.
        _gc._cache.clear()
        _gc._pending.clear()
        _gc._circuit_open_until = 0

        call_count = {"n": 0}
        count_lock = _threading.Lock()

        def fake_call_gemini(prompt):
            with count_lock:
                call_count["n"] += 1
            _threading.Event().wait(0.05)  # simulate a slow network call
            return "explained!"

        real_call_gemini = _gc.call_gemini
        _gc.call_gemini = fake_call_gemini
        try:
            interaction = {"drugs": ["Warfarin", "Ibuprofen"], "description": "bleeding risk"}
            results = []
            threads = [_threading.Thread(target=lambda: results.append(_gc._safe_explain(dict(interaction)))) for _ in range(6)]
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=5)
        finally:
            _gc.call_gemini = real_call_gemini

        assert call_count["n"] == 1, f"expected exactly 1 real Gemini call, got {call_count['n']}"
        assert all(r == "explained!" for r in results), results

    check("gemini_client dedupes concurrent identical explanation requests (single-flight)", _t4e)

    def _t4f():
        # Once Gemini genuinely rate-limits us (a 429 that survives the
        # retry), the circuit breaker must stop hitting the network at all
        # for a cooldown window -- otherwise every subsequent request pays
        # the same latency/quota cost during an outage that's already
        # confirmed to be happening.
        _gc._cache.clear()
        _gc._pending.clear()
        _gc._circuit_open_until = 0
        # This test needs GEMINI_API_KEY set so call_gemini gets far enough
        # to hit the (faked) network call instead of short-circuiting on
        # "missing key" — restored below so later tests that specifically
        # rely on no key being configured (e.g. the /api/risk-summary and
        # /api/voice/assistant "degrades gracefully" tests) aren't affected.
        had_key = "GEMINI_API_KEY" in os.environ
        old_key = os.environ.get("GEMINI_API_KEY")
        os.environ["GEMINI_API_KEY"] = "fake-key-for-test"
        _gc.RETRY_BASE_DELAY_SECONDS = 0.01

        def fake_urlopen(req, timeout=10):
            raise _urllib_error.HTTPError("http://x", 429, "Too Many Requests", None, None)

        real_urlopen = _gc.urllib.request.urlopen
        _gc.urllib.request.urlopen = fake_urlopen
        try:
            try:
                _gc.call_gemini("hello")
                raise AssertionError("expected call_gemini to raise on a 429")
            except _urllib_error.HTTPError:
                pass
            assert _gc._circuit_is_open(), "circuit should be open after retries are exhausted on a 429"

            import time as _time
            start = _time.time()
            try:
                _gc.call_gemini("hello again")
                raise AssertionError("expected call_gemini to raise while circuit is open")
            except RuntimeError as e:
                assert "cooldown" in str(e).lower(), e
            elapsed = _time.time() - start
            assert elapsed < 0.05, f"circuit-open call should be near-instant, took {elapsed}s"
        finally:
            _gc.urllib.request.urlopen = real_urlopen
            _gc._circuit_open_until = 0
            if had_key:
                os.environ["GEMINI_API_KEY"] = old_key
            else:
                os.environ.pop("GEMINI_API_KEY", None)

    check("gemini_client's circuit breaker trips on a real 429 and short-circuits instantly after", _t4f)

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

    def _t15c():
        resp = client.patch("/api/update-medication", json={"id": "m1"})
        assert resp.status_code == 400, resp.text

    check('PATCH /api/update-medication with no userId returns 400', _t15c)

    def _t15d():
        resp = client.patch(
            "/api/update-medication",
            json={"id": "m1", "userId": "u1", "timeOfDay": "nonsense"},
        )
        assert resp.status_code == 400, resp.text

    check("PATCH /api/update-medication with bad timeOfDay returns 400", _t15d)

    def _t15e():
        # timeOfDay is optional on this endpoint (clearing a time back to
        # blank is a valid use), so omitting it entirely must NOT 400 --
        # only a missing id/userId should.
        resp = client.patch("/api/update-medication", json={"id": "m1", "userId": "u1"})
        assert resp.status_code != 400, resp.text

    check("PATCH /api/update-medication with no timeOfDay (clearing) passes validation", _t15e)

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

    def _t18b():
        # No GEMINI_API_KEY in this environment, so summarize_risk() falls
        # back to its plain, non-AI summary built from interaction counts
        # (see gemini_client.py) rather than 500ing the request.
        resp = client.post(
            "/api/risk-summary",
            json={
                "medications": [{"name": "Warfarin"}, {"name": "Ibuprofen"}],
                "interactions": [
                    {"drugs": ["Warfarin", "Ibuprofen"], "severity": "significant", "description": "bleeding risk"}
                ],
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "significant" in body["summary"].lower(), body

    check("POST /api/risk-summary degrades gracefully with no GEMINI_API_KEY configured", _t18b)

    def _t18c():
        resp = client.post("/api/risk-summary", json={"medications": [], "interactions": []})
        assert resp.status_code == 200, resp.text
        assert "no known interactions" in resp.json()["summary"].lower()

    check("POST /api/risk-summary with no interactions returns the reassuring fallback", _t18c)

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

    print("\n--- 5. Caregiver linking endpoints (no Supabase project needed for validation) ---")

    def _t21a():
        resp = client.get("/api/caregiver/my-code")
        assert resp.status_code == 400, resp.text

    check("GET /api/caregiver/my-code with no ?userId returns 400", _t21a)

    def _t21b():
        resp = client.post("/api/caregiver/link", json={"callerId": "u1"})
        assert resp.status_code == 400, resp.text

    check("POST /api/caregiver/link with missing code returns 400", _t21b)

    def _t21c():
        resp = client.get("/api/caregiver/patients")
        assert resp.status_code == 400, resp.text

    check("GET /api/caregiver/patients with no ?callerId returns 400", _t21c)

    def _t21d():
        resp = client.get("/api/caregiver/patient-medications", params={"callerId": "u1"})
        assert resp.status_code == 400, resp.text

    check(
        "GET /api/caregiver/patient-medications with missing patientId returns 400",
        _t21d,
    )

    def _t21e():
        # Same "no Supabase project configured" path as get-medications
        # above (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY were already popped
        # by _t16, and app.supabase_client._cached_client is already reset).
        resp = client.get("/api/caregiver/my-code", params={"userId": "u1"})
        assert resp.status_code == 500, resp.text
        assert "SUPABASE_URL" in resp.json()["error"], resp.json()

    check(
        "GET /api/caregiver/my-code with valid userId but no Supabase env returns 500 with a clear message",
        _t21e,
    )

    print("\n--- 6. Backboard memory endpoints (no BACKBOARD_API_KEY needed) ---")

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

    check(
        "POST /api/memory/save degrades gracefully with no BACKBOARD_API_KEY configured",
        _t24,
    )

    def _t25():
        resp = client.get("/api/memory/list", params={"userId": "u1"})
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"memories": []}

    check("GET /api/memory/list degrades gracefully (empty list) with no BACKBOARD_API_KEY configured", _t25)

    print("\n--- 7. Caregiver dose log + ElevenLabs voice endpoints ---")

    def _t26():
        resp = client.post("/api/caregiver/log-medication-taken", json={"callerId": "c1"})
        assert resp.status_code == 400, resp.text

    check("POST /api/caregiver/log-medication-taken with missing fields returns 400", _t26)

    def _t27():
        resp = client.get("/api/caregiver/medication-log", params={"callerId": "c1"})
        assert resp.status_code == 400, resp.text

    check("GET /api/caregiver/medication-log with missing patientId returns 400", _t27)

    def _t28():
        # No caregiver_links row for this pair -- and no Supabase project
        # configured in this sandbox either, so this actually exercises the
        # "Supabase env missing" 500 path rather than the 403 path (which
        # needs a real DB round trip to distinguish). Both are exercised
        # for the sibling /api/caregiver/patient-medications endpoint in
        # the fake-Supabase integration check run separately from this
        # file; this smoke test only confirms the validation layer here.
        resp = client.post(
            "/api/caregiver/log-medication-taken",
            json={"callerId": "c1", "patientId": "p1", "medicationName": "Warfarin"},
        )
        assert resp.status_code == 500, resp.text

    check(
        "POST /api/caregiver/log-medication-taken with valid fields but no Supabase env returns 500",
        _t28,
    )

    def _t29():
        resp = client.post("/api/voice/speak", json={})
        assert resp.status_code == 400, resp.text

    check("POST /api/voice/speak with missing text returns 400", _t29)

    def _t30():
        # No ELEVENLABS_API_KEY set in this sandbox -- must surface as a
        # clear 502, not crash the process or return malformed audio.
        resp = client.post("/api/voice/speak", json={"text": "Warfarin and ibuprofen may interact."})
        assert resp.status_code == 502, resp.text
        assert "ELEVENLABS_API_KEY" in resp.json()["error"], resp.json()

    check(
        "POST /api/voice/speak with no ELEVENLABS_API_KEY configured returns a clear 502",
        _t30,
    )

    def _t31():
        resp = client.post("/api/voice/transcribe", files={"audio": ("empty.webm", b"", "audio/webm")})
        assert resp.status_code == 400, resp.text

    check("POST /api/voice/transcribe with an empty audio file returns 400", _t31)

    def _t32():
        resp = client.post(
            "/api/voice/transcribe", files={"audio": ("clip.webm", b"not-real-audio-bytes", "audio/webm")}
        )
        assert resp.status_code == 502, resp.text
        assert "ELEVENLABS_API_KEY" in resp.json()["error"], resp.json()

    check(
        "POST /api/voice/transcribe with no ELEVENLABS_API_KEY configured returns a clear 502",
        _t32,
    )

    def _t33():
        resp = client.post("/api/voice/assistant", json={})
        assert resp.status_code == 400, resp.text

    check("POST /api/voice/assistant with missing transcript returns 400", _t33)

    def _t34():
        # No GEMINI_API_KEY set in this sandbox either -- call_gemini raises,
        # and api_voice_assistant must turn that into a clear 502 rather
        # than a bare 500 stack trace.
        resp = client.post("/api/voice/assistant", json={"transcript": "switch to grandma"})
        assert resp.status_code == 502, resp.text

    check(
        "POST /api/voice/assistant with no GEMINI_API_KEY configured returns a clear 502",
        _t34,
    )

    print(f"\n{passed} passed, {failed} failed, {skipped} skipped\n")
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
