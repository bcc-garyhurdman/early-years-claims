import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listProviders } from "@/lib/providers";
import Flash from "@/components/Flash";

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; msg?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const providers = listProviders(sp.q);

  return (
    <>
      <div className="row">
        <h1 style={{ margin: 0 }}>Settings</h1>
        {user.role === "manager" && <Link href="/providers/new" className="btn">Add setting</Link>}
      </div>
      <Flash msg={sp.msg} error={sp.error} />
      <form className="inline card" method="get">
        <label>
          Search
          <input name="q" defaultValue={sp.q} placeholder="Name, Provider ID or contact" size={34} />
        </label>
        <button type="submit">Search</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Provider ID</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Contact number</th>
              <th>Contact email</th>
              <th>Judgement</th>
              <th>2YO</th>
              <th>Cases (open)</th>
            </tr>
          </thead>
          <tbody>
            {providers.length === 0 && (
              <tr><td colSpan={8} className="muted">No settings found.</td></tr>
            )}
            {providers.map((p) => (
              <tr key={p.provider_id}>
                <td><Link href={`/providers/${p.provider_id}`}>{p.provider_id}</Link></td>
                <td><Link href={`/providers/${p.provider_id}`}>{p.provider_name}</Link></td>
                <td>{p.contact}</td>
                <td>{p.contact_number}</td>
                <td>{p.contact_email && <a href={`mailto:${p.contact_email}`}>{p.contact_email}</a>}</td>
                <td>{p.judgement}</td>
                <td>{p.two_yo}</td>
                <td>
                  <Link href={`/cases?provider=${p.provider_id}`}>{p.case_count}</Link> ({p.open_count ?? 0})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
