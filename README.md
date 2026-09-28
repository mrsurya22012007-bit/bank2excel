# Bank2Excel

Convert bank statement PDFs into verified, editable ledgers and Excel workbooks. The app has exactly two pages: **Convert Statement** and **Batch History**.

## Requirements

- Node.js 18+
- Python 3.10+
- MongoDB running locally (default `mongodb://127.0.0.1:27017/bank2excel`)
- Optional for scanned PDFs: [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) and [Poppler](https://poppler.freedesktop.org/) (`pdf2image`)

## Setup

```bash
cd server
copy .env.example .env
npm install

cd ../client
npm install

cd ../python-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

On macOS/Linux, activate the venv with `source .venv/bin/activate` and copy env with `cp server/.env.example server/.env`.

## Start (three terminals)

1. MongoDB must already be running.

2. PDF extractor:

```bash
cd python-service
.venv\Scripts\activate
python app.py
```

3. API:

```bash
cd server
npm run dev
```

4. Frontend:

```bash
cd client
npm run dev
```

Open http://localhost:5173

- Convert Statement: http://localhost:5173/
- Batch History: http://localhost:5173/history
