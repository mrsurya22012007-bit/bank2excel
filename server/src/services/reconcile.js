export function toMoney(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

export function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function reconcileBatch({ openingBalance, statedClosingBalance, transactions }) {
  const opening = toMoney(openingBalance);
  let running = opening ?? 0;
  let totalCredits = 0;
  let totalDebits = 0;
  let flaggedCount = 0;

  const rows = (transactions || []).map((tx, index) => {
    const debit = toMoney(tx.debit);
    const credit = toMoney(tx.credit);
    const extractedBalance = toMoney(tx.extractedBalance);
    const flags = new Set(tx.flags || []);

    if (debit != null) totalDebits = round2(totalDebits + Math.abs(debit));
    if (credit != null) totalCredits = round2(totalCredits + Math.abs(credit));

    if (opening != null) {
      running = round2(running + Math.abs(credit || 0) - Math.abs(debit || 0));
    } else if (extractedBalance != null && index === 0) {
      flags.add("opening-unknown");
      running = extractedBalance;
    } else {
      running = round2(running + Math.abs(credit || 0) - Math.abs(debit || 0));
    }

    if (extractedBalance != null && Math.abs(extractedBalance - running) > 0.009) {
      flags.add("balance-mismatch");
    }
    if ((tx.confidence ?? 1) < 0.75) flags.add("uncertain");
    if (debit == null && credit == null) flags.add("missing-amount");

    const status = flags.has("balance-mismatch") || flags.has("missing-amount") || flags.has("uncertain")
      ? "review"
      : "verified";
    if (status === "review") flaggedCount += 1;

    return {
      ...tx,
      debit: debit != null ? Math.abs(debit) : null,
      credit: credit != null ? Math.abs(credit) : null,
      extractedBalance,
      runningBalance: opening == null && extractedBalance == null && index === 0 ? null : running,
      flags: Array.from(flags),
      status,
    };
  });

  const calculatedClosing = opening == null
    ? (rows.at(-1)?.runningBalance ?? null)
    : round2(opening + totalCredits - totalDebits);

  const stated = toMoney(statedClosingBalance);
  const discrepancy = stated != null && calculatedClosing != null
    ? round2(stated - calculatedClosing)
    : calculatedClosing != null && rows.at(-1)?.extractedBalance != null
      ? round2(rows.at(-1).extractedBalance - calculatedClosing)
      : null;

  let reconciliationStatus = "review";
  if (rows.length === 0) reconciliationStatus = "failed";
  else if (flaggedCount > 0) reconciliationStatus = "review";
  else if (discrepancy != null && Math.abs(discrepancy) > 0.009) reconciliationStatus = "mismatch";
  else reconciliationStatus = "balanced";

  return {
    openingBalance: opening,
    statedClosingBalance: stated,
    calculatedClosingBalance: calculatedClosing,
    totalCredits,
    totalDebits,
    netDelta: round2(totalCredits - totalDebits),
    creditCount: rows.filter((row) => (row.credit || 0) > 0).length,
    debitCount: rows.filter((row) => (row.debit || 0) > 0).length,
    flaggedCount,
    discrepancy,
    reconciliationStatus,
    transactions: rows,
  };
}
