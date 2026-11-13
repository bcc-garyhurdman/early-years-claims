import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProvider } from "@/lib/providers";
import { deleteProviderAction } from "@/app/actions";
import ProviderForm from "@/components/ProviderForm";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";

export default async function ProviderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const p = /^\d+$/.test(id) ? getProvider(Number(id)) : undefined;
  if (!p) notFound();

  const rows: [string, string | number | null][] = [
    ["Provider ID", p.provider_id],
    ["Provider name", p.provider_name],
    ["Contact", p.contact],
    ["Contact number", p.contact_number],
    ["Contact email", p.contact_email],
    ["Judgement", p.judgement],
    ["2YO", p.two_yo],
  ];

  return (
    <>
      <Link href="/providers" className="muted">← Settings</Link>
      <div className="row" style={{ marginTop: 4 }}>
        <h1 style={{ margin: 0 }}>{p.provider_name}</h1>
        <Link href={`/cases?provider=${p.provider_id}`} className="btn secondary">View cases</Link>
      </div>
      <Flash {...sp} />
      <div className="card">
        {user.role === "manager" ? (
          <ProviderForm provider={p} />
        ) : (
          <dl className="fields">
            {rows.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v ?? <span className="muted">—</span>}</dd></div>
            ))}
          </dl>
        )}
      </div>
      {user.role === "manager" && (
        <form action={deleteProviderAction}>
          <input type="hidden" name="provider_id" value={p.provider_id} />
          <SubmitButton className="danger" confirm={`Delete setting ${p.provider_id}?`}>Delete setting</SubmitButton>
        </form>
      )}
    </>
  );
}
