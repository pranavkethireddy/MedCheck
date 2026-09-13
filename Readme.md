# MedCheck

### Know before you mix.

Built for **HackRice 16**.

People take a prescription, then grab ibuprofen for a headache or start a
supplement they saw online — with no idea whether it's safe to combine.
MedCheck lets you enter everything you take (prescription, over-the-counter,
and supplements) and flags risky combinations in plain English, framed as a
conversation-starter for your pharmacist or doctor — never a diagnosis, and
never a replacement for real medical advice.

## What it does

- **Medication tracking.** Search and add anything you take, with autocomplete
  backed by RxNorm. Set a time of day for each one and see your full daily
  schedule, including anything scheduled too close together.
- **Interaction checking.** Every pair of medications is checked against a
  curated list of well-documented interactions, then against live FDA label
  text (openFDA) for anything not already covered — sorted by severity
  (significant / minor / none), with a body map showing where each
  interaction actually happens.
- **Plain-language explanations.** Every flagged interaction and an overall
  risk summary are rewritten in calm, non-alarming language by Gemini —
  falling back gracefully to a clear non-AI explanation if the AI is
  unavailable, so the app never breaks over an API hiccup.
- **Caregiver mode.** Share a read-only view of your medications with a
  caregiver via an access code. Caregivers can check in on multiple people,
  mark doses as taken, and — hands-free — just ask: *"switch to Grandma,"*
  *"mark Warfarin as taken,"* or any question about the person they're
  viewing, spoken and answered out loud (ElevenLabs speech-to-text and
  text-to-speech, interpreted by Gemini).
- **Persistent memory.** MedCheck remembers what it's told about you —
  medications, flagged interactions, notes — across sessions, powered by
  Backboard, so you don't have to repeat yourself every visit.
- **A professional printable summary.** Export a clean, print-ready PDF of
  your medications and flagged interactions to bring to an appointment.
- **Sign in with email or Google**, dark mode, and a dashboard with an
  at-a-glance risk gauge, stat widgets, and an onboarding checklist for new
  users.

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | React (Vite) |
| Backend | FastAPI (Python) |
| Database & auth | Supabase (Postgres + built-in auth, email + Google OAuth) |
| Drug data | RxNorm + openFDA (free, no key required) |
| Plain-language explanations, risk summaries, voice command interpretation | Google Gemini |
| Voice | ElevenLabs (speech-to-text + text-to-speech) |
| Persistent memory | Backboard |
| Hosting | Vercel |

Interaction explanations/risk summaries and the voice assistant run on two
independent Gemini API keys, so a burst of usage on one feature can't
rate-limit the other — see `backend/README.md` for setup.

## Prize tracks

Healthcare, Best Use of Gemini, Best Use of ElevenLabs, Best Use of Backboard, Best Domain Name from GoDaddy Registry.

## Project structure

```
backend/    FastAPI app — see backend/README.md for endpoints, setup, and
            environment variables (Supabase, Gemini x2, ElevenLabs, Backboard)
frontend/   React app (Vite) — see frontend/README.md
plan.md     Original project/build plan
```

## Running it locally

See `backend/README.md` and `frontend/README.md` for full setup —
short version: each side needs its own `.env`,
then `uvicorn app.main:app --reload --port 3000` for the backend and
`npm run dev` for the frontend.

## A note on scope

MedCheck is a hackathon project, not a certified medical device or a HIPAA-
compliant clinical system — it's built to start a conversation with a real
pharmacist or doctor, not replace one. `backend/README.md` documents the
specific shortcuts taken for the sake of a 24-hour build (and what
production-hardening would look like) rather than glossing over them.

## Team

Built by a 3-person team (Pranav Kethireddy, Harish Napa, Navyashree Balasubramaniyan Nagarajan) at HackRice 16.