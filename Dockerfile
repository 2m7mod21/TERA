# ─── Stage 1: Builder ─────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy root workspace manifests first
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/

# Install WITHOUT running scripts (prevents postinstall from firing before schema exists)
RUN npm install --legacy-peer-deps --ignore-scripts

# Now copy the full source (including prisma/schema.prisma)
COPY . .

# Generate Prisma client (schema is now available)
WORKDIR /app/apps/web
RUN npx prisma generate

# Build Next.js app
RUN npx next build

# ─── Stage 2: Runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production

# Copy root configuration and dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy the built web workspace
COPY --from=builder /app/apps/web ./apps/web

WORKDIR /app/apps/web

EXPOSE 3000

# Push DB schema then start server using Node.js ts-node/register and tsconfig-paths/register
CMD sh -c "npx prisma db push --accept-data-loss ; TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register server.ts"
