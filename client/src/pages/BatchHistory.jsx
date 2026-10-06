import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

function money(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

const statusLabel = {
  balanced: "Balanced",
  mismatch: "Mismatch",
  review: "Needs review",
  failed: "Failed",
};

export default function BatchHistory() {
  const [batches, setBatches] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const data = await api.listBatches({ q, status });
      setBatches(data.batches);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(id) {
    if (!window.confirm("Delete this batch from history?")) return;
    await api.deleteBatch(id);
    load();
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 px-4 py-8 lg:px-6">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-100 p-6 shadow-[0_14px_40px_rgba(23,59,108,0.14)]">
        <h1 className="font-serif text-3xl">Batch History</h1>
        <p className="mt-2 max-w-3xl text-ink/70">
          Previously processed statements stored in MongoDB. Search by filename or bank, filter by reconciliation status, then view, download, or delete a batch.
        </p>
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search filename or bank..."
            className="flex-1 rounded-full border border-ink/15 px-4 py-2"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-full border border-ink/15 bg-white px-4 py-2"
          >
            <option value="all">All statuses</option>
            <option value="balanced">Balanced</option>
            <option value="mismatch">Mismatch</option>
            <option value="review">Needs review</option>
            <option value="failed">Failed</option>
          </select>
          <button type="button" onClick={load} className="rounded-full bg-ink px-5 py-2 text-champagne">
            {busy ? "Loading…" : "Apply filters"}
          </button>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-ink text-champagne">
              <tr>
                <th className="px-4 py-3 font-medium">Filename</th>
                <th className="px-4 py-3 font-medium">Processed</th>
                <th className="px-4 py-3 font-medium">Transactions</th>
                <th className="px-4 py-3 font-medium">Closing</th>
                <th className="px-4 py-3 font-medium">Reconciliation</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch._id} className="border-t border-ink/10">
                  <td className="px-4 py-3">
                    <p className="font-medium">{batch.originalFilename}</p>
                    <p className="text-xs text-ink/50">{batch.bankHint || "Bank not identified"}</p>
                  </td>
                  <td className="px-4 py-3">{batch.processedAt ? new Date(batch.processedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">{batch.transactionCount ?? 0}</td>
                  <td className="px-4 py-3">{money(batch.calculatedClosingBalance)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        batch.reconciliationStatus === "balanced"
                          ? "bg-emerald-100 text-emerald-800"
                          : batch.reconciliationStatus === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {statusLabel[batch.reconciliationStatus] || batch.reconciliationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/?batch=${batch._id}`} className="rounded-full border border-ink/20 px-3 py-1">
                        View
                      </Link>
                      <a href={api.exportUrl(batch._id, "xlsx")} className="rounded-full border border-ink/20 px-3 py-1">
                        Download
                      </a>
                      <button type="button" onClick={() => remove(batch._id)} className="rounded-full border border-red-200 px-3 py-1 text-red-700">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!batches.length && (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-ink/50">
                    No batches stored yet. Convert a statement to create history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
