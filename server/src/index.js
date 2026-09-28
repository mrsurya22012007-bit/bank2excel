import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { batchesRouter } from "./routes/batches.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1,
  });
});

app.use("/api/batches", batchesRouter);

app.use((error, _req, res, _next) => {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "PDF exceeds the 50MB upload limit." });
  }
  res.status(400).json({ error: error.message || "Request failed." });
});

async function start() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bank2excel";
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`Bank2Excel API listening on http://127.0.0.1:${port}`);
  });
}

start();
