import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/fields";
import { createUserAction, updateUserAction } from "../../actions";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: "manager" | "user";
  active: number;
  created_at: string;
  open_cases: number;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const me = await requireManager();
  const sp = await searchParams;
  const users = getDb()
    .prepare(
      `SELECT u.*, (SELECT COUNT(*) FROM cases c WHERE c.assigned_to = u.id
                     AND c.status NOT IN ('Approved','Declined')) AS open_cases
         FROM users u ORDER BY u.active DESC, u.display_name`
    )
    .all() as UserRow[];

  return (
    <>
      <Link href="/admin" className="muted">← Admin</Link>
      <h1 style={{ marginTop: 4 }}>Users</h1>
      <Flash {...sp} />

      <section className="card">
        <h2>Add user</h2>
        <form action={createUserAction} className="inline">
          <label>Username<input name="username" required /></label>
          <label>Display name<input name="display_name" required /></label>
          <label>
            Role
            <select name="role" defaultValue="user">
              <option value="user">User (case worker)</option>
              <option value="manager">Manager</option>
            </select>
          </label>
          <label>Initial password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <SubmitButton>Add user</SubmitButton>
        </form>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th><th>Display name</th><th>Role</th><th>Active</th>
              <th>Reset password</th><th>Open cases</th><th>Created</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const formId = `user-${u.id}`;
              return (
                <tr key={u.id}>
                  <td>
                    {u.username}
                    {u.id === me.id && <span className="muted"> (you)</span>}
                    <form id={formId} action={updateUserAction}>
                      <input type="hidden" name="id" value={u.id} />
                    </form>
                  </td>
                  <td><input form={formId} name="display_name" defaultValue={u.display_name} required /></td>
                  <td>
                    <select form={formId} name="role" defaultValue={u.role}>
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                    </select>
                  </td>
                  <td><input form={formId} type="checkbox" name="active" defaultChecked={!!u.active} /></td>
                  <td>
                    <input form={formId} name="password" type="password" placeholder="Leave blank to keep" autoComplete="new-password" />
                  </td>
                  <td>
                    <Link href={`/cases?assignee=${u.id}&status=open`}>{u.open_cases}</Link>
                  </td>
                  <td className="muted">{formatDateTime(u.created_at)}</td>
                  <td><button form={formId} type="submit" className="secondary">Save</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
