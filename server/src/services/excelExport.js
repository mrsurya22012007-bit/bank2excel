import ExcelJS from "exceljs";

function money(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export async function buildWorkbook(batch) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bank2Excel";
  workbook.created = new Date();

  const ledger = workbook.addWorksheet("Transactions");
  ledger.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Description", key: "description", width: 48 },
    { header: "Reference Number", key: "reference", width: 20 },
    { header: "Debit", key: "debit", width: 16, style: { numFmt: "#,##0.00" } },
    { header: "Credit", key: "credit", width: 16, style: { numFmt: "#,##0.00" } },
    { header: "Balance", key: "balance", width: 16, style: { numFmt: "#,##0.00" } },
    { header: "Status", key: "status", width: 12 },
    { header: "Flags", key: "flags", width: 28 },
  ];
  ledger.getRow(1).font = { bold: true, color: { argb: "FFF8E7C9" } };
  ledger.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };

  batch.transactions.forEach((tx) => {
    ledger.addRow({
      date: tx.date || "",
      description: tx.description || "",
      reference: tx.reference || "",
      debit: money(tx.debit),
      credit: money(tx.credit),
      balance: money(tx.runningBalance),
      status: tx.status || "",
      flags: (tx.flags || []).join(", "),
    });
  });

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 32 },
    { header: "Value", key: "value", width: 24 },
  ];
  summary.getRow(1).font = { bold: true, color: { argb: "FFF8E7C9" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
  const summaryRows = [
    ["Filename", batch.originalFilename],
    ["Processed At", batch.processedAt?.toISOString?.() || batch.processedAt],
    ["Transaction Count", batch.transactionCount],
    ["Opening Balance", money(batch.openingBalance)],
    ["Total Credits", money(batch.totalCredits)],
    ["Total Debits", money(batch.totalDebits)],
    ["Calculated Closing Balance", money(batch.calculatedClosingBalance)],
    ["Stated Closing Balance", money(batch.statedClosingBalance)],
    ["Discrepancy", money(batch.discrepancy)],
    ["Reconciliation Status", batch.reconciliationStatus],
    ["Verification Formula", "Opening + Credits - Debits = Closing"],
  ];
  summaryRows.forEach((row) => summary.addRow({ metric: row[0], value: row[1] ?? "" }));

  const audit = workbook.addWorksheet("Audit");
  audit.columns = [
    { header: "Check", key: "check", width: 40 },
    { header: "Result", key: "result", width: 48 },
  ];
  audit.getRow(1).font = { bold: true, color: { argb: "FFF8E7C9" } };
  audit.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
  const formula =
    `(${batch.openingBalance ?? 0}) + (${batch.totalCredits ?? 0}) - (${batch.totalDebits ?? 0}) = ${batch.calculatedClosingBalance ?? ""}`;
  audit.addRow({ check: "Balance identity", result: formula });
  audit.addRow({
    check: "Discrepancy vs stated close",
    result: batch.discrepancy == null ? "Stated close not extracted" : batch.discrepancy,
  });
  audit.addRow({ check: "Extraction method", result: batch.extractionMethod });
  audit.addRow({ check: "OCR used", result: batch.ocrUsed ? "Yes" : "No" });
  audit.addRow({ check: "Warnings", result: (batch.warnings || []).join(" | ") || "None" });
  audit.addRow({
    check: "Flagged rows",
    result: (batch.transactions || []).filter((tx) => tx.status === "review").length,
  });

  return workbook;
}
