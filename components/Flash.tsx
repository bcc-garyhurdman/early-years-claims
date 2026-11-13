export default function Flash({ msg, error }: { msg?: string; error?: string }) {
  if (error === "forbidden") error = "That page is only available to managers.";
  return (
    <>
      {msg && <div className="flash msg">{msg}</div>}
      {error && <div className="flash error">{error}</div>}
    </>
  );
}
