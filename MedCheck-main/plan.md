# MedCheck — Know Before You Mix
### HackRice 16 Project Plan (Healthcare Track)

---

## 1. The Pitch

People take a prescription, then grab ibuprofen for a headache or start a supplement they saw online — with no idea if it interacts. **MedCheck** lets users enter their current medications (prescription + OTC + supplements) and flags dangerous or risky combinations in plain English, framed as a **conversation-starter with a pharmacist or doctor** — not a diagnosis.

**Track:** Healthcare

---

## 2. Tech Stack

| Layer | Tool |
|---|---|
| Database / Auth / Storage | **Supabase** (Postgres + built-in auth + realtime) |
| AI memory / persistent context | **Backboard** (remembers user's meds & history across sessions) |
| Drug data | RxNorm + OpenFDA (free, no key) |
| Plain-English explanations | Claude API (or Gemini, see challenge notes below) |
| Voice | ElevenLabs |
| Frontend | React |
| Hosting | **Vercel** (free tier) |
| Domain | GoDaddy Registry |

---

## 3. Core Flow (Build This First)

1. User signs up / logs in (**Supabase Auth**)
2. User adds medications via search/autocomplete (RxNorm) → saved to **Supabase** table
3. Backend checks all pairwise combinations for known interactions (RxNav Interaction API)
4. Results shown sorted by severity: **None / Minor — be aware / Significant — talk to your provider**
5. Plain-English explanation for each flag (Claude/Gemini)
6. "Questions to ask your provider" list auto-generated for anything flagged high-severity
7. All of the above persists across sessions via **Supabase** (stored data) + **Backboard** (AI memory/context)

---

## 4. Supabase Setup

### 4a. Database schema

```sql
-- users table is handled automatically by Supabase Auth

create table medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  rxcui text not null,
  time_of_day text, -- e.g. "08:00", used for the timeline/schedule wow layer
  created_at timestamp default now()
);

create table interaction_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  drug_a text not null,
  drug_b text not null,
  severity text not null, -- 'none' | 'minor' | 'significant'
  raw_description text,
  plain_explanation text,
  created_at timestamp default now()
);
```

### 4b. Supabase client setup

```javascript
// supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 4c. Save a medication to Supabase

```javascript
// saveMedication.js
import { supabase } from './supabaseClient';

async function saveMedication(userId, name, rxcui, timeOfDay) {
  const { data, error } = await supabase
    .from('medications')
    .insert([{ user_id: userId, name, rxcui, time_of_day: timeOfDay }]);

  if (error) console.error('Error saving medication:', error);
  return data;
}
```

### 4d. Fetch a user's medications

```javascript
// getMedications.js
import { supabase } from './supabaseClient';

async function getMedications(userId) {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', userId);

  if (error) console.error('Error fetching medications:', error);
  return data;
}
```

### 4e. Save an interaction flag result

```javascript
// saveInteractionFlag.js
import { supabase } from './supabaseClient';

async function saveInteractionFlag(userId, drugA, drugB, severity, rawDescription, plainExplanation) {
  const { data, error } = await supabase
    .from('interaction_flags')
    .insert([{
      user_id: userId,
      drug_a: drugA,
      drug_b: drugB,
      severity,
      raw_description: rawDescription,
      plain_explanation: plainExplanation
    }]);

  if (error) console.error('Error saving flag:', error);
  return data;
}
```

### 4f. Supabase Auth (sign up / log in)

```javascript
// auth.js
import { supabase } from './supabaseClient';

async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) console.error('Sign up error:', error);
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) console.error('Sign in error:', error);
  return data;
}
```

---

## 5. Drug Data & Interaction Logic (Free, No Key Needed)

### 5a. Drug name autocomplete (RxNorm)

```javascript
// searchDrugs.js
async function searchDrugs(query) {
  const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const data = await res.json();

  const groups = data?.drugGroup?.conceptGroup || [];
  const results = [];
  groups.forEach(group => {
    (group.conceptProperties || []).forEach(drug => {
      results.push({ name: drug.name, rxcui: drug.rxcui });
    });
  });
  return results;
}
```

### 5b. Check interactions between two or more drugs

```javascript
// checkInteractions.js
async function checkInteractions(rxcuiList) {
  const rxcuis = rxcuiList.join("+");
  const url = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuis}`;
  const res = await fetch(url);
  const data = await res.json();

  const interactions = [];
  (data?.fullInteractionTypeGroup || []).forEach(group => {
    (group.fullInteractionType || []).forEach(interaction => {
      (interaction.interactionPair || []).forEach(pair => {
        interactions.push({
          severity: pair.severity || "unknown",
          description: pair.description,
          drugs: interaction.minConcept.map(d => d.name)
        });
      });
    });
  });
  return interactions;
}
```

### 5c. Severity sorting

```javascript
// sortBySeverity.js
const SEVERITY_ORDER = { "high": 3, "moderate": 2, "low": 1, "unknown": 0 };

function sortInteractionsBySeverity(interactions) {
  return [...interactions].sort(
    (a, b) => (SEVERITY_ORDER[b.severity?.toLowerCase()] || 0) -
              (SEVERITY_ORDER[a.severity?.toLowerCase()] || 0)
  );
}
```

### 5d. Mock patient data for demo (no real bottle needed)

```javascript
// mockPatients.js
const mockPatients = [
  {
    name: "Demo Patient — Grandma",
    medications: [
      { name: "Warfarin", rxcui: "11289" },
      { name: "Ibuprofen", rxcui: "5640" },
      { name: "Lisinopril", rxcui: "29046" }
    ]
  },
  {
    name: "Demo Patient — College Student",
    medications: [
      { name: "Sertraline", rxcui: "312938" },
      { name: "Tramadol", rxcui: "10689" }
    ]
  }
];

module.exports = mockPatients;
```

---

## 6. Plain-English Explanation Layer (Claude API)

```javascript
// explainInteraction.js
async function explainInteraction(rawDescription) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Rewrite this drug interaction warning in plain, calm, 
          non-alarming English for a regular person with no medical background. 
          Keep it to 2-3 sentences. Do not add a diagnosis or tell them what to do 
          medically — just explain what the interaction is and suggest they 
          mention it to their pharmacist or doctor.
          
          Warning: "${rawDescription}"`
        }
      ]
    })
  });
  const data = await response.json();
  return data.content.find(c => c.type === "text")?.text || "";
}
```

*(Swap this for a Gemini API call if you want to also qualify for the Gemini challenge — see section 8.)*

---

## 7. "Wow Layer" Features (Add On Top, In Priority Order)

### 🥇 Priority 1 — Body map visualization
A human silhouette that lights up (color-coded by severity) in the organ/system affected by a flagged interaction. The biggest visual "wow" for judges.

### 🥈 Priority 2 — Timeline/schedule view
Let users enter *when* they take each medication (stored in the `time_of_day` column in Supabase) and flag same-window overlaps. Novel angle vs. commercial interaction checkers — strong for "Originality."

### 🥉 Priority 3 — Gemini-powered second explanation mode
Add a toggle that runs the same explanation prompt through Gemini instead of Claude, to qualify for MLH's Gemini challenge with minimal extra work.

### Priority 4 — Persistent memory (Backboard)
Use Backboard so the AI layer remembers a user's medication history, past flags, and preferences across sessions — no re-entering everything each time. This directly qualifies for MLH's Backboard challenge and is a genuinely useful feature, not a forced integration.

### Priority 5 — Voice explainer (ElevenLabs)
Flagged interactions read aloud in a calm voice instead of just displayed as text. Good accessibility story + qualifies for MLH's ElevenLabs challenge.

### Priority 6 (stretch, optional) — Barcode/photo scan
Scan a pill bottle barcode (OpenFDA NDC lookup) instead of typing manually. Flashy but fragile live — build manual entry first, treat this as bonus polish only if time allows.

---

## 8. Sponsor & MLH Challenge Fit

| Challenge | Fits MedCheck? | Why |
|---|---|---|
| **Healthcare Track** | ✅ Core | Direct fit — this is the track |
| **ElevenLabs** — Best Use of ElevenLabs | ✅ Strong | Voice explainer is a real, substantive feature |
| **Backboard** — Best Use of Backboard | ✅ Strong | Persistent memory of meds/history across sessions is literally their example use case |
| **Gemini** — Best Use of Gemini API | ✅ Easy | Swap or add a Gemini call for plain-English explanations |
| **GoDaddy Registry** — Best Domain Name | ⚠️ Trivial | Register a domain through them — near-zero effort |
| **Vultr** — Best Use of Vultr | ❌ Dropped | Hosting moved to Vercel's free tier to keep costs at zero — if you have spare time/credits later and want the extra prize shot, you could still deploy a secondary instance on Vultr, but it's not part of the core plan |
| **Tiger Data** — Best Use of Tiger Data | ⚠️ Optional | Only worth it if you want Postgres-based time-series specifically; since you're already using Supabase (also Postgres) for your core data, skip this to avoid a redundant/competing database layer |
| **Persona / Capital One / Solana / Presage / MathWorks** | ❌ Skip | No natural fit — forcing these would dilute your pitch and hurt Relevance scoring |

**Recommended real build target:** Healthcare track + ElevenLabs + Backboard as your coherent technical core (interaction checker + voice + persistent memory, all backed by Supabase). Deploy free on Vercel and grab a GoDaddy domain at the end since both cost almost nothing.

---

## 9. Demo Script (Live Judging, 2 min demo + 1 min Q&A)

1. **Hook (15 sec):** "My grandma is on 6 medications. Last month she almost took an OTC painkiller that would've been dangerous with her blood thinner."
2. **Show it (90 sec):** Log in (Supabase Auth) → load saved meds (remembered via Backboard) → add a new OTC med → interaction flags appear → body map lights up → voice reads the explanation aloud.
3. **Close (15 sec):** "This isn't about replacing your doctor — it's about making sure the conversation happens before something goes wrong."

---

## 10. Judging Criteria Alignment Cheat Sheet

| Criterion | How MedCheck hits it |
|---|---|
| Technical Rigor | Real API integrations (RxNorm, OpenFDA, Supabase, Backboard) + LLM explanation layer |
| Originality | Timeline/schedule overlap detection is a genuinely new angle |
| UX & Design | Body map + voice explainer make it feel human, not clinical |
| Practicality & Impact | Nearly universal use case, especially for elderly/multi-med users |
| Relevance | Directly matches Healthcare track's "actionable guidance" framing |

---

## 12. Task List — 3-Person Team (1 Frontend, 2 Backend)

### Frontend (1 person)

**Phase 1 — Core UI (Friday night–Saturday morning)**
- [ ] Set up React project + connect to Supabase client (auth + data fetch)
- [ ] Build sign up / log in screens (Supabase Auth)
- [ ] Build "Add Medication" screen with autocomplete search input (hits backend's `/search-drugs` endpoint)
- [ ] Build medication list view (shows what's currently saved for the user)

**Phase 2 — Results & wow layers (Saturday)**
- [ ] Build interaction results screen: severity-sorted list, color-coded badges
- [ ] Build body map visualization (Priority 1) — SVG/silhouette that highlights affected system by severity color
- [ ] Build timeline/schedule view (Priority 2) — simple day-view showing when each med is taken, highlighting overlapping times
- [ ] Add toggle UI for Claude vs. Gemini explanation mode (Priority 3)
- [ ] Add "play voice explanation" button per flagged interaction (Priority 5, hooks into backend's ElevenLabs endpoint)

**Phase 3 — Polish (Saturday night–Sunday morning)**
- [ ] Loading states, empty states, error states
- [ ] Mobile-responsive pass
- [ ] Wire up mock patient data for demo fallback (in case live APIs are flaky during judging)
- [ ] Final demo run-through with the team

---

### Backend Person 1 — Data & Drug Logic

**Phase 1 (Friday night–Saturday morning)**
- [ ] Set up Supabase project: create `medications` and `interaction_flags` tables (schema in Section 4a)
- [ ] Build `/search-drugs` endpoint wrapping RxNorm autocomplete (Section 5a)
- [ ] Build `/save-medication` endpoint (writes to Supabase, Section 4c)
- [ ] Build `/get-medications` endpoint (reads from Supabase, Section 4d)

**Phase 2 (Saturday)**
- [ ] Build `/check-interactions` endpoint wrapping RxNav Interaction API (Section 5b)
- [ ] Implement severity sorting logic (Section 5c)
- [ ] Build `/save-interaction-flag` endpoint (Section 4e)
- [ ] Add `time_of_day` handling to support the timeline/schedule feature — write logic to detect overlapping dose times

**Phase 3 (Saturday night–Sunday)**
- [ ] Set up mock patient data endpoint for demo reliability (Section 5d)
- [ ] Help debug integration between frontend and Supabase
- [ ] Deploy backend + confirm Vercel deployment works end-to-end

---

### Backend Person 2 — AI & Integrations (Claude/Gemini, Backboard, ElevenLabs)

**Phase 1 (Friday night–Saturday morning)**
- [ ] Build `/explain-interaction` endpoint using Claude API (Section 6)
- [ ] Test with a few real RxNav interaction descriptions to make sure explanations sound calm/non-alarming

**Phase 2 (Saturday)**
- [ ] Add Gemini API as a second explanation mode, toggled by the frontend (Priority 3 wow layer)
- [ ] Integrate Backboard for persistent memory — store user's medication history/context so returning users don't start from scratch (Priority 4 wow layer)
- [ ] Integrate ElevenLabs — build `/text-to-speech` endpoint that takes a plain-English explanation and returns audio (Priority 5 wow layer)

**Phase 3 (Saturday night–Sunday)**
- [ ] Test full pipeline: interaction found → explained → remembered → voiced, end to end
- [ ] Backup plan: if any single API is flaky near judging, make sure the app gracefully falls back (e.g., skip voice, show text only)
- [ ] Help with final Devpost write-up on how Backboard/ElevenLabs/Gemini were used (needed for challenge eligibility)

---

### Shared / Whole-Team Tasks
- [ ] Register GoDaddy domain (5 min, do this early so it's not forgotten)
- [ ] Write and record the 3-4 minute Devpost submission video (Section 9 has your demo script)
- [ ] Do at least one full run-through of the live judging demo together before Sunday morning
- [ ] Confirm which track + which challenges you're submitting to on Devpost (Section 8)


## 13. Important Framing Reminder

Always position MedCheck as a tool that **empowers better conversations with pharmacists/doctors** — never as something that diagnoses, overrides, or judges a prescription as "wrong." This is both the safer framing and the more credible one for judges, since interaction databases don't have a patient's full clinical picture.