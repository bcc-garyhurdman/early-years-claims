import "server-only";
import { getDb } from "./db";
import type { CaseStatus } from "./fields";

export interface CaseRow {
  id: number;
  impulse_id: number;
  setting_name: string | null;
  provider_name: string | null;
  term_name: string | null;
  forename: string | null;
  surname: string | null;
  dob: string | null;
  funded_hours: number | null;
  status: CaseStatus;
  assigned_to: number | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface CaseFilters {
  status?: string;
  assignee?: string; // user id, "me", "unassigned"
  q?: string;
  term?: string;
  provider?: string;
}

export function listCases(filters: CaseFilters, currentUserId: number): CaseRow[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.status === "open") {
    where.push("c.status NOT IN ('Approved','Declined')");
  } else if (filters.status) {
    where.push("c.status = @status");
    params.status = filters.status;
  }
  if (filters.assignee === "me") {
    where.push("c.assigned_to = @me");
    params.me = currentUserId;
  } else if (filters.assignee === "unassigned") {
    where.push("c.assigned_to IS NULL");
  } else if (filters.assignee && /^\d+$/.test(filters.assignee)) {
    where.push("c.assigned_to = @assignee");
    params.assignee = Number(filters.assignee);
  }
  if (filters.term) {
    where.push("c.term_name = @term");
    params.term = filters.term;
  }
  if (filters.provider && /^\d+$/.test(filters.provider)) {
    where.push("c.impulse_id = @provider");
    params.provider = Number(filters.provider);
  }
  if (filters.q?.trim()) {
    where.push(`(c.forename || ' ' || c.surname LIKE @q OR c.setting_name LIKE @q
      OR p.provider_name LIKE @q OR CAST(c.impulse_id AS TEXT) = @qExact OR CAST(c.id AS TEXT) = @qExact
      OR c.dern LIKE @q)`);
    params.q = `%${filters.q.trim()}%`;
    params.qExact = filters.q.trim().replace(/^#/, "");
  }

  const sql = `
    SELECT c.*, p.provider_name, u.display_name AS assignee_name
      FROM cases c
      JOIN providers p ON p.provider_id = c.impulse_id
      LEFT JOIN users u ON u.id = c.assigned_to
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY CASE c.status WHEN 'New' THEN 0 WHEN 'Assigned' THEN 1 WHEN 'In Progress' THEN 2
              WHEN 'On Hold' THEN 3 ELSE 4 END, c.updated_at DESC
     LIMIT 500`;
  return getDb().prepare(sql).all(params) as CaseRow[];
}

export function statusCounts(): Record<string, number> {
  const rows = getDb()
    .prepare("SELECT status, COUNT(*) AS n FROM cases GROUP BY status")
    .all() as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export function listTerms(): string[] {
  return (
    getDb()
      .prepare("SELECT DISTINCT term_name FROM cases WHERE term_name IS NOT NULL ORDER BY term_name")
      .all() as { term_name: string }[]
  ).map((r) => r.term_name);
}

export function getCase(id: number): CaseRow | undefined {
  return getDb()
    .prepare(
      `SELECT c.*, p.provider_name, u.display_name AS assignee_name
         FROM cases c JOIN providers p ON p.provider_id = c.impulse_id
         LEFT JOIN users u ON u.id = c.assigned_to WHERE c.id = ?`
    )
    .get(id) as CaseRow | undefined;
}

export interface CaseEvent {
  id: number;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  created_at: string;
  user_name: string | null;
}

export function getCaseEvents(caseId: number): CaseEvent[] {
  return getDb()
    .prepare(
      `SELECT e.*, u.display_name AS user_name FROM case_events e
         LEFT JOIN users u ON u.id = e.user_id WHERE e.case_id = ? ORDER BY e.id DESC`
    )
    .all(caseId) as CaseEvent[];
}

export function listActiveUsers(): { id: number; display_name: string; role: string }[] {
  return getDb()
    .prepare("SELECT id, display_name, role FROM users WHERE active = 1 ORDER BY display_name")
    .all() as { id: number; display_name: string; role: string }[];
}
