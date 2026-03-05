FROM python:3.11-slim

# Install Node.js (Debian trixie ships Node 20 natively)
RUN apt-get update && \
    apt-get install -y nodejs npm && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build MCP servers
COPY mcp-servers/ ./mcp-servers/
RUN cd mcp-servers/erp-data-server && npm ci && npm run build
RUN cd mcp-servers/supplier-data-server && npm ci && npm run build
RUN cd mcp-servers/logistics-server && npm ci && npm run build
RUN cd mcp-servers/po-management-server && npm ci && npm run build

# Install Python dependencies
COPY backend/requirements-prod.txt ./
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy backend source
COPY backend/ ./backend/

ENV MCP_SERVERS_DIR=/app/mcp-servers

WORKDIR /app/backend

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
