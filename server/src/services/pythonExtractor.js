import axios from "axios";
import FormData from "form-data";

const EXTRACTOR_URL = process.env.PYTHON_EXTRACTOR_URL || "http://127.0.0.1:5001";

export async function extractPdfBuffer(buffer, filename) {
  const form = new FormData();
  form.append("file", buffer, { filename, contentType: "application/pdf" });

  try {
    const response = await axios.post(`${EXTRACTOR_URL}/extract`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120000,
    });
    return response.data;
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      const err = new Error("PDF extractor is not running. Start the Python service on port 5001.");
      err.status = 503;
      throw err;
    }
    const message = error.response?.data?.error || error.message || "Extraction request failed.";
    const err = new Error(message);
    err.status = error.response?.status || 500;
    throw err;
  }
}
