import type { Provider } from "@/lib/providers";
import { saveProviderAction } from "@/app/actions";
import SubmitButton from "./SubmitButton";

export default function ProviderForm({ provider }: { provider?: Provider }) {
  return (
    <form action={saveProviderAction} className="stack" style={{ maxWidth: 520 }}>
      <input type="hidden" name="originalId" value={provider?.provider_id ?? ""} />
      <label>
        Provider ID (matches Impulse ID on claims)
        <input name="provider_id" type="number" min={0} step={1} required defaultValue={provider?.provider_id} />
      </label>
      <label>Provider name<input name="provider_name" required defaultValue={provider?.provider_name} /></label>
      <label>Contact<input name="contact" defaultValue={provider?.contact ?? ""} /></label>
      <label>Contact number<input name="contact_number" type="tel" defaultValue={provider?.contact_number ?? ""} /></label>
      <label>Contact email<input name="contact_email" type="email" defaultValue={provider?.contact_email ?? ""} /></label>
      <label>
        Judgement
        <input name="judgement" list="judgements" defaultValue={provider?.judgement ?? ""} />
        <datalist id="judgements">
          <option value="Outstanding" />
          <option value="Good" />
          <option value="Requires Improvement" />
          <option value="Inadequate" />
          <option value="Not yet inspected" />
        </datalist>
      </label>
      <label>
        2YO
        <input name="two_yo" defaultValue={provider?.two_yo ?? ""} placeholder="e.g. Y / N" />
      </label>
      {provider && (
        <p className="muted" style={{ margin: 0 }}>
          Changing the Provider ID also updates the Impulse ID on all of this setting&apos;s cases.
        </p>
      )}
      <div><SubmitButton>Save</SubmitButton></div>
    </form>
  );
}
