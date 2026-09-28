import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    date: String,
    valueDate: String,
    description: String,
    reference: String,
    debit: Number,
    credit: Number,
    extractedBalance: Number,
    runningBalance: Number,
    confidence: Number,
    flags: [String],
    status: { type: String, enum: ["verified", "review"], default: "review" },
  },
  { _id: false }
);

const batchSchema = new mongoose.Schema(
  {
    originalFilename: { type: String, required: true },
    sha256: String,
    pageCount: Number,
    transactionCount: { type: Number, default: 0 },
    extractionMethod: String,
    ocrUsed: { type: Boolean, default: false },
    bankHint: String,
    accountHint: String,
    openingBalance: Number,
    statedClosingBalance: Number,
    calculatedClosingBalance: Number,
    totalCredits: Number,
    totalDebits: Number,
    netDelta: Number,
    creditCount: Number,
    debitCount: Number,
    flaggedCount: Number,
    discrepancy: Number,
    reconciliationStatus: {
      type: String,
      enum: ["balanced", "mismatch", "review", "failed"],
      default: "review",
    },
    warnings: [String],
    error: String,
    transactions: [transactionSchema],
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

batchSchema.index({ originalFilename: "text" });
batchSchema.index({ processedAt: -1 });
batchSchema.index({ reconciliationStatus: 1 });

export const Batch = mongoose.model("Batch", batchSchema);
