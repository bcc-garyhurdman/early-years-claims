import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCase, getCaseEvents, listActiveUsers } from "@/lib/cases";
import { CASE_STATUSES, CLAIM_FIELDS, CLOSED_STATUSES, FIELD_GROUPS, formatDate, formatDateTime } from "@/lib/fields";
import { addNoteAction, assignCaseAction, changeStatusAction } from "../../actions";
import StatusBadge from "@/components/StatusBadge";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";

function describeEvent(e: { event_type: string; from_value: string | null; to_value: string | null }) {
  switch (e.event_type) {
    case "created": return "Case created";
    case "status": return `Status: ${e.from_value ?? "—"} → ${e.to_value}`;
    case "assigned": return `Assigned: ${e.from_value ?? "Unassigned"} → ${e.to_value}`;
    case "data_updated": return "Claim data updated";
    case "note": return "Note";
    default: return e.event_type;
  }
}

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const c = /^\d+$/.test(id) ? getCase(Number(id)) : undefined;
  if (!c) notFound();
  const events = getCaseEvents(c.id);
  const users = listActiveUsers();

  const isManager = user.role === "manager";
  const isMine = c.assigned_to === user.id;
  const closed = CLOSED_STATUSES.includes(c.status);
  const canChangeStatus = isManager || (isMine && !closed);

  const display = (col: string, type: string) => {
    const v = c[col] as string | number | null;
    if (v === null || v === undefined || v === "") return <span className="muted">—</span>;
    return type === "date" ? formatDate(String(v)) : String(v);
  };

  return (
    <>
      <div className="row">
        <div>
          <Link href="/cases?status=open" className="muted">← Cases</Link>
          <h1 style={{ margin: "4px 0 0" }}>
            #{c.id} · {c.forename} {c.surname} <StatusBadge status={c.status} />
          </h1>
          <div className="muted">
            <Link href={`/providers/${c.impulse_id}`}>{c.provider_name}</Link> ({c.impulse_id}) · {c.term_name} ·
            Assigned to {c.assignee_name ?? "nobody"}
          </div>
        </div>
      </div>
      <Flash {...sp} />

      <div className="grid2">
        <div>
          {FIELD_GROUPS.map((g) => (
            <section className="card" key={g.key}>
              <h2>{g.title}</h2>
              <dl className="fields">
                {CLAIM_FIELDS.filter((f) => f.group === g.key).map((f) => (
                  <div key={f.column}>
                    <dt>{f.label}</dt>
                    <dd>{display(f.column, f.type)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <p className="muted">
            Created {formatDateTime(c.created_at)} · Last updated {formatDateTime(c.updated_at)}
          </p>
        </div>

        <div>
          <section className="card">
            <h2>Assignment</h2>
            {isManager && !closed ? (
              <form action={assignCaseAction} className="inline">
                <input type="hidden" name="caseId" value={c.id} />
                <select name="assignee" defaultValue={c.assigned_to ?? ""}>
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.display_name}</option>
                  ))}
                </select>
                <SubmitButton>Assign</SubmitButton>
              </form>
            ) : !closed && c.assigned_to === null ? (
              <form action={assignCaseAction}>
                <input type="hidden" name="caseId" value={c.id} />
                <input type="hidden" name="assignee" value={user.id} />
                <SubmitButton>Assign to me</SubmitButton>
              </form>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {c.assignee_name ?? "Unassigned"}
                {closed && " (case closed)"}
              </p>
            )}
          </section>

          <section className="card">
            <h2>Status</h2>
            {canChangeStatus ? (
              <form action={changeStatusAction} className="stack">
                <input type="hidden" name="caseId" value={c.id} />
                <label>
                  New status
                  <select name="status" defaultValue={c.status}>
                    {CASE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Note (required for On Hold / Declined)
                  <textarea name="note" />
                </label>
                <SubmitButton>Update status</SubmitButton>
              </form>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {closed
                  ? "This case is closed. A manager can reopen it."
                  : "Only the assigned team member or a manager can change the status."}
              </p>
            )}
          </section>

          <section className="card">
            <h2>Add note</h2>
            <form action={addNoteAction} className="stack">
              <input type="hidden" name="caseId" value={c.id} />
              <textarea name="note" required />
              <SubmitButton className="secondary">Add note</SubmitButton>
            </form>
          </section>

          <section className="card">
            <h2>History</h2>
            <ul className="timeline">
              {events.map((e) => (
                <li key={e.id}>
                  <div><b>{describeEvent(e)}</b></div>
                  {e.note && <div style={{ whiteSpace: "pre-wrap" }}>{e.note}</div>}
                  <div className="meta">
                    {e.user_name ?? "System"} · {formatDateTime(e.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
