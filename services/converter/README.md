# Docly Self-Hosted Document Conversion Microservice

A high-performance, 100% permissively licensed microservice for converting between PDF and Microsoft Office formats (Word `.docx`, Excel `.xlsx`, PowerPoint `.pptx`).

Built for **Docly** to replace external paid conversion dependencies (like CloudConvert) with zero commercial licensing risk (no AGPL/GPL dependencies).

---

## Supported Conversions

| Direction | Source | Target | Engine Pipeline |
|---|---|---|---|
| PDF &rarr; Word | `.pdf` | `.docx` | `pdfplumber` + `python-docx` / LibreOffice Headless |
| PDF &rarr; Excel | `.pdf` | `.xlsx` | `pdfplumber` + `openpyxl` |
| PDF &rarr; PowerPoint | `.pdf` | `.pptx` | `pdfplumber` + `python-pptx` |
| Word &rarr; PDF | `.docx`, `.doc` | `.pdf` | LibreOffice Headless (`soffice`) / Windows COM |
| Excel &rarr; PDF | `.xlsx`, `.xls` | `.pdf` | LibreOffice Headless (`soffice`) / Windows COM |
| PowerPoint &rarr; PDF | `.pptx`, `.ppt` | `.pdf` | LibreOffice Headless (`soffice`) / Windows COM |

---

## Licensing Compliance

All included dependencies are 100% compliant with commercial SaaS deployment:

- **FastAPI / Uvicorn**: MIT / BSD-3-Clause
- **pdfplumber / pdfminer.six**: MIT
- **pypdf / pypdfium2**: BSD-3-Clause / Apache 2.0
- **python-docx / openpyxl / python-pptx**: MIT
- **Pillow**: HPND (Permissive)
- **LibreOffice Headless**: MPL 2.0 (weak file-level copyleft; CLI execution inside container does not affect SaaS codebase)

**Zero AGPL or GPL dependencies.**

---

## API Endpoints

### 1. Health Check
```http
GET /health
```
Response:
```json
{
  "status": "ok",
  "engines": {
    "pdf_to_docx": true,
    "pdf_to_pptx": true,
    "pdf_to_xlsx": true,
    "office_to_pdf": true
  },
  "version": "1.0.0"
}
```

### 2. Capabilities
```http
GET /capabilities
```
Response:
```json
{
  "supported_operations": [
    "pdf-to-word",
    "pdf-to-excel",
    "pdf-to-powerpoint",
    "word-to-pdf",
    "excel-to-pdf",
    "powerpoint-to-pdf"
  ],
  "max_file_size_bytes": 52428800,
  "concurrency_limit": 5,
  "timeout_seconds": 60
}
```

### 3. Convert Document
```http
POST /convert
Content-Type: multipart/form-data
X-Converter-Secret: <optional-secret>
```

Parameters:
- `file`: The document file (binary).
- `operation`: One of `pdf-to-word`, `pdf-to-excel`, `pdf-to-powerpoint`, `word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf`.
- *(Alternative)*: Provide `source_format` (`pdf`, `docx`, etc.) and `target_format` (`pdf`, `docx`, etc.).

---

## Local Development (Cost: ₹0)

### Option A: Python Native (Fastest for local testing)
Prerequisites: Python 3.10+

```bash
cd services/converter
pip install -r requirements.txt
python -m uvicorn src.server:app --host 0.0.0.0 --port 8001
```

### Option B: Docker
```bash
cd services/converter
docker build -t docly-converter .
docker run -p 8001:8001 docly-converter
```

Or via Docker Compose:
```bash
cd services/converter
docker compose up -d
```

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8001` | Microservice listening port |
| `CONVERTER_SECRET` | `""` | Optional shared secret for authentication |
| `MAX_CONCURRENT_CONVERSIONS` | `5` | Semaphore concurrency limit to protect server resources |
| `CONVERSION_TIMEOUT_SECONDS` | `60` | Maximum processing time before terminating request |

---

## Cloudflare Worker Configuration

To connect Docly's Cloudflare Worker / API layer to the conversion service:

In `.dev.vars` (or Cloudflare Worker environment variables in production):
```ini
DOCLY_CONVERTER_URL=http://localhost:8001
# Optional secret if CONVERTER_SECRET is enabled on the converter service:
DOCLY_CONVERTER_SECRET=your_converter_secret
```

---

## Production Deployment Options

1. **VPS (Hetzner / DigitalOcean / Linode / AWS EC2)** (~$4-$6/mo):
   - Run via Docker or Docker Compose behind Nginx/Caddy with SSL (`https://converter.yourdomain.com`).
2. **Google Cloud Run** (Free tier: 2 million requests/month, 180,000 vCPU-seconds free per month):
   - Push image to Google Artifact Registry:
     ```bash
     gcloud run deploy docly-converter --image gcr.io/PROJECT/docly-converter --platform managed --memory 2Gi --timeout 90s
     ```
3. **Render / Fly.io / Railway**:
   - Deploy Dockerfile directly as a web service.
