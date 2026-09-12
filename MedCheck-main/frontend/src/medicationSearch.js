// TODO: once your teammate's backend is up, replace MOCK_DRUGS and
// searchMedications() below with a real fetch to their endpoint, e.g.:
//
//   const BACKEND_URL = 'http://localhost:4000' // ask your backend teammate for the real one
//   export async function searchMedications(query) {
//     const res = await fetch(`${BACKEND_URL}/search-drugs?q=${encodeURIComponent(query)}`)
//     if (!res.ok) throw new Error('Search failed')
//     return res.json() // expected shape: [{ name, rxcui }, ...]
//   }
//
// AddMedication.jsx and OneTimeMedicationCheck.jsx both import from here,
// so there's only one drug list to keep in sync while this is still mocked.
export const MOCK_DRUGS = [
  { name: 'Ibuprofen', rxcui: '5640' },
  { name: 'Warfarin', rxcui: '11289' },
  { name: 'Lisinopril', rxcui: '29046' },
  { name: 'Sertraline', rxcui: '312938' },
  { name: 'Tramadol', rxcui: '10689' },
  { name: 'Metformin', rxcui: '6809' },
  { name: 'Atorvastatin', rxcui: '83367' },
  { name: 'Aspirin', rxcui: '1191' },
  { name: 'Acetaminophen', rxcui: '161' },
]

export function searchMedications(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return MOCK_DRUGS.filter((d) => d.name.toLowerCase().includes(q))
}
