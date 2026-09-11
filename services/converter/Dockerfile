# Docly Self-Hosted Document Conversion Service
# Multi-stage lightweight Python + LibreOffice Headless container

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8001

WORKDIR /app

# Install system dependencies: LibreOffice Headless (MPL 2.0) and standard unicode fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-liberation \
    fonts-dejavu-core \
    ghostscript \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Create a dedicated non-root user and profile directory
RUN useradd -m -u 1001 docly && \
    mkdir -p /tmp/conversions /tmp/libreoffice_profile && \
    chown -R docly:docly /app /tmp/conversions /tmp/libreoffice_profile

USER docly

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8001}/health || exit 1

CMD ["sh", "-c", "python -m uvicorn src.server:app --host 0.0.0.0 --port ${PORT:-8001}"]
