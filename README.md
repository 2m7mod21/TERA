# TERA Social Platform

A production-grade, modular, full-stack social media platform combining and enhancing the core experiences of Facebook and Instagram.

## Core Technology Stack

- **Monorepo Manager:** [Turborepo](https://turbo.build/)
- **Frontend Framework:** Next.js 15+ (App Router, Server Actions, Server Components)
- **Programming Language:** TypeScript (strict mode)
- **Database Layer:** SQLite (Development) + [Prisma ORM](https://www.prisma.io/)
- **Authentication:** NextAuth.js (Auth.js v5) with Credentials, Google, GitHub, and TOTP 2FA
- **WS server:** Socket.IO integrated with Next.js Custom Server
- **Linting & Formatting:** ESLint, Prettier, Husky
- **Testing:** Vitest

---

## Monorepo Project Structure

```text
TERA/
├── apps/
│   └── web/                   # Next.js 15 app router application
│       ├── docs/              # OpenAPI specs
│       ├── src/
│       │   ├── app/           # App routes (Feed, auth, profiles, messages, etc)
│       │   ├── features/      # Feature actions grouped by area
│       │   ├── server/        # NextAuth config + Repository implementations + Socket server
│       │   └── types/         # NextAuth type declaration overrides
│       └── server.ts          # Custom wrapper server implementing HTTP + Socket.IO WebSockets Node process
├── packages/
│   ├── db/                    # Prisma database client, migrations, and seed script
│   │   ├── prisma/            # prisma.schema detailing all social models
│   │   └── seed.ts            # Faker-based dataset seeding script
│   ├── lib/                   # Pino logging, LRU custom cache, Local Storage providers, Zod validation models
│   └── ui/                    # Shared component styles
├── package.json               # Root monorepo dependency config
├── pnpm-workspace.yaml        # Workspace bindings
└── turbo.json                 # Turbo caching pipelines
```

---

## Local Setup & Installation

### Prerequisite

- Node.js v20+ (LTS)
- `pnpm` (Workspace support)

### Steps

1. **Clone & Setup:**
   Ensure project files are inside the root repo directory.

2. **Install Dependencies:**
   Run from the monorepo root:
   ```bash
   pnpm install
   ```

3. **Configure Environment:**
   Copy the example env to actual `.env` inside both the monorepo root and under `apps/web`:
   ```bash
   cp .env.example .env
   ```

4. **Initialize Database & Seed Data:**
   Run Prisma generation, migrations, and initial seed dataset:
   ```bash
   # Run Prisma generator
   pnpm db:generate

   # Create migration schema (SQLite dev.db)
   pnpm db:migrate

   # Populate 20 random users, follows, posts, comments, conversations, tips
   pnpm db:seed
   ```

5. **Start Dev Workspace:**
   Start both Next.js app and the custom Socket.IO wrapper server concurrently:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) inside your browser.

---

## Testing

```bash
# Executing unit test suites (Vitest)
pnpm test
```

---

## Architectural Highlights

### 1. Feed Ranking Engine
Implements an algorithmic ranking engine (`FeedService.ts`) evaluating:
- **Recency Decay:** Decays score linearly by 4 points per hour since publication.
- **Engagement Activity Weight:** Adds score based on interactions count (Reactions = 2 pts, Comments = 5 pts).
- **Social Graph Relationship Strength:** Adds a multiplier bonus of 50 pts if written by a followed user.

### 2. S3-Swappable Storage Abstraction
Implements a boundary class (`LocalStorageProvider.ts` in `packages/lib`) conforming to an storage interface. The Next.js upload handler (`api/upload/route.ts`) calls this service, making it plug-and-play to swap local server directories for an AWS S3 client later.

### 3. Production Migration Guide (SQLite → PostgreSQL)
Since development utilizes a single SQLite file (`packages/db/prisma/dev.db`), transition to a high-concurrency production stack like PostgreSQL or MySQL is straightforward:

1. **Update provider in `packages/db/prisma/schema.prisma`:**
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. **Update model field data types:**
   - SQLite manages JSON strings for multi-file items (e.g. `mediaUrls String @default("[]")` and `readBy String @default("[]")`).
   - In Postgres/MySQL, replace these fields with actual database JSON fields or array types:
     ```prisma
     mediaUrls String[] // In PostgreSQL
     // or
     mediaUrls Json     // In MySQL/Postgres
     ```
3. **Execute migration:**
   Ensure `DATABASE_URL` references your Postgres instance, then run:
   ```bash
   pnpm db:migrate
   ```
