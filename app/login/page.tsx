import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "../actions";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/cases?status=open");
  const { error } = await searchParams;
  return (
    <div className="login card">
      <h1>Early Years Claims</h1>
      <Flash error={error} />
      <form action={loginAction} className="stack">
        <label>Username<input name="username" autoComplete="username" required autoFocus /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      </form>
    </div>
  );
}
