import "server-only";
import { getDb } from "./db";
import { CLAIM_FIELDS, CLOSED_STATUSES, coerceValue, fieldForKey, type CaseStatus } from "./fields";
import { generateMockClaims } from "./mock-claims";

export interface ImportResult {
  batchId: number;
  source: string;
  received: number;
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  providersCreated: number;
  messages: string[];
  error?: string;
}

type Row = Record<string, string | number | null>;

const DATA_COLUMNS = CLAIM_FIELDS.map((f) => f.column);

async function fetchClaims(): Promise<{ source: string; records: unknown[] }> {
  const url = process.env.CLAIMS_API_URL?.trim();
  if (!url) {
    return { source: "mock data (CLAIMS_API_URL not set)", records: generateMockClaims() };
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.CLAIMS_API_KEY) headers.Authorization = `Bearer ${process.env.CLAIMS_API_KEY}`;

  const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Claims API returned HTTP ${res.status} ${res.statusText}`);
  const body = await res.json();
  const records = Array.isArray(body) ? body : body?.data ?? body?.claims ?? body?.items;
  if (!Array.isArray(records)) {
    throw new Error("Claims API response was not an array (or an object with a data/claims/items array).");
  }
  return { source: new URL(url).host, records };
}

function mapRecord(raw: unknown, unknownKeys: Set<string>): Row {
  const row: Row = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const field = fieldForKey(k);
      if (!field) {
        unknownKeys.add(k);
        continue;
      }
      row[field.column] = coerceValue(field, v);
    }
  }
  for (const c of DATA_COLUMNS) if (!(c in row)) row[c] = null;
  return row;
}

export async function runImport(userId: number): Promise<ImportResult> {
  const db = getDb();
  const batchId = Number(
    db.prepare("INSERT INTO import_batches (user_id) VALUES (?)").run(userId).lastInsertRowid
  );
  const result: ImportResult = {
    batchId,
    source: "",
    received: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    rejected: 0,
    providersCreated: 0,
    messages: [],
  };

  try {
    const { source, records } = await fetchClaims();
    result.source = source;
    result.received = records.length;
    const unknownKeys = new Set<string>();

    const findProvider = db.prepare("SELECT 1 FROM providers WHERE provider_id = ?");
    const insertProvider = db.prepare(
      "INSERT INTO providers (provider_id, provider_name) VALUES (?, ?)"
    );
    const findCase = db.prepare(
      `SELECT * FROM cases WHERE impulse_id = ? AND term_name IS ? AND surname IS ?
         AND forename IS ? AND dob IS ?`
    );
    const insertCase = db.prepare(
      `INSERT INTO cases (${DATA_COLUMNS.join(", ")}, status, import_batch_id)
       VALUES (${DATA_COLUMNS.map((c) => "@" + c).join(", ")}, 'New', @batch)`
    );
    const updateCase = db.prepare(
      `UPDATE cases SET ${DATA_COLUMNS.map((c) => `${c} = @${c}`).join(", ")},
         import_batch_id = @batch, updated_at = datetime('now') WHERE id = @id`
    );
    const addEvent = db.prepare(
      "INSERT INTO case_events (case_id, user_id, event_type, note) VALUES (?, ?, ?, ?)"
    );

    const tx = db.transaction(() => {
      records.forEach((raw, i) => {
        const row = mapRecord(raw, unknownKeys);
        const id = row.impulse_id;
        if (id === null) {
          result.rejected++;
          result.messages.push(`Record ${i + 1}: missing or invalid Impulse ID - skipped.`);
          return;
        }
        if (!findProvider.get(id)) {
          insertProvider.run(id, (row.setting_name as string) || `Setting ${id}`);
          result.providersCreated++;
          result.messages.push(
            `Setting ${id} (${row.setting_name ?? "no name"}) did not exist and was created - please complete its details.`
          );
        }

        const existing = findCase.get(id, row.term_name, row.surname, row.forename, row.dob) as
          | (Row & { id: number; status: CaseStatus })
          | undefined;

        if (!existing) {
          const caseId = Number(insertCase.run({ ...row, batch: batchId }).lastInsertRowid);
          addEvent.run(caseId, userId, "created", `Imported in batch #${batchId}`);
          result.created++;
          return;
        }

        const changed = CLAIM_FIELDS.filter(
          (f) => (existing[f.column] ?? null) !== (row[f.column] ?? null)
        ).map((f) => f.label);
        if (changed.length === 0) {
          result.unchanged++;
        } else if (CLOSED_STATUSES.includes(existing.status)) {
          result.unchanged++;
          result.messages.push(
            `Case #${existing.id} is ${existing.status}; incoming changes to ${changed.join(", ")} were NOT applied.`
          );
        } else {
          updateCase.run({ ...row, batch: batchId, id: existing.id });
          addEvent.run(existing.id, userId, "data_updated", `Updated by import: ${changed.join(", ")}`);
          result.updated++;
        }
      });
    });
    tx();

    if (unknownKeys.size) {
      result.messages.unshift(`Ignored unrecognised fields: ${[...unknownKeys].join(", ")}`);
    }
  } catch (e) {
    // The transaction is rolled back on error, so nothing was actually written.
    result.error = e instanceof Error ? e.message : String(e);
    result.created = result.updated = result.unchanged = result.rejected = result.providersCreated = 0;
    result.messages = [];
  }

  db.prepare(
    `UPDATE import_batches SET source=?, received_count=?, created_count=?, updated_count=?,
       unchanged_count=?, rejected_count=?, providers_created=?, error=?, messages=? WHERE id=?`
  ).run(
    result.source,
    result.received,
    result.created,
    result.updated,
    result.unchanged,
    result.rejected,
    result.providersCreated,
    result.error ?? null,
    JSON.stringify(result.messages),
    batchId
  );
  return result;
}
