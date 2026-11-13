import Link from "next/link";
import { requireManager } from "@/lib/auth";
import ProviderForm from "@/components/ProviderForm";
import Flash from "@/components/Flash";

export default async function NewProviderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireManager();
  const { error } = await searchParams;
  return (
    <>
      <Link href="/providers" className="muted">← Settings</Link>
      <h1>Add setting</h1>
      <Flash error={error} />
      <div className="card"><ProviderForm /></div>
    </>
  );
}
