"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { login, logout, requireManager, requireUser, type SessionUser } from "@/lib/auth";
import { CLOSED_STATUSES, isCaseStatus, type CaseStatus } from "@/lib/fields";
import { hashPassword, verifyPassword } from "@/lib/password";
import { runImport } from "@/lib/import";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (path: string, kind: "msg" | "error", text: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(text)}`);

// ---------- Auth ----------

export async function loginAction(fd: FormData) {
  const ok = await login(str(fd, "username"), String(fd.get("password") ?? ""));
  if (!ok) back("/login", "error", "Invalid username or password");
  redirect("/cases");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

export async function changeOwnPasswordAction(fd: FormData) {
  const user = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const row = getDb().prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as {
    password_hash: string;
  };
  if (!verifyPassword(current, row.password_hash)) back("/account", "error", "Current password is incorrect");
  if (next.length < 8) back("/account", "error", "New password must be at least 8 characters");
  if (next !== confirm) back("/account", "error", "New passwords do not match");
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), user.id);
  back("/account", "msg", "Password changed");
}

// ---------- Cases ----------

function loadCase(id: number) {
  const c = getDb().prepare("SELECT id, status, assigned_to FROM cases WHERE id = ?").get(id) as
    | { id: number; status: CaseStatus; assigned_to: number | null }
    | undefined;
  if (!c) redirect("/cases?error=" + encodeURIComponent("Case not found"));
  return c;
}

function addEvent(
  caseId: number,
  user: SessionUser,
  type: string,
  from: string | null,
  to: string | null,
  note: string | null
) {
  getDb()
    .prepare(
      "INSERT INTO case_events (case_id, user_id, event_type, from_value, to_value, note) VALUES (?,?,?,?,?,?)"
    )
    .run(caseId, user.id, type, from, to, note || null);
}

type AssignOutcome = { ok: true; changed: boolean } | { ok: false; error: string };

/** Assigns one case. Shared by the single-case and bulk actions; caller handles transactions. */
function assignOne(
  user: SessionUser,
  caseId: number,
  assignee: number | null,
  assigneeName: string | null
): AssignOutcome {
  const db = getDb();
  const c = db.prepare("SELECT id, status, assigned_to FROM cases WHERE id = ?").get(caseId) as
    | { id: number; status: CaseStatus; assigned_to: number | null }
    | undefined;
  if (!c) return { ok: false, error: "Case not found" };
  if (user.role !== "manager") {
    // Team members may only pick up an unassigned case for themselves.
    if (assignee !== user.id || c.assigned_to !== null) {
      return { ok: false, error: "Only managers can assign or reassign cases" };
    }
  }
  if (CLOSED_STATUSES.includes(c.status)) return { ok: false, error: "Case is closed - reopen it first" };
  if (assignee === c.assigned_to) return { ok: true, changed: false };

  const prevName = c.assigned_to
    ? (db.prepare("SELECT display_name FROM users WHERE id = ?").get(c.assigned_to) as { display_name: string })
        ?.display_name
    : null;
  let newStatus: CaseStatus = c.status;
  if (assignee !== null && c.status === "New") newStatus = "Assigned";
  if (assignee === null && c.status === "Assigned") newStatus = "New";

  db.prepare("UPDATE cases SET assigned_to = ?, status = ?, updated_at = datetime('now') WHERE id = ?").run(
    assignee,
    newStatus,
    caseId
  );
  addEvent(caseId, user, "assigned", prevName, assigneeName ?? "Unassigned", null);
  if (newStatus !== c.status) addEvent(caseId, user, "status", c.status, newStatus, null);
  return { ok: true, changed: true };
}

function lookupAssignee(raw: string): { id: number | null; name: string | null } | undefined {
  if (raw === "") return { id: null, name: null };
  const u = getDb().prepare("SELECT id, display_name FROM users WHERE id = ? AND active = 1").get(Number(raw)) as
    | { id: number; display_name: string }
    | undefined;
  return u ? { id: u.id, name: u.display_name } : undefined;
}

export async function assignCaseAction(fd: FormData) {
  const user = await requireUser();
  const caseId = Number(fd.get("caseId"));
  const path = `/cases/${caseId}`;
  const target = lookupAssignee(str(fd, "assignee"));
  if (!target) back(path, "error", "Unknown user");

  const db = getDb();
  const result = db.transaction(() => assignOne(user, caseId, target!.id, target!.name))();
  if (!result.ok) back(path, "error", result.error);
  if (result.ok && !result.changed) back(path, "msg", "No change");
  revalidatePath("/cases");
  back(path, "msg", target!.name ? `Assigned to ${target!.name}` : "Case unassigned");
}

export async function bulkAssignAction(fd: FormData) {
  const user = await requireUser();
  const returnTo = str(fd, "returnTo");
  const path = returnTo.startsWith("/cases") ? returnTo : "/cases";
  const ids = [...new Set(fd.getAll("caseIds").map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) back(path, "error", "Select at least one case");

  const raw = str(fd, "assignee");
  if (raw === "__none") back(path, "error", "Choose who to assign the selected cases to");
  const target = lookupAssignee(raw === "me" ? String(user.id) : raw);
  if (!target) back(path, "error", "Unknown user");

  const failures: string[] = [];
  let changed = 0;
  const db = getDb();
  db.transaction(() => {
    for (const id of ids) {
      const r = assignOne(user, id, target!.id, target!.name);
      if (!r.ok) failures.push(`#${id}: ${r.error}`);
      else if (r.changed) changed++;
    }
  })();
  revalidatePath("/cases");

  const who = target!.name ? `assigned to ${target!.name}` : "unassigned";
  const summary = `${changed} case(s) ${who}.`;
  if (failures.length) back(path, "error", `${summary} ${failures.length} skipped - ${failures.join("; ")}`);
  back(path, "msg", summary);
}

export async function changeStatusAction(fd: FormData) {
  const user = await requireUser();
  const caseId = Number(fd.get("caseId"));
  const path = `/cases/${caseId}`;
  const c = loadCase(caseId);
  const status = str(fd, "status");
  const note = str(fd, "note");

  if (!isCaseStatus(status)) back(path, "error", "Invalid status");
  const to = status as CaseStatus;
  if (to === c.status) back(path, "msg", "No change");

  if (user.role !== "manager" && c.assigned_to !== user.id) {
    back(path, "error", "You can only update cases assigned to you");
  }
  if (CLOSED_STATUSES.includes(c.status) && user.role !== "manager") {
    back(path, "error", "Only managers can reopen an approved or declined case");
  }
  if ((to === "Assigned" || to === "In Progress") && c.assigned_to === null) {
    back(path, "error", "Assign the case to someone first");
  }
  if (to === "New" && c.assigned_to !== null) back(path, "error", "Unassign the case to return it to New");
  if ((to === "Declined" || to === "On Hold") && !note) {
    back(path, "error", `A note is required when setting a case to ${to}`);
  }

  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE cases SET status = ?, updated_at = datetime('now') WHERE id = ?").run(to, caseId);
    addEvent(caseId, user, "status", c.status, to, note);
  })();
  revalidatePath("/cases");
  back(path, "msg", `Status changed to ${to}`);
}

export async function addNoteAction(fd: FormData) {
  const user = await requireUser();
  const caseId = Number(fd.get("caseId"));
  loadCase(caseId);
  const note = str(fd, "note");
  if (!note) back(`/cases/${caseId}`, "error", "Note cannot be empty");
  addEvent(caseId, user, "note", null, null, note);
  getDb().prepare("UPDATE cases SET updated_at = datetime('now') WHERE id = ?").run(caseId);
  back(`/cases/${caseId}`, "msg", "Note added");
}

// ---------- Settings (providers) ----------

const PROVIDER_FIELDS = ["provider_name", "contact", "contact_number", "contact_email", "judgement", "two_yo"] as const;

export async function saveProviderAction(fd: FormData) {
  await requireManager();
  const original = str(fd, "originalId"); // empty when creating
  const idRaw = str(fd, "provider_id");
  const back_ = original ? `/providers/${original}` : "/providers/new";
  if (!/^\d+$/.test(idRaw)) back(back_, "error", "Provider ID must be a whole number");
  const id = Number(idRaw);
  const values = Object.fromEntries(PROVIDER_FIELDS.map((f) => [f, str(fd, f) || null]));
  if (!values.provider_name) back(back_, "error", "Provider name is required");

  const db = getDb();
  const clash = db.prepare("SELECT 1 FROM providers WHERE provider_id = ?").get(id);
  try {
    if (!original) {
      if (clash) back(back_, "error", `Provider ID ${id} already exists`);
      db.prepare(
        `INSERT INTO providers (provider_id, ${PROVIDER_FIELDS.join(", ")})
         VALUES (@provider_id, ${PROVIDER_FIELDS.map((f) => "@" + f).join(", ")})`
      ).run({ provider_id: id, ...values });
    } else {
      if (id !== Number(original) && clash) back(back_, "error", `Provider ID ${id} already exists`);
      // ON UPDATE CASCADE carries an ID change through to cases.impulse_id.
      db.prepare(
        `UPDATE providers SET provider_id = @provider_id, ${PROVIDER_FIELDS.map((f) => `${f} = @${f}`).join(", ")}
          WHERE provider_id = @original`
      ).run({ provider_id: id, original: Number(original), ...values });
    }
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // let redirects through
    back(back_, "error", e instanceof Error ? e.message : "Save failed");
  }
  revalidatePath("/providers");
  back(`/providers/${id}`, "msg", "Setting saved");
}

export async function deleteProviderAction(fd: FormData) {
  await requireManager();
  const id = Number(fd.get("provider_id"));
  const { n } = getDb().prepare("SELECT COUNT(*) AS n FROM cases WHERE impulse_id = ?").get(id) as { n: number };
  if (n > 0) back(`/providers/${id}`, "error", `Cannot delete: ${n} case(s) reference this setting`);
  getDb().prepare("DELETE FROM providers WHERE provider_id = ?").run(id);
  revalidatePath("/providers");
  back("/providers", "msg", `Setting ${id} deleted`);
}

// ---------- Admin ----------

export async function importClaimsAction() {
  const user = await requireManager();
  const result = await runImport(user.id);
  revalidatePath("/cases");
  redirect(`/admin?batch=${result.batchId}`);
}

export async function createUserAction(fd: FormData) {
  await requireManager();
  const username = str(fd, "username");
  const display = str(fd, "display_name");
  const role = str(fd, "role");
  const password = String(fd.get("password") ?? "");
  if (!/^[A-Za-z0-9._-]{2,50}$/.test(username)) back("/admin/users", "error", "Username: 2-50 letters, numbers, . _ -");
  if (!display) back("/admin/users", "error", "Display name is required");
  if (role !== "manager" && role !== "user") back("/admin/users", "error", "Invalid role");
  if (password.length < 8) back("/admin/users", "error", "Password must be at least 8 characters");
  const db = getDb();
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    back("/admin/users", "error", `Username ${username} is taken`);
  }
  db.prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES (?,?,?,?)").run(
    username,
    display,
    hashPassword(password),
    role
  );
  back("/admin/users", "msg", `User ${username} created`);
}

export async function updateUserAction(fd: FormData) {
  const me = await requireManager();
  const id = Number(fd.get("id"));
  const role = str(fd, "role");
  const active = fd.get("active") === "on" ? 1 : 0;
  const display = str(fd, "display_name");
  const password = String(fd.get("password") ?? "");
  if (role !== "manager" && role !== "user") back("/admin/users", "error", "Invalid role");
  if (!display) back("/admin/users", "error", "Display name is required");
  if (id === me.id && (role !== "manager" || !active)) {
    back("/admin/users", "error", "You cannot demote or deactivate your own account");
  }
  if (password && password.length < 8) back("/admin/users", "error", "Password must be at least 8 characters");
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE users SET display_name = ?, role = ?, active = ? WHERE id = ?").run(display, role, active, id);
    if (password) db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), id);
    if (!active || password) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  })();
  back("/admin/users", "msg", "User updated");
}
