import { requireUser } from "@/lib/auth";
import { changeOwnPasswordAction } from "../actions";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  return (
    <>
      <h1>My account</h1>
      <Flash {...sp} />
      <div className="card" style={{ maxWidth: 420 }}>
        <p className="muted">
          Signed in as <b>{user.username}</b> ({user.role})
        </p>
        <h2>Change password</h2>
        <form action={changeOwnPasswordAction} className="stack">
          <label>Current password<input name="current" type="password" required autoComplete="current-password" /></label>
          <label>New password<input name="next" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label>Confirm new password<input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
          <SubmitButton>Change password</SubmitButton>
        </form>
      </div>
    </>
  );
}
