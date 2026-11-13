// Definitions of the claim fields submitted by the third-party system.
// `label` is the field name as supplied by the API, `column` is the local DB column.

export type FieldType = "text" | "integer" | "number" | "date";

export interface ClaimField {
  label: string;
  column: string;
  type: FieldType;
  group: "child" | "funding" | "eligibility" | "other";
}

export const CLAIM_FIELDS: ClaimField[] = [
  { label: "Impulse ID", column: "impulse_id", type: "integer", group: "child" },
  { label: "Setting Name", column: "setting_name", type: "text", group: "child" },
  { label: "Term Name", column: "term_name", type: "text", group: "child" },
  { label: "Forename", column: "forename", type: "text", group: "child" },
  { label: "Surname", column: "surname", type: "text", group: "child" },
  { label: "DOB", column: "dob", type: "date", group: "child" },
  { label: "Age", column: "age", type: "integer", group: "child" },
  { label: "Ethnicity", column: "ethnicity", type: "text", group: "child" },

  { label: "Funded Weeks", column: "funded_weeks", type: "number", group: "funding" },
  { label: "Universal Hours", column: "universal_hours", type: "number", group: "funding" },
  { label: "Universal Provider", column: "universal_provider", type: "text", group: "funding" },
  { label: "Extended Hours", column: "extended_hours", type: "number", group: "funding" },
  { label: "Extended Provider", column: "extended_provider", type: "text", group: "funding" },
  { label: "Funded Hours", column: "funded_hours", type: "number", group: "funding" },
  { label: "Non-Funded Hours", column: "non_funded_hours", type: "number", group: "funding" },
  { label: "DERN", column: "dern", type: "text", group: "funding" },

  { label: "FSM", column: "fsm", type: "text", group: "eligibility" },
  { label: "PP", column: "pp", type: "text", group: "eligibility" },
  { label: "FSM PP Code", column: "fsm_pp_code", type: "text", group: "eligibility" },
  { label: "IS", column: "is_flag", type: "text", group: "eligibility" },
  { label: "JSA", column: "jsa", type: "text", group: "eligibility" },
  { label: "I-RESA", column: "i_resa", type: "text", group: "eligibility" },
  { label: "UC", column: "uc", type: "text", group: "eligibility" },
  { label: "PC", column: "pc", type: "text", group: "eligibility" },
  { label: "TC", column: "tc", type: "text", group: "eligibility" },
  { label: "DLA", column: "dla", type: "text", group: "eligibility" },
  { label: "PLAC", column: "plac", type: "text", group: "eligibility" },
  { label: "LAC", column: "lac", type: "text", group: "eligibility" },
  { label: "NRtPF8", column: "nrtpf8", type: "text", group: "eligibility" },
  { label: "ASY", column: "asy", type: "text", group: "eligibility" },
  { label: "FASY", column: "fasy", type: "text", group: "eligibility" },
  { label: "ZAM", column: "zam", type: "text", group: "eligibility" },
  { label: "NRtPFS17", column: "nrtpfs17", type: "text", group: "eligibility" },
  { label: "2YO Code", column: "two_yo_code", type: "text", group: "eligibility" },
  { label: "SEN", column: "sen", type: "text", group: "eligibility" },

  { label: "Comments", column: "comments", type: "text", group: "other" },
  { label: "WellComm Progress", column: "wellcomm_progress", type: "text", group: "other" },
  { label: "WellComm Outcomes", column: "wellcomm_outcomes", type: "text", group: "other" },
];

export const FIELD_GROUPS: { key: ClaimField["group"]; title: string }[] = [
  { key: "child", title: "Child & setting" },
  { key: "funding", title: "Funding" },
  { key: "eligibility", title: "Eligibility" },
  { key: "other", title: "Comments & WellComm" },
];

export const CASE_STATUSES = [
  "New",
  "Assigned",
  "In Progress",
  "On Hold",
  "Approved",
  "Declined",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CLOSED_STATUSES: CaseStatus[] = ["Approved", "Declined"];

export function isCaseStatus(s: unknown): s is CaseStatus {
  return typeof s === "string" && (CASE_STATUSES as readonly string[]).includes(s);
}

/** Normalise a key so "Impulse ID", "impulse_id" and "ImpulseID" all match. */
export function normaliseKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const BY_NORMALISED = new Map<string, ClaimField>();
for (const f of CLAIM_FIELDS) {
  BY_NORMALISED.set(normaliseKey(f.label), f);
  BY_NORMALISED.set(normaliseKey(f.column), f);
}

export function fieldForKey(key: string): ClaimField | undefined {
  return BY_NORMALISED.get(normaliseKey(key));
}

export function coerceValue(field: ClaimField, raw: unknown): string | number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  switch (field.type) {
    case "integer": {
      const n = Number(s);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    case "number": {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    case "date":
      return normaliseDate(s);
    default:
      return s;
  }
}

/** Accepts ISO dates/timestamps and UK dd/mm/yyyy; stores yyyy-mm-dd. */
function normaliseDate(s: string): string {
  const uk = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (uk) return `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1];
  return s;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}
