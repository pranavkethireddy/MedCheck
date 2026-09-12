// TODO: once your backend has a real interaction-check endpoint (calling
// RxNav's interaction API, per the project plan), replace MOCK_INTERACTIONS
// and checkInteractions() below with a real fetch, something like:
//
//   export async function checkInteractions(medications) {
//     const rxcuis = medications.map((m) => m.rxcui).join('+')
//     const res = await fetch(`${BACKEND_URL}/check-interactions?rxcuis=${rxcuis}`)
//     return res.json() // expected: [{ drugs: [...], severity, description }, ...]
//   }
//
// InteractionResults.jsx (checks the whole long-term list against itself)
// and OneTimeMedicationCheck.jsx (checks one new drug against that list)
// both import from here, so there's one interaction dataset to keep in sync.
export const MOCK_INTERACTIONS = [
  {
    drugs: ['Warfarin', 'Ibuprofen'],
    severity: 'significant',
    description:
      "Taking these together can raise the risk of serious bleeding. Worth flagging to your doctor before combining them.",
    questions: [
      'Is there a safer pain reliever I can take instead of ibuprofen?',
      'Should I watch for any specific warning signs?',
    ],
  },
  {
    drugs: ['Tramadol', 'Sertraline'],
    severity: 'significant',
    description:
      'This combination can increase the risk of serotonin syndrome, a rare but serious reaction.',
    questions: [
      'Is this combination safe at my current doses?',
      'What symptoms would mean I should seek care right away?',
    ],
  },
  {
    drugs: ['Lisinopril', 'Ibuprofen'],
    severity: 'minor',
    description:
      "NSAIDs like ibuprofen can make blood pressure medication less effective if used regularly.",
  },
  {
    drugs: ['Warfarin', 'Acetaminophen'],
    severity: 'minor',
    description:
      "Regular or high-dose acetaminophen can increase warfarin's blood-thinning effect. Occasional use at a normal dose is generally lower-risk, but worth mentioning to your provider if it becomes routine.",
  },
]

export const SEVERITY_RANK = { significant: 2, minor: 1 }
export const SEVERITY_LABEL = {
  significant: 'Significant — talk to your provider',
  minor: 'Minor — be aware',
}

export function checkInteractions(medications) {
  const names = medications.map((m) => m.name)
  return MOCK_INTERACTIONS.filter((interaction) =>
    interaction.drugs.every((drug) => names.includes(drug))
  ).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
}
