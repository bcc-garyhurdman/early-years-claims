import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/fields";
import { importClaimsAction } from "../actions";
import SubmitButton from "@/components/SubmitButton";

interface Batch {
  id: number;
  started_at: string;
  source: string | null;
  received_count: number;
  created_count: number;
  updated_count: number;
  unchanged_count: number;
  rejected_count: number;
  providers_created: number;
  error: string | null;
  messages: string | null;
  user_name: string | null;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  await requireManager();
  const sp = await searchParams;
  const db = getDb();
  const batches = db
    .prepare(
      `SELECT b.*, u.display_name AS user_name FROM import_batches b
         LEFT JOIN users u ON u.id = b.user_id ORDER BY b.id DESC LIMIT 20`
    )
    .all() as Batch[];
  const latest = sp.batch ? batches.find((b) => b.id === Number(sp.batch)) : undefined;
  const messages: string[] = latest?.messages ? JSON.parse(latest.messages) : [];
  const apiConfigured = Boolean(process.env.CLAIMS_API_URL?.trim());

  return (
    <>
      <div className="row">
        <h1 style={{ margin: 0 }}>Admin</h1>
        <Link href="/admin/users" className="btn secondary">Manage users</Link>
      </div>

      <section className="card">
        <h2>Import claims</h2>
        <p className="muted">
          Pulls the latest claims from the provider claims system. New claims become cases with status
          <b> New</b>. Claims already imported are updated if their data has changed, unless the case is
          Approved or Declined. Unknown Impulse IDs create a placeholder setting.
        </p>
        {!apiConfigured && (
          <p className="flash error">
            CLAIMS_API_URL is not configured — the import will use built-in sample data.
          </p>
        )}
        <form action={importClaimsAction}>
          <SubmitButton pendingText="Importing…">Import claims now</SubmitButton>
        </form>
      </section>

      {latest && (
        <section className="card">
          <h2>Import #{latest.id} result</h2>
          {latest.error ? (
            <div className="flash error">Import failed: {latest.error}</div>
          ) : (
            <div className="flash msg">
              Received {latest.received_count}: {latest.created_count} new, {latest.updated_count} updated,{" "}
              {latest.unchanged_count} unchanged, {latest.rejected_count} rejected.
              {latest.providers_created > 0 && ` ${latest.providers_created} new setting(s) created.`}{" "}
              <Link href="/cases?status=New">View new cases</Link>
            </div>
          )}
          {messages.length > 0 && (
            <ul>{messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
          )}
        </section>
      )}

      <section>
        <h2>Import history</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>When</th><th>By</th><th>Source</th><th>Received</th><th>New</th>
                <th>Updated</th><th>Unchanged</th><th>Rejected</th><th>New settings</th><th>Result</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 && <tr><td colSpan={11} className="muted">No imports yet.</td></tr>}
              {batches.map((b) => (
                <tr key={b.id}>
                  <td><Link href={`/admin?batch=${b.id}`}>{b.id}</Link></td>
                  <td>{formatDateTime(b.started_at)}</td>
                  <td>{b.user_name}</td>
                  <td>{b.source}</td>
                  <td>{b.received_count}</td>
                  <td>{b.created_count}</td>
                  <td>{b.updated_count}</td>
                  <td>{b.unchanged_count}</td>
                  <td>{b.rejected_count}</td>
                  <td>{b.providers_created}</td>
                  <td>{b.error ? <span style={{ color: "var(--danger)" }}>Failed</span> : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
