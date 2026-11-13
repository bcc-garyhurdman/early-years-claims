import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listActiveUsers, listCases, listTerms, statusCounts, type CaseFilters } from "@/lib/cases";
import { listProviders } from "@/lib/providers";
import { CASE_STATUSES, CLOSED_STATUSES, formatDate, formatDateTime } from "@/lib/fields";
import { bulkAssignAction } from "../actions";
import StatusBadge from "@/components/StatusBadge";
import Flash from "@/components/Flash";
import SelectAll from "@/components/SelectAll";
import SubmitButton from "@/components/SubmitButton";

type SP = CaseFilters & { msg?: string; error?: string };

export default async function CasesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const cases = listCases(sp, user.id);
  const counts = statusCounts();
  const users = listActiveUsers();
  const terms = listTerms();
  const settings = listProviders();
  const isManager = user.role === "manager";
  const canSelect = (c: (typeof cases)[number]) =>
    !CLOSED_STATUSES.includes(c.status) && (isManager || c.assigned_to === null);

  const returnParams = new URLSearchParams();
  for (const k of ["status", "assignee", "q", "term", "provider"] as const) {
    if (sp[k]) returnParams.set(k, sp[k]!);
  }
  const returnTo = `/cases${returnParams.size ? "?" + returnParams.toString() : ""}`;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const open = total - (counts.Approved ?? 0) - (counts.Declined ?? 0);

  const tabHref = (status?: string) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (sp.assignee) p.set("assignee", sp.assignee);
    if (sp.q) p.set("q", sp.q);
    if (sp.term) p.set("term", sp.term);
    if (sp.provider) p.set("provider", sp.provider);
    const s = p.toString();
    return s ? `/cases?${s}` : "/cases";
  };
  const tabs: [string | undefined, string, number][] = [
    ["open", "Open", open],
    ...CASE_STATUSES.map((s) => [s, s, counts[s] ?? 0] as [string, string, number]),
    [undefined, "All", total],
  ];

  return (
    <>
      <div className="row">
        <h1 style={{ margin: 0 }}>{sp.assignee === "me" ? "My cases" : "Cases"}</h1>
      </div>
      <Flash msg={sp.msg} error={sp.error} />

      <div className="tabs">
        {tabs.map(([value, label, n]) => (
          <Link key={label} href={tabHref(value)} className={sp.status === value ? "active" : ""}>
            {label} ({n})
          </Link>
        ))}
      </div>

      <form className="inline card" method="get">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <label>
          Search
          <input name="q" defaultValue={sp.q} placeholder="Child, setting, Impulse ID, case #, DERN" size={34} />
        </label>
        <label>
          Assigned to
          <select name="assignee" defaultValue={sp.assignee ?? ""}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.display_name}</option>
            ))}
          </select>
        </label>
        <label>
          Setting
          <select name="provider" defaultValue={sp.provider ?? ""}>
            <option value="">All settings</option>
            {settings.map((p) => (
              <option key={p.provider_id} value={p.provider_id}>
                {p.provider_name} ({p.provider_id})
              </option>
            ))}
          </select>
        </label>
        <label>
          Term
          <select name="term" defaultValue={sp.term ?? ""}>
            <option value="">All terms</option>
            {terms.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="submit">Filter</button>
        <Link href={sp.status ? `/cases?status=${encodeURIComponent(sp.status)}` : "/cases"} className="btn secondary">
          Clear
        </Link>
      </form>

      <form id="bulk" action={bulkAssignAction} className="inline bulkbar">
        <input type="hidden" name="returnTo" value={returnTo} />
        <span className="muted">With selected cases:</span>
        {isManager ? (
          <>
            <select name="assignee" defaultValue="__none" aria-label="Assign selected cases to">
              <option value="__none">Assign to…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
              <option value="">— Unassign —</option>
            </select>
            <SubmitButton pendingText="Assigning…">Assign selected</SubmitButton>
          </>
        ) : (
          <>
            <input type="hidden" name="assignee" value="me" />
            <SubmitButton pendingText="Assigning…">Assign selected to me</SubmitButton>
          </>
        )}
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}><SelectAll formId="bulk" name="caseIds" /></th>
              <th>Case</th>
              <th>Child</th>
              <th>DOB</th>
              <th>Setting</th>
              <th>Term</th>
              <th>Funded hrs</th>
              <th>Status</th>
              <th>Assigned to</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr>
                <td colSpan={10} className="muted">
                  No cases match.{" "}
                  {user.role === "manager" && total === 0 && <Link href="/admin">Import claims</Link>}
                </td>
              </tr>
            )}
            {cases.map((c) => (
              <tr key={c.id}>
                <td>
                  <input
                    type="checkbox"
                    form="bulk"
                    name="caseIds"
                    value={c.id}
                    disabled={!canSelect(c)}
                    aria-label={`Select case ${c.id}`}
                    title={canSelect(c) ? undefined : CLOSED_STATUSES.includes(c.status) ? "Case is closed" : "Already assigned"}
                  />
                </td>
                <td><Link href={`/cases/${c.id}`}>#{c.id}</Link></td>
                <td><Link href={`/cases/${c.id}`}>{c.forename} {c.surname}</Link></td>
                <td>{formatDate(c.dob)}</td>
                <td>
                  {c.provider_name ?? c.setting_name}
                  <div className="muted">{c.impulse_id}</div>
                </td>
                <td>{c.term_name}</td>
                <td>{c.funded_hours ?? ""}</td>
                <td><StatusBadge status={c.status} /></td>
                <td>{c.assignee_name ?? <span className="muted">—</span>}</td>
                <td className="muted">{formatDateTime(c.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cases.length === 500 && <p className="muted">Showing the first 500 results — refine your filters.</p>}
    </>
  );
}
