export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge s-${status.replace(/\s/g, "")}`}>{status}</span>;
}
