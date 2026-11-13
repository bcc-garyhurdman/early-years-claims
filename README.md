# Early Years Claims

A small case management system for childcare funding claims. Providers (Settings) submit claims
in a third-party system. Managers pull them into this app, where the team works each claim as a case.

Built with Next.js 16 (App Router, server actions) and SQLite (`better-sqlite3`).

## Getting started

```bash
npm install
cp .env.example .env.local   # then edit as needed
npm run dev                  # http://localhost:3000
```

On first run the database is created at `data/early-years.db` with one manager account:

- username `admin`
- password from `INITIAL_ADMIN_PASSWORD` (default `ChangeMe123!`). Change it under **My account**.

For production: `npm run build && npm start`.

## Configuration (`.env.local`)

| Variable | Purpose |
|---|---|
| `DATABASE_PATH` | SQLite file location (default `./data/early-years.db`) |
| `CLAIMS_API_URL` | Third-party claims endpoint. If blank, the import uses built-in sample data. |
| `CLAIMS_API_KEY` | Optional. Sent as `Authorization: Bearer …` |
| `INITIAL_ADMIN_PASSWORD` | Password for the seeded `admin` account (first run only) |
| `COOKIE_SECURE` | Session cookies are HTTPS-only in production. Set `false` if served over plain HTTP. |

## Roles

- **Manager**: everything a user can do, plus the **Admin** section (import claims, import
  history, user management), assigning or reassigning any case, editing or deleting Settings, and
  reopening Approved/Declined cases.
- **User** (team member): view all cases and Settings, pick up unassigned cases ("Assign to me"),
  change the status of cases assigned to them, and add notes.

## Case workflow

Statuses: `New → Assigned → In Progress ⇄ On Hold → Approved | Declined`

- Imported claims start as **New**.
- Assigning a New case moves it to **Assigned**. Unassigning an Assigned case returns it to **New**.
- **Assigned** and **In Progress** require an assignee.
- **On Hold** and **Declined** require a note.
- Approved/Declined cases are closed. Only a manager can reopen one.
- Every assignment, status change, note and import update is recorded in the case history.

## Importing claims

**Admin → Import claims now** calls `CLAIMS_API_URL` with a GET request. The response should be a JSON
array of claim objects, or an object holding the array in `data`, `claims` or `items`. Field names are
matched loosely, so `"Impulse ID"`, `"impulse_id"` and `"ImpulseID"` are all accepted (see
`lib/fields.ts`). Dates may be `yyyy-mm-dd` or `dd/mm/yyyy`.

For each record:

- **Impulse ID** is the foreign key to the Setting's **Provider ID**. If no such Setting exists, a
  placeholder is created from the Setting Name and listed in the import result so a manager can fill
  in its details.
- A claim is identified by *Impulse ID + Term Name + Surname + Forename + DOB*.
  - Not seen before → new case (**New**).
  - Already imported and unchanged → skipped.
  - Already imported with changed data → case updated and the changed fields logged, **unless** the
    case is Approved/Declined. Those changes are reported but not applied.
- Records without a valid Impulse ID are rejected.
- The whole import runs in one transaction, so a failure leaves the database unchanged.

In development, `GET /api/mock-claims` serves the sample data over HTTP.

## Settings (providers)

Provider ID is a manually entered number (not auto-incrementing) and can be edited. Changing it
cascades to the Impulse ID on all of that Setting's cases. A Setting that has cases cannot be deleted.

## Project layout

```
app/
  actions.ts            server actions (auth, case workflow, settings, import, users)
  cases/                case list + case detail
  providers/            Settings list / view / edit
  admin/                import + import history, users
  api/mock-claims/      sample third-party API (development only)
lib/
  db.ts                 SQLite connection, schema, seeding
  fields.ts             claim field definitions, statuses, value coercion
  import.ts             third-party import logic
  auth.ts, password.ts  sessions + scrypt password hashing
```

## Backups

All data lives in the single SQLite file. Back it up with the app stopped, or use
`sqlite3 data/early-years.db ".backup backup.db"` while it is running.
