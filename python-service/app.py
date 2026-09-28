from flask import Flask, jsonify, request
from flask_cors import CORS
import os

from extractor import extract_statement

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_PDF_SIZE_MB", "50")) * 1024 * 1024

TESSERACT_CMD = os.getenv("TESSERACT_CMD")
if TESSERACT_CMD:
    try:
        import pytesseract

        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    except Exception:
        pass


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "bank2excel-extractor"})


@app.post("/extract")
def extract():
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No PDF file uploaded."}), 400

    upload = request.files["file"]
    filename = upload.filename or "statement.pdf"
    if not filename.lower().endswith(".pdf"):
        return jsonify({"ok": False, "error": "Only PDF files are supported."}), 400

    data = upload.read()
    if not data:
        return jsonify({"ok": False, "error": "The uploaded PDF is empty."}), 400

    try:
        result = extract_statement(data, filename)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Extraction failed: {exc}"}), 500


if __name__ == "__main__":
    port = int(os.getenv("EXTRACTOR_PORT", "5001"))
    app.run(host="127.0.0.1", port=port, debug=False)
