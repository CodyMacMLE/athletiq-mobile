# AthletiQ — Enhancement Backlog

Status legend: ✅ Implemented · 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Nice-to-have

---

## Previously Implemented
1. ✅ Push notifications & team announcements (AWS SNS + SES)
2. ✅ RSVP & availability tracking
3. ✅ Emergency contacts & medical information
4. ✅ Enhanced calendar (venues, iCal export, recurring events)
5. ✅ Enhanced guardian experience
6. ✅ Attendance trends chart + CSV export
7. ✅ Role-based permissions refinement (custom roles, permission matrix)
8. ✅ Offline check-in (queue + sync)
9. ✅ Gamification (badges, team challenges, athlete recognition)
10. ✅ Performance optimizations (DataLoaders, compound indexes)
11. ✅ Testing infrastructure (99 tests, Vitest, CI gate)
12. ✅ Modular backend architecture (12 domain modules)
13. ✅ CI/CD (backend → ECS, mobile → EAS, web → Vercel)
14. ✅ Membership period tracking (per-team hours accuracy)

---

## 🔴 Critical — Production Security

### #16 — GraphQL Hardening
**Risk**: The API currently allows unbounded query depth and complexity.
A malicious actor can send a deeply nested query (e.g. `user { teams { members { teams { members { ... } } } } }`)
that causes exponential DB load, taking the server down.

- Add `graphql-depth-limit` (max depth: 10)
- Add `graphql-validation-complexity` (max complexity: 1000)
- Disable GraphQL introspection in production (`NODE_ENV === "production"`)
- Return generic error messages in production (no stack traces in responses)

Files: `Backend/src/index.ts`

---

### #17 — Input Validation (Zod)
**Risk**: All GraphQL mutation inputs go directly to Prisma with no validation.
A user can submit `firstName: "A".repeat(100000)` or malformed dates/times that
crash the server or corrupt data.

- Add Zod schemas for every mutation input type
- Validate at the resolver boundary before any DB call
- Centralise in `Backend/src/utils/validate.ts`
- Common rules: string length limits, enum membership, date format, phone/email format

Files: `Backend/src/utils/validate.ts` (new), all module resolvers

---

### #18 — HTTP Security Headers (Helmet) + CORS Hardening
**Risk**: `cors({ origin: true })` allows any origin — any website can make
credentialed requests to the API. No security headers means the API is
vulnerable to clickjacking, MIME sniffing, etc.

- Add `helmet` middleware (CSP, HSTS, X-Frame-Options, etc.)
- Restrict CORS `origin` to an explicit allowlist: Vercel domain + localhost in dev
- Add `CORS_ORIGIN` to environment config / SSM

Files: `Backend/src/index.ts`

---

### #19 — PII Encryption at Rest
**Risk**: Medical information (conditions, allergies, medications, insurance numbers)
and emergency contacts are stored as plaintext in RDS. A database breach
exposes sensitive health data directly.

- Encrypt sensitive fields (`MedicalInfo.conditions`, `allergies`, `medications`,
  `insurancePolicyNumber`, `insuranceGroupNumber`) using AES-256-GCM
- Store encryption key in AWS Secrets Manager (not in the app environment)
- Add `Backend/src/utils/encrypt.ts` — `encrypt(text)` / `decrypt(ciphertext)` helpers
- Apply in `upsertMedicalInfo` resolver (encrypt on write, decrypt on read)

Files: `Backend/src/utils/encrypt.ts` (new), health resolvers

---

### #20 — Per-User Rate Limiting + Abuse Detection
**Risk**: Current rate limiter is IP-only (120 req/min). A single authenticated
user can spam mutations (e.g., mass check-in attempts, bulk data scraping)
from behind a shared IP without being throttled.

- Add per-userId rate limiting after auth (separate window from IP limiter)
- Track failed auth attempts — lock account after 10 failures in 5 minutes
- Emit a `SUSPICIOUS_ACTIVITY` audit log entry on anomalies
- Return `429` with `Retry-After` header

Files: `Backend/src/index.ts`, `Backend/src/utils/rateLimit.ts` (new)

---

## 🟠 High — Reliability & Observability

### #21 — Structured Logging + Error Monitoring (Sentry)
**Risk**: The server currently uses `console.log/error`. In production, unhandled
errors are silently swallowed or produce unstructured noise in CloudWatch.
There is no alerting when the app crashes.

- Replace all `console.*` with `pino` (structured JSON logger, ECS-compatible)
- Integrate Sentry (`@sentry/node`) for automatic error capture + alerting
- Add `SENTRY_DSN` to SSM / task definition
- Add `requestId` context to every log line (correlation across a request)
- Log slow resolvers (>500ms) as warnings

Files: `Backend/src/utils/logger.ts` (new), `Backend/src/index.ts`, all resolvers

---

### #22 — Graceful Shutdown + Connection Pool Limits
**Risk**: When ECS replaces a task, the process receives SIGTERM. Currently
the server closes immediately, dropping in-flight requests. Also, Prisma
has no explicit connection limit — under load it will exhaust the RDS
`max_connections` limit (default 100 for `db.t3.micro`).

- Handle `SIGTERM` / `SIGINT`: stop accepting new requests, drain in-flight,
  disconnect Prisma, then exit
- Set `DATABASE_URL` connection pool limit (`?connection_limit=10`)
- Add `pgbouncer=true` flag if using RDS Proxy

Files: `Backend/src/index.ts`, `Backend/task-definition.json`

---

### #23 — Circuit Breakers for External Services
**Risk**: If AWS SES goes down, every mutation that triggers an email
(invites, excuse notifications) will hang for 30+ seconds waiting for a
timeout, blocking the event loop. Same for S3 uploads and SNS pushes.

- Wrap SES, SNS, S3 calls in a simple circuit breaker (use `opossum`)
- Degrade gracefully: if SES is down, log the failure and return success to the
  user (email can be retried) rather than throwing
- Add CloudWatch alarm on circuit-open state

Files: `Backend/src/utils/circuitBreaker.ts` (new), communications and media resolvers

---

### #24 — Comprehensive Health Check
**Risk**: The current `/health` endpoint returns `200 OK` immediately without
checking whether the database, Prisma client, or key external services
are reachable. ECS considers the container healthy even if it can't reach RDS.

- `GET /health` → fast (just process liveness, used by ECS)
- `GET /health/ready` → deep check: Prisma `$queryRaw SELECT 1`, Cognito reachability
- Return `503` if any critical dependency is down
- Wire `/health/ready` to ECS target group health check path

Files: `Backend/src/modules/health/resolvers.ts`, `Backend/src/index.ts`

---

### #25 — Database Migrations Safety (migrate deploy in CI)
**Risk**: `prisma db push` (used in development) is destructive — it can drop
columns without a migration history. Production should always use
`prisma migrate deploy` which applies sequential, versioned migrations.

- Add `npx prisma migrate deploy` step to `deploy-backend.yml` (runs before ECS deploy)
- Protect against accidental `db push` in production by checking `NODE_ENV`
- Store migration state in RDS (already default with `prisma migrate`)
- Document rollback procedure

Files: `.github/workflows/deploy-backend.yml`

---

### #26 — Idempotent Check-In (Prevent Double Check-Ins)
**Risk**: Race condition — if a user double-taps the NFC tag quickly, two
`checkIn` mutations can fire simultaneously and both pass the "no existing
check-in" guard before either completes the insert, creating duplicate
check-in records.

- Add a database-level unique constraint: `@@unique([userId, eventId])` on `CheckIn`
  (already exists logically but may not be enforced)
- Wrap `checkIn` create in a Prisma transaction with `upsert` semantics
- Return the existing check-in instead of throwing on conflict

Files: `Backend/prisma/schema.prisma`, attendance resolvers

---

## 🟡 Medium — Product Features

### #27 — Payment & Financial Management (Stripe)
Season dues, equipment fees, and tournament fees are a core pain point for
sports organizations — currently no financial tracking exists.

- Stripe integration: invoices, one-time payments, recurring subscriptions
- `Payment` and `Invoice` models in Prisma
- Admin dashboard: outstanding balances, payment history, export to CSV
- Automatic payment reminders via email/push
- Player eligibility gate: flag athletes with outstanding dues

---

### #28 — Season Registration Portal
No way for athletes to register for a new season — admins manually add members.

- Public registration form (no login required) with invite link per org
- Collects profile info, guardian info, emergency contacts, medical info
- Waiver/consent form acknowledgement (stored as signed record)
- Admin review queue: approve/reject registrations
- Auto-creates User + OrganizationMember on approval

---

### #29 — Performance & Skills Tracking
Beyond attendance — track athlete development over time.

- `SkillAssessment` model: custom metric name, value, unit, date, assessedBy
- Coach can define skill categories per team (e.g. "40-yard dash", "vertical")
- Athlete profile shows progress charts per skill over time
- Coach notes / session feedback per athlete

---

### #30 — Game Results & Opponent Tracking
Events of type `GAME` have no score or opponent data.

- Add `opponent`, `homeScore`, `awayScore`, `result` (WIN/LOSS/DRAW) fields to `Event`
- Season win/loss record visible on team page
- Results feed on dashboard

---

### #31 — Weather Integration & Smart Cancellations
Auto-alert coaches when events are at risk of weather cancellation.

- Daily cron: fetch forecast for each event's venue location
- If severe weather detected: notify coaches via push + email to review
- One-tap cancellation from notification → sends push to all team members
- Weather API: OpenWeatherMap or Tomorrow.io

---

## 🟢 Nice-to-Have

### #32 — AI Insights Sidecar (Python)
Separate ECS service (Python/FastAPI) that consumes attendance data and produces insights.

- Churn prediction: athletes likely to drop off before season end
- Optimal practice scheduling based on historical attendance patterns
- Anomaly detection: flag unusual absence clusters (injury risk)
- Calls internal HTTP endpoint from the Node.js backend (`/ai/insights`)

---

### #33 — E2E Tests (Playwright + Detox)
Current test coverage is backend unit/integration only.

- Playwright: web critical paths (login → dashboard → check-in flow)
- Detox: mobile NFC check-in simulation, attendance view
- Run in CI on PRs (not on every push — too slow)

---

### #34 — Multi-Tournament Support
Bracket management for tournament events.

- `Tournament` model with bracket rounds
- Multi-day event grouping
- Cross-org invitations (invite external teams to a tournament)
- Bracket visualization on web

---

### #35 — Photo & Media Galleries
Team engagement and culture feature.

- Event photo albums (S3-backed, already have upload infrastructure)
- Coach can upload highlight photos post-event
- Athletes can react / comment
- Season highlight reel

---

## Priority Order for Next Sprint

| # | Enhancement | Category | Effort |
|---|------------|----------|--------|
| #16 | GraphQL depth/complexity limits + introspection off | Security | S |
| #17 | Zod input validation | Security | M |
| #18 | Helmet + CORS hardening | Security | S |
| #25 | Migrate deploy in CI | Reliability | S |
| #26 | Idempotent check-in (race condition) | Reliability | S |
| #24 | Deep health check | Reliability | S |
| #22 | Graceful shutdown + connection pool | Reliability | S |
| #21 | Structured logging + Sentry | Observability | M |
| #23 | Circuit breakers (SES/SNS/S3) | Reliability | M |
| #19 | PII encryption at rest | Security | M |
| #20 | Per-user rate limiting | Security | M |
| #27 | Stripe payments | Product | L |
| #28 | Registration portal | Product | L |
