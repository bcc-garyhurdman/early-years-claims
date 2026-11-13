import "server-only";
import { getDb } from "./db";

export interface Provider {
  provider_id: number;
  provider_name: string;
  contact: string | null;
  contact_number: string | null;
  contact_email: string | null;
  judgement: string | null;
  two_yo: string | null;
}

export function listProviders(q?: string): (Provider & { case_count: number; open_count: number })[] {
  const where = q?.trim()
    ? "WHERE p.provider_name LIKE @q OR CAST(p.provider_id AS TEXT) = @exact OR p.contact LIKE @q"
    : "";
  return getDb()
    .prepare(
      `SELECT p.*, COUNT(c.id) AS case_count,
              SUM(CASE WHEN c.status NOT IN ('Approved','Declined') THEN 1 ELSE 0 END) AS open_count
         FROM providers p LEFT JOIN cases c ON c.impulse_id = p.provider_id
         ${where}
        GROUP BY p.provider_id ORDER BY p.provider_name`
    )
    .all({ q: `%${q?.trim() ?? ""}%`, exact: q?.trim() ?? "" }) as (Provider & {
    case_count: number;
    open_count: number;
  })[];
}

export function getProvider(id: number): Provider | undefined {
  return getDb().prepare("SELECT * FROM providers WHERE provider_id = ?").get(id) as Provider | undefined;
}
