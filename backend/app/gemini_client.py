import json
import os
import urllib.request
import urllib.error
import concurrent.futures

GEMINI_MODEL = "gemini-2.5-flash"


def build_prompt(description: str, drugs: list) -> str:
    drug_text = " + ".join(drugs) if drugs else "unspecified"
    return (
        "Rewrite this drug interaction warning in plain, calm, non-alarming\n"
        "English for a regular person with no medical background. Keep it to 2-3 sentences.\n"
        "Do not add a diagnosis or tell them what to do medically — just explain what the\n"
        "interaction is in plain terms and suggest they mention it to their pharmacist or doctor.\n\n"
        f"Drugs involved: {drug_text}\n"
        f'Warning: "{description}"'
    )


def call_gemini(prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is missing. Check .env exists and contains "
            "GEMINI_API_KEY=your-key-here"
        )

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "thinkingConfig": {"thinkingBudget": 0},  # not needed for a short rewrite — faster this way
            "maxOutputTokens": 200,
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=10) as response:
        data = json.loads(response.read().decode("utf-8"))

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return ""


def _safe_explain(interaction: dict) -> str:
    """
    Wraps call_gemini so one failed explanation (bad key, network blip,
    rate limit) can't take down the whole /api/check-interactions response.
    Falls back to the raw description — worse than a rewrite, but still
    usable — rather than crashing the request.
    """
    try:
        return call_gemini(build_prompt(interaction["description"], interaction["drugs"]))
    except Exception as e:
        print(f"Gemini explanation failed for {interaction.get('drugs')}: {e}")
        return interaction["description"]


def explain_interactions(interactions: list) -> list:
    """
    Takes the list check_interactions() in main.py already produces —
    each item already has "description" and "drugs" — and adds an
    "explanation" key to each one, in parallel since these are independent
    network calls. A failure on one interaction never blocks the others.
    """
    if not interactions:
        return interactions

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        explanations = list(pool.map(_safe_explain, interactions))

    for interaction, explanation in zip(interactions, explanations):
        interaction["explanation"] = explanation

    return interactions