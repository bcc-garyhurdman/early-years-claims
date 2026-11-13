// Deterministic sample data in the shape the third-party API is expected to return.
// Used when CLAIMS_API_URL is not configured, and served at /api/mock-claims.

const SETTINGS: [number, string][] = [
  [10234, "Little Acorns Nursery"],
  [10567, "Sunshine Pre-School"],
  [11021, "Rainbow Day Nursery"],
  [11388, "Busy Bees Childminding"],
];
const FORENAMES = ["Amelia", "Oliver", "Isla", "Noah", "Ava", "Leo", "Freya", "Arlo", "Ivy", "Theo", "Maya", "Jack"];
const SURNAMES = ["Smith", "Jones", "Taylor", "Brown", "Khan", "Williams", "Patel", "Evans", "Wilson", "Davies"];
const ETHNICITY = ["WBRI", "WOTH", "AIND", "APKN", "BAFR", "MWBC", "NOBT"];

export function generateMockClaims(count = 24) {
  const out: Record<string, string | number>[] = [];
  for (let i = 0; i < count; i++) {
    const [id, name] = SETTINGS[i % SETTINGS.length];
    const age = 2 + (i % 3);
    const year = 2026 - age;
    const universal = age >= 3 ? 15 : 0;
    const extended = i % 2 === 0 ? 15 : 0;
    const twoYo = age === 2 ? 15 : 0;
    const funded = universal + extended + twoYo;
    out.push({
      "Impulse ID": id,
      "Setting Name": name,
      "Term Name": "Autumn 2026",
      Forename: FORENAMES[i % FORENAMES.length],
      Surname: SURNAMES[(i * 7) % SURNAMES.length],
      DOB: `${String(1 + ((i * 3) % 28)).padStart(2, "0")}/${String(1 + (i % 12)).padStart(2, "0")}/${year}`,
      Age: age,
      Ethnicity: ETHNICITY[i % ETHNICITY.length],
      "Funded Weeks": 14,
      "Universal Hours": universal,
      "Universal Provider": universal ? name : "",
      "Extended Hours": extended,
      "Extended Provider": extended ? name : "",
      "Funded Hours": funded,
      "Non-Funded Hours": i % 4 === 0 ? 5 : 0,
      DERN: extended ? `5000${1000 + i}` : "",
      FSM: i % 5 === 0 ? "Y" : "N",
      PP: i % 5 === 0 ? "Y" : "N",
      "FSM PP Code": i % 5 === 0 ? `FPP${200 + i}` : "",
      IS: i % 6 === 0 ? "Y" : "N",
      JSA: "N",
      "I-RESA": "N",
      UC: i % 3 === 0 ? "Y" : "N",
      PC: "N",
      TC: i % 7 === 0 ? "Y" : "N",
      DLA: i % 9 === 0 ? "Y" : "N",
      PLAC: "N",
      LAC: i % 11 === 0 ? "Y" : "N",
      NRtPF8: "N",
      ASY: "N",
      FASY: "N",
      ZAM: "N",
      NRtPFS17: "N",
      "2YO Code": age === 2 ? `2YO${3000 + i}` : "",
      SEN: i % 8 === 0 ? "K" : "N",
      Comments: i % 4 === 1 ? "Parent declaration received late" : "",
      "WellComm Progress": age === 2 ? ["Green", "Amber", "Red"][i % 3] : "",
      "WellComm Outcomes": age === 2 ? "Screened" : "",
    });
  }
  return out;
}
