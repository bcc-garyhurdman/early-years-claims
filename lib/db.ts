import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { CLAIM_FIELDS } from "./fields";
import { hashPassword } from "./password";

type DB = Database.Database;

const globalForDb = globalThis as unknown as { __eyDb?: DB };

function sqlType(t: string) {
  return t === "integer" ? "INTEGER" : t === "number" ? "REAL" : "TEXT";
}

function migrate(db: DB) {
  const claimColumns = CLAIM_FIELDS.filter((f) => f.column !== "impulse_id")
    .map((f) => `  ${f.column} ${sqlType(f.type)}`)
    .join(",\n");

  db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('manager','user')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- Settings (providers). provider_id is a manually maintained number, not auto-incrementing.
CREATE TABLE IF NOT EXISTS providers (
  provider_id    INTEGER PRIMARY KEY NOT NULL,
  provider_name  TEXT NOT NULL,
  contact        TEXT,
  contact_number TEXT,
  contact_email  TEXT,
  judgement      TEXT,
  two_yo         TEXT
);

CREATE TABLE IF NOT EXISTS import_batches (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER REFERENCES users(id),
  started_at        TEXT NOT NULL DEFAULT (datetime('now')),
  source            TEXT,
  received_count    INTEGER NOT NULL DEFAULT 0,
  created_count     INTEGER NOT NULL DEFAULT 0,
  updated_count     INTEGER NOT NULL DEFAULT 0,
  unchanged_count   INTEGER NOT NULL DEFAULT 0,
  rejected_count    INTEGER NOT NULL DEFAULT 0,
  providers_created INTEGER NOT NULL DEFAULT 0,
  error             TEXT,
  messages          TEXT
);

-- Cases (claims). impulse_id is the foreign key to providers.provider_id.
CREATE TABLE IF NOT EXISTS cases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  impulse_id  INTEGER NOT NULL REFERENCES providers(provider_id) ON UPDATE CASCADE ON DELETE RESTRICT,
${claimColumns},
  status      TEXT NOT NULL DEFAULT 'New'
              CHECK (status IN ('New','Assigned','In Progress','On Hold','Approved','Declined')),
  assigned_to INTEGER REFERENCES users(id),
  import_batch_id INTEGER REFERENCES import_batches(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_assigned ON cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_impulse ON cases(impulse_id);
-- Natural key used to recognise a claim that has already been imported.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cases_claim
  ON cases(impulse_id, term_name, surname, forename, dob);

CREATE TABLE IF NOT EXISTS case_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id     INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id),
  event_type  TEXT NOT NULL,  -- created | status | assigned | note | data_updated
  from_value  TEXT,
  to_value    TEXT,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_case ON case_events(case_id);
`);
}

function seed(db: DB) {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (n === 0) {
    const pw = process.env.INITIAL_ADMIN_PASSWORD || "ChangeMe123!";
    db.prepare(
      "INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, 'manager')"
    ).run("admin", "Administrator", hashPassword(pw));
    console.log('[db] Created initial manager account "admin". Change its password after first login.');
  }
}

function open(): DB {
  const file = path.resolve(
    /*turbopackIgnore: true*/ process.env.DATABASE_PATH || path.join(process.cwd(), "data", "early-years.db")
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  return db;
}

export function getDb(): DB {
  if (!globalForDb.__eyDb) globalForDb.__eyDb = open();
  return globalForDb.__eyDb;
}
