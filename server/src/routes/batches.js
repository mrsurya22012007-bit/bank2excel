import { Router } from "express";
import multer from "multer";
import { Batch } from "../models/Batch.js";
import { extractPdfBuffer } from "../services/pythonExtractor.js";
import { reconcileBatch } from "../services/reconcile.js";
import { buildWorkbook } from "../services/excelExport.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.MAX_PDF_SIZE_MB) || 50) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(new Error("Only PDF files are supported."));
      return;
    }
    cb(null, true);
  },
});

export const batchesRouter = Router();

function applyExtraction(batch, extracted, openingOverride) {
  const reconciled = reconcileBatch({
    openingBalance: openingOverride ?? extracted.openingBalance,
    statedClosingBalance: extracted.statedClosingBalance,
    transactions: extracted.transactions || [],
  });
  Object.assign(batch, reconciled, {
    originalFilename: extracted.filename || batch.originalFilename,
    sha256: extracted.sha256,
    pageCount: extracted.pageCount,
    transactionCount: reconciled.transactions.length,
    extractionMethod: extracted.extractionMethod,
    ocrUsed: extracted.ocrUsed,
    bankHint: extracted.bankHint,
    accountHint: extracted.accountHint,
    warnings: extracted.warnings || [],
    error: extracted.ok === false ? extracted.error : undefined,
    processedAt: new Date(),
  });
  return batch;
}

batchesRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Upload a bank statement PDF." });
  }
  try {
    const extracted = await extractPdfBuffer(req.file.buffer, req.file.originalname);
    const batch = new Batch({ originalFilename: req.file.originalname });
    applyExtraction(batch, { ...extracted, filename: req.file.originalname });
    if (!extracted.ok) {
      batch.reconciliationStatus = "failed";
      batch.error = extracted.error;
    }
    await batch.save();
    if (!extracted.ok) {
      return res.status(422).json({ error: extracted.error, batch });
    }
    return res.status(201).json({ batch });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Upload failed." });
  }
});

batchesRouter.get("/", async (req, res) => {
  const { q, status } = req.query;
  const filter = {};
  if (status && status !== "all") filter.reconciliationStatus = status;
  if (q) {
    filter.$or = [
      { originalFilename: { $regex: String(q), $options: "i" } },
      { bankHint: { $regex: String(q), $options: "i" } },
    ];
  }
  const batches = await Batch.find(filter)
    .sort({ processedAt: -1 })
    .select("-transactions")
    .lean();
  res.json({ batches });
});

batchesRouter.get("/:id", async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: "Batch not found." });
  res.json({ batch });
});

batchesRouter.patch("/:id", async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: "Batch not found." });

  const openingBalance = req.body.openingBalance ?? batch.openingBalance;
  const statedClosingBalance = req.body.statedClosingBalance ?? batch.statedClosingBalance;
  const transactions = req.body.transactions ?? batch.transactions;

  const reconciled = reconcileBatch({ openingBalance, statedClosingBalance, transactions });
  Object.assign(batch, reconciled, { transactionCount: reconciled.transactions.length });
  await batch.save();
  res.json({ batch });
});

batchesRouter.post("/:id/recalculate", async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: "Batch not found." });
  const reconciled = reconcileBatch({
    openingBalance: batch.openingBalance,
    statedClosingBalance: batch.statedClosingBalance,
    transactions: batch.transactions,
  });
  Object.assign(batch, reconciled, { transactionCount: reconciled.transactions.length });
  await batch.save();
  res.json({ batch });
});

batchesRouter.get("/:id/export", async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: "Batch not found." });
  const workbook = await buildWorkbook(batch);
  const format = req.query.format === "csv" ? "csv" : "xlsx";
  const base = (batch.originalFilename || "statement").replace(/\.pdf$/i, "");

  if (format === "csv") {
    const header = ["Date", "Description", "Reference Number", "Debit", "Credit", "Balance", "Status"];
    const lines = [header.join(",")];
    for (const tx of batch.transactions || []) {
      const cells = [tx.date, tx.description, tx.reference, tx.debit, tx.credit, tx.runningBalance, tx.status].map(
        (value) => `"${String(value ?? "").replaceAll('"', '""')}"`
      );
      lines.push(cells.join(","));
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.csv"`);
    return res.send(lines.join("\n"));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${base}_Reconciled.xlsx"`);
  return res.send(Buffer.from(buffer));
});

batchesRouter.delete("/:id", async (req, res) => {
  const batch = await Batch.findByIdAndDelete(req.params.id);
  if (!batch) return res.status(404).json({ error: "Batch not found." });
  res.json({ ok: true });
});
