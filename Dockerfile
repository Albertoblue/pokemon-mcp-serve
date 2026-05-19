# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Compile TypeScript → JavaScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production image ──────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Only copy production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Run as non-root user (security best practice for Fargate)
RUN addgroup -S mcpgroup && adduser -S mcpuser -G mcpgroup
USER mcpuser

EXPOSE 8000

# Healthcheck used by Docker and ECS
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["node", "dist/index.js"]
