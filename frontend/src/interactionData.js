// The real interaction check is backendClient.js's checkInteractions(),
// backed by Backend Person 1's curated-list + openFDA logic — see
// useInteractionCheck.js, which every component that needs an interaction
// check goes through. MOCK_INTERACTIONS and mockCheckInteractions() below
// are that hook's fallback for when the backend is unreachable, same
// philosophy as AddMedication.jsx's drug-search fallback. SEVERITY_LABEL is
// still used directly by every component that renders a severity badge,
// real result or mock.
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

export function mockCheckInteractions(medications) {
  const names = medications.map((m) => m.name)
  return MOCK_INTERACTIONS.filter((interaction) =>
    interaction.drugs.every((drug) => names.includes(drug))
  ).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
}
