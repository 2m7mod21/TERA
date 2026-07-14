# ─── Stage 1: Builder ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json ./
COPY apps/web/package.json ./apps/web/

# Install all dependencies from the workspace root
RUN npm install --legacy-peer-deps

# Copy the full source
COPY . .

# Generate Prisma client, push schema, then build Next.js
WORKDIR /app/apps/web
RUN npx prisma generate
RUN npx next build

# ─── Stage 2: Runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built output
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/server.ts ./apps/web/server.ts
COPY --from=builder /app/apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY --from=builder /app/apps/web/tsconfig.server.json ./apps/web/tsconfig.server.json
COPY --from=builder /app/apps/web/src ./apps/web/src
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/package.json ./package.json

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["node_modules/.bin/ts-node", "--project", "tsconfig.server.json", "server.ts"]
