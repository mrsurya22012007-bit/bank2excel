import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { profiles } from "../components/Layout.jsx";

const emptyFilters = "all";

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function signedMoney(value, sign) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Math.abs(Number(value));
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${sign}$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ConvertStatement() {
  const [params, setParams] = useSearchParams();
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(emptyFilters);
  const [query, setQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const loadBatch = useCallback(async (id) => {
    const data = await api.getBatch(id);
    setBatch(data.batch);
  }, []);

  useEffect(() => {
    const id = params.get("batch");
    if (!id) return;
    loadBatch(id).catch((err) => setError(err.message));
  }, [params, loadBatch]);

  async function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF bank statements are supported.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api.uploadPdf(file);
      setBatch(data.batch);
      setParams({ batch: data.batch._id });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function updateTx(index, field, value) {
    setBatch((current) => {
      if (!current) return current;
      const transactions = current.transactions.map((tx, i) =>
        i === index ? { ...tx, [field]: value } : tx
      );
      return { ...current, transactions };
    });
  }

  function addRow() {
    setBatch((current) => {
      if (!current) return current;
      return {
        ...current,
        transactions: [
          ...current.transactions,
          {
            date: "",
            valueDate: "",
            description: "",
            reference: "",
            debit: null,
            credit: null,
            extractedBalance: null,
            runningBalance: null,
            flags: ["manual"],
            status: "review",
          },
        ],
      };
    });
  }

  async function saveAndRecalculate() {
    if (!batch?._id) return;
    setBusy(true);
    setError("");
    try {
      const data = await api.saveBatch(batch._id, {
        openingBalance: batch.openingBalance,
        statedClosingBalance: batch.statedClosingBalance,
        transactions: batch.transactions,
      });
      setBatch(data.batch);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function resetStatement() {
    setBatch(null);
    setParams({});
    setError("");
    setFilter("all");
    setQuery("");
  }

  const visible = useMemo(() => {
    const rows = batch?.transactions || [];
    return rows
      .map((tx, index) => ({ tx, index }))
      .filter(({ tx }) => {
        if (filter === "credits") return (tx.credit || 0) > 0;
        if (filter === "debits") return (tx.debit || 0) > 0;
        if (filter === "flagged") return tx.status === "review";
        return true;
      })
      .filter(({ tx }) => {
        if (!query.trim()) return true;
        const hay = `${tx.description || ""} ${tx.reference || ""}`.toLowerCase();
        return hay.includes(query.toLowerCase());
      });
  }, [batch, filter, query]);

  const identityHolds =
    batch &&
    batch.discrepancy != null &&
    Math.abs(batch.discrepancy) <= 0.009 &&
    batch.reconciliationStatus === "balanced";

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 rounded-[2rem] bg-white/30 px-4 py-8 lg:px-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-ink/10 bg-[#fffdf8]/95 p-6 shadow-[0_14px_40px_rgba(6,78,59,0.12)]">
        <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full bg-champagne/70 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage text-ink shadow">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" />
                <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-2xl">
                  {batch?.originalFilename || "Upload a bank statement PDF"}
                </h1>
                {batch && (
                  <span className="rounded bg-ink px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-champagne">
                    {batch.reconciliationStatus === "failed" ? "FAILED" : "EXTRACTED"}
                  </span>
                )}
              </div>
              {batch?.sha256 && (
                <p className="mt-1 rounded bg-parchment px-2 py-0.5 font-mono text-[11px] text-ink/70 inline-block">
                  SHA-256: {batch.sha256.slice(0, 4)}..{batch.sha256.slice(-4)}
                </p>
              )}
              <p className="mt-2 text-sm text-ink/70">
                {batch?.bankHint || "Bank not identified"}
                <span className="mx-2">•</span>
                Acct: {batch?.accountHint || "—"}
                <span className="mx-2">•</span>
                {batch?.pageCount || 0} Pages
                <span className="mx-2">•</span>
                {batch?.transactionCount || 0} Ledger Entries Detected
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={resetStatement} className="rounded-full border border-ink/20 bg-white px-4 py-2 text-sm">
              New Statement
            </button>
            <a
              className={`rounded-full border border-ink/20 px-4 py-2 text-sm ${batch ? "" : "pointer-events-none opacity-40"}`}
              href={batch ? api.exportUrl(batch._id, "csv") : "#"}
            >
              Export CSV
            </a>
            <a
              className={`rounded-full bg-ink px-4 py-2 text-sm text-champagne ${batch ? "" : "pointer-events-none opacity-40"}`}
              href={batch ? api.exportUrl(batch._id, "xlsx") : "#"}
            >
              Download Excel (.xlsx)
            </a>
          </div>
        </div>
      </section>

      <section
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`rounded-3xl border-2 border-dashed border-ink/20 bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-100 px-6 py-14 text-center shadow-[0_12px_40px_rgba(6,78,59,0.12)] ${
          dragOver ? "border-ink bg-sage/40" : "border-ink/20"
        }`}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sage text-ink">
          <svg width="22" height="26" viewBox="0 0 24 28" fill="none">
            <path d="M7 26h10a3 3 0 0 0 3-3V10l-7-8H7a3 3 0 0 0-3 3v18a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </div>
        <h2 className="font-sans text-2xl font-semibold">Drag & drop bank statement PDF here or browse local ledger files</h2>
        <p className="mx-auto mt-3 max-w-2xl text-ink/70">
          Supports scanned raster or native vector bank PDFs (up to 50MB). Automated tabular tokenization via Python Flask, pdfplumber & OCR fallback.
        </p>
       <button
  type="button"
  disabled={busy}
  onClick={() => inputRef.current?.click()}
  className="mt-6 rounded-full bg-ink px-5 py-2 text-sm text-white"
>
  {busy ? "Extracting…" : "Upload a PDF • Processed temporarily • Original file not stored"}
</button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </section>

      <p className="text-[11px] tracking-[0.14em] text-ink/50">
        VALIDATED LAYOUT PROFILES:
        {profiles.map((name) => (
          <span key={name} className="ml-3 text-ink/80 tracking-normal">
            {name}
          </span>
        ))}
      </p>

      <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-100 p-6 shadow-[0_14px_40px_rgba(23,59,108,0.14)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
  <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-ink">
    <span className="inline-block h-4 w-4 rounded-sm border border-ink" />
    AUTOMATED AUDIT & BALANCE VERIFICATION
  </h2>
  <p className="text-xs font-medium text-ink/80">Method: Discrete Interval Summation</p>
</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="OPENING BALANCE"
            value={
              <input
                className="w-full bg-transparent font-serif text-2xl outline-none"
                value={batch?.openingBalance ?? ""}
                placeholder="—"
                onChange={(event) =>
                  setBatch((current) => current && { ...current, openingBalance: event.target.value === "" ? null : event.target.value })
                }
              />
            }
            hint="Stated Ledger Start"
          />
          <Metric label="TOTAL CREDITS (+)" value={signedMoney(batch?.totalCredits, "+")} hint={`${batch?.creditCount || 0} Incoming Deposits`} valueClass="text-emerald-700" />
          <Metric label="TOTAL DEBITS (-)" value={signedMoney(batch?.totalDebits, "-")} hint={`${batch?.debitCount || 0} Outgoing Payments`} valueClass="text-red-700" />
          <Metric label="NET CASH DELTA" value={signedMoney(batch?.netDelta, (batch?.netDelta || 0) >= 0 ? "+" : "-")} hint="Credits minus Debits" />
          <div className="rounded-xl bg-ink p-4 text-champagne">
            <p className="text-[11px] tracking-wide">CLOSING BALANCE</p>
            <p className="mt-2 font-serif text-2xl">{money(batch?.calculatedClosingBalance)}</p>
            <p className="mt-2 text-xs text-champagne/70">
              {batch?.discrepancy == null ? "Stated close not extracted" : `Delta vs stated: ${money(batch.discrepancy)}`}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-ink/10 bg-cream px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <strong>Verification Proof: Discrepancy {money(batch?.discrepancy ?? 0)}</strong>
            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${identityHolds ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {identityHolds ? "AUDIT CONFIRMED" : "NEEDS REVIEW"}
            </span>
          </div>
          <p className="mt-1 text-ink/70">
            Opening ({money(batch?.openingBalance)}) + Credits ({money(batch?.totalCredits)}) − Debits ({money(batch?.totalDebits)}) = Calculated Closing ({money(batch?.calculatedClosingBalance)})
          </p>
        </div>
      </section>

      <section className="rounded-3xl border-2 border-blue-200 bg-gradient-to-br from-sky-50 via-white to-blue-100 p-4 shadow-[0_20px_50px_rgba(23,59,108,0.14)] backdrop-blur-md md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[
            ["all", `All (${batch?.transactionCount || 0})`],
            ["credits", `Credits (${batch?.creditCount || 0})`],
            ["debits", `Debits (${batch?.debitCount || 0})`],
            ["flagged", `Flagged (${batch?.flaggedCount || 0})`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-sm ${filter === key ? "bg-ink text-champagne" : "bg-parchment text-ink/80"}`}
            >
              {label}
            </button>
          ))}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter payee, check #, memo..."
            className="min-w-[180px] flex-1 rounded-full border border-ink/10 px-4 py-1.5 text-sm"
          />
          <button type="button" onClick={addRow} className="rounded-full border border-ink/20 px-3 py-1.5 text-sm">
            Add Row
          </button>
          <button type="button" onClick={saveAndRecalculate} disabled={!batch || busy} className="rounded-full bg-ink px-3 py-1.5 text-sm text-champagne">
            Recalculate Balances
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="text-[11px] font-semibold tracking-wide text-ink/80">
              <tr>
                <th className="px-2 py-2">DATE</th>
                <th className="px-2 py-2">DESCRIPTION</th>
                <th className="px-2 py-2">REFERENCE NUMBER</th>
                <th className="px-2 py-2 text-right">DEBIT</th>
                <th className="px-2 py-2 text-right">CREDIT</th>
                <th className="px-2 py-2 text-right">BALANCE</th>
                <th className="px-2 py-2">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ tx, index }) => (
                <tr key={`${index}-${tx.date}-${tx.reference}`} className="border-t border-ink/5">
                  <td className="px-2 py-2">
                    <input className="w-28 bg-transparent outline-none" value={tx.date || ""} onChange={(e) => updateTx(index, "date", e.target.value)} />
                  </td>
                  <td className="px-2 py-2">
                    <input className="w-full min-w-[220px] bg-transparent outline-none" value={tx.description || ""} onChange={(e) => updateTx(index, "description", e.target.value)} />
                  </td>
                  <td className="px-2 py-2">
                    <input className="w-32 bg-transparent outline-none" value={tx.reference || ""} onChange={(e) => updateTx(index, "reference", e.target.value)} />
                  </td>
                  <td className="px-2 py-2 text-right text-red-700">
                    <input className="w-24 bg-transparent text-right outline-none" value={tx.debit ?? ""} onChange={(e) => updateTx(index, "debit", e.target.value)} />
                  </td>
                  <td className="px-2 py-2 text-right text-emerald-700">
                    <input className="w-24 bg-transparent text-right outline-none" value={tx.credit ?? ""} onChange={(e) => updateTx(index, "credit", e.target.value)} />
                  </td>
                  <td className="px-2 py-2 text-right font-medium">{money(tx.runningBalance)}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${tx.status === "verified" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                      {tx.status === "verified" ? "Verified" : "Review"}
                    </span>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan="7" className="px-2 py-10 text-center text-ink/50">
                    No transactions yet. Upload a statement — missing values are never invented.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs font-medium text-ink/70">
          Running Balance Logic: Balance[i] = Balance[i-1] + Credit[i] − Debit[i]. Showing {visible.length} of {batch?.transactionCount || 0} ledger lines.
        </p>
      </section>

      <section className="rounded-3xl border border-ink/10 bg-white/90 p-6 shadow-[0_12px_40px_rgba(6,78,59,0.10)] backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
         <div>
  <h2 className="font-sans text-xl font-semibold text-ink">
  Excel Export Configuration
  </h2>
  <p className="text-sm text-ink/80">
    Structured workbooks with audit formulas. Workbook format: Excel 2010+ (.xlsx)
  </p>
</div>
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-2 text-sm">
          <ul className="space-y-2">
            <li>Sheet 1: Standardized Transactions Ledger</li>
            <li>Sheet 2: Monthly Summary & Cash Delta</li>
            <li>Sheet 3: Mathematical Audit Trail & Checksums</li>
          </ul>
          <ul className="space-y-2 text-ink/70">
            <li>Never fills invented amounts, dates, or references.</li>
            <li>Flags OCR, uncertain parses, and running-balance mismatches.</li>
            <li>Uses ExcelJS on the Express API.</li>
          </ul>
        </div>
        <div className="mt-6 flex flex-col gap-3 rounded-xl bg-ink px-4 py-4 text-champagne md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium">Ready for Reconciled Spreadsheet Dispatch</p>
            <p className="text-sm text-champagne/70">{batch?.originalFilename || "No statement loaded"}</p>
          </div>
          <a
            className={`rounded-full bg-champagne px-5 py-2 text-center text-sm font-semibold text-ink ${batch ? "" : "pointer-events-none opacity-40"}`}
            href={batch ? api.exportUrl(batch._id, "xlsx") : "#"}
          >
            Download Reconciled Excel (.xlsx)
          </a>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, hint, valueClass = "" }) {
  return (
    <div className="rounded-xl bg-cream p-4">
      <p className="text-[11px] font-semibold tracking-wide text-ink/80">{label}</p>
      <div className={`mt-2 font-serif text-2xl ${valueClass}`}>{value}</div>
      <p className="mt-2 text-xs font-medium text-ink/70">{hint}</p>
    </div>
  );
}

