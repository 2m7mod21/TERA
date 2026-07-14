# ─── Stage 1: Builder ─────────────────────────────────────────
FROM node:20-alpine AS builder

# Install system deps for Prisma + native modules
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

# Build Next.js (prisma db push runs during build via npm run build)
# Skip db push in build — let start command handle it or use Railway's deploy hooks
RUN npx next build

# ─── Stage 2: Runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production

# Copy everything needed to run
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/server.ts ./apps/web/
COPY --from=builder /app/apps/web/tsconfig.json ./apps/web/
COPY --from=builder /app/apps/web/tsconfig.server.json ./apps/web/
COPY --from=builder /app/apps/web/src ./apps/web/src
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

WORKDIR /app/apps/web

EXPOSE 3000

# Push DB schema then start server
CMD sh -c "npx prisma db push --accept-data-loss && npx ts-node --project tsconfig.server.json server.ts"
