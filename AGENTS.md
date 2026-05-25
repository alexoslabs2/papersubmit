# AGENTS.md — Paper Submit Platform

This file gives implementation agents the project-specific context, constraints, and quality gates required to work safely on the Paper Submit platform.

The source of truth is `PaperSubmit_Spec_v4.md`. When a conflict exists between generated code, previous plans, and the specification, follow the v4 specification.

---

## 1. Project Mission

Paper Submit is a lean, open-source Call for Papers (CFP) management platform for a single event.

The platform must remain simple to deploy, simple to operate, and low-friction for speakers, reviewers, and organisers.

Primary goals:

- Allow an organiser to configure one CFP instance.
- Allow speakers to register and submit one or more proposals.
- Allow reviewers to review eligible proposals.
- Allow the organiser admin to monitor progress and accept or reject proposals.
- Send transactional emails through SMTP.
- Keep the architecture lean: no SaaS layer, no multi-tenancy, no Redis, no unnecessary infrastructure complexity.

---

## 2. Non-Negotiable Architecture Rules

### Deployment Model

- The application is a single-instance Docker Compose deployment.
- Each instance hosts exactly one event.
- There is no multi-tenancy.
- There is no cross-instance data sharing.
- PostgreSQL is the only required persistence dependency.
- Redis is not part of v1.

### Stack

Use the following stack:

- Frontend: Vue 3 + Vite + TypeScript
- Backend: Node.js + TypeScript + Fastify
- Database: PostgreSQL 15+
- Query builder and migrations: Kysely
- Validation and API documentation: Fastify JSON schemas + `@fastify/swagger`
- Sessions: PostgreSQL-backed server-side sessions
- Email queue: PostgreSQL `email_jobs` table plus in-process polling worker
- Reverse proxy / TLS: Caddy or equivalent infrastructure-level proxy

Do not introduce:

- Redis
- BullMQ
- JWT access/refresh token rotation
- Google SSO
- TOTP MFA in v1
- In-app TLS or certificate lifecycle management
- Multi-admin support in v1
- Event cloning
- Reviewer tracks
- File attachments for proposals
- LGPD/privacy workflow automation in v1

---

## 3. Authentication and Session Rules

Authentication is local email and password only.

### Passwords

- Admin password minimum: 12 characters.
- Reviewer and Speaker password minimum: 8 characters.
- Passwords must be checked against a common-password list or equivalent blocklist.
- Password storage must use Argon2id preferred, or bcrypt with cost factor at least 12.
- Never store passwords using MD5, SHA-1, SHA-256, or reversible encryption.

### Sessions

- Use opaque 32-byte cryptographically random session tokens.
- Store only the SHA-256 hash of the token in PostgreSQL.
- Issue the raw token only once to the client in a signed cookie.
- Cookie requirements:
  - `HttpOnly=true`
  - `SameSite=Strict`
  - `Path=/`
  - `Domain` unset
  - `Secure=true` when `COOKIE_SECURE=true`
  - `Max-Age=604800`
- Enforce 8-hour inactivity expiry server-side.
- Enforce hard maximum session lifetime of 7 days.
- Delete the session row immediately on logout.
- Invalidate all other active sessions on password change.

### Login Lockout

- After 3 consecutive failed login attempts, lock the account for 15 minutes.
- Reset `failed_login_attempts` and `locked_until` on successful login.
- Check lockout server-side during login attempts.
- Do not add progressive backoff in v1.

### Account Enumeration

Login, forgot-password, and invitation flows must return generic responses and avoid account enumeration through timing or error messages.

---

## 4. Role Model and Access Rules

The platform has four access contexts:

### Admin

- Created once during setup wizard.
- Full platform administration.
- Sole accept/reject decision-maker.
- May manage event configuration, reviewers, SMTP, email templates, audit logs, dashboards, and decisions.
- No additional admin accounts in v1.

### Reviewer

- Invitation-only.
- Can review all `under_review` proposals except their own.
- Cannot see other reviewers' scores or comments.
- Can update their own review only while the event is not `closed` and the proposal has not been accepted or rejected.

### Speaker

- Self-registers.
- Can submit multiple proposals while CFP is open.
- Can edit or withdraw own proposals while proposal status is `submitted` and CFP is open.
- Cannot see other speakers' proposals.
- Cannot see reviews, scores, or reviewer comments.

### Public

- Can view only the public CFP landing page and public event information.
- Cannot submit, review, or access authenticated resources.

### API Authorization

- Enforce RBAC in API middleware.
- Do not rely only on frontend route guards.
- Every user-owned database query must include the authenticated user ID when scoping access.
- Protect against IDOR by design, not by post-query filtering.

---

## 5. Event State Machine

The event has a strict one-way lifecycle:

```text
draft -> open -> reviewing -> closed
```

Allowed transitions:

- `draft -> open`: manual Admin action only.
- `open -> reviewing`: automatic when `cfp_closes_at <= now` or manual Admin action.
- `reviewing -> closed`: manual Admin action only.

Rules:

- No backwards transitions.
- Submissions and proposal edits are allowed only when:
  - `event.status = open`
  - current time is between `cfp_opens_at` and `cfp_closes_at`
- Reviews are allowed only when `event.status = reviewing`.
- Accept/reject decisions are allowed only when `event.status = reviewing`.
- These gates must be enforced at API middleware/service layer, not only in the UI.

---

## 6. Proposal State Machine

Proposals have a strict state machine:

```text
submitted -> withdrawn
submitted -> under_review
under_review -> accepted
under_review -> rejected
```

Terminal states:

- `accepted`
- `rejected`
- `withdrawn`

Rules:

- Only `submitted` proposals may be edited by the Speaker.
- Edits are allowed only while the event is open.
- Withdraw is allowed only from `submitted` while the event is open.
- Reviews are allowed only on `under_review` proposals.
- Accepted and rejected proposals are locked from further edits and review edits.
- Decision reversal is out of scope for v1.
- Withdrawn proposals are excluded from review queues and may not be resubmitted.

---

## 7. Data Model Rules

### IDs and Timestamps

- Use UUID v7 primary keys for all externally referenced entities.
- Use `BIGSERIAL` only for internal audit log ordering.
- Store all timestamps as `TIMESTAMPTZ`.
- Store all dates internally in UTC.
- Display event dates in the configured event timezone.

### Soft Deletes

Soft-delete only business entities:

- `users`
- `proposals`

Operational tables use lifecycle columns and hard deletion where appropriate:

- `sessions`
- `email_jobs`
- `password_reset_tokens`
- `reviewer_invitations`

### Updated At

Use a PostgreSQL `BEFORE UPDATE` trigger to maintain `updated_at` for tables that carry the column.

Do not rely on application-layer helpers for `updated_at`.

### Audit Logs

- Audit logs are immutable.
- Enforce immutability with a PostgreSQL trigger rejecting `UPDATE` and `DELETE`.
- Do not issue application code that mutates or deletes `audit_logs`.
- Audit logs are retained indefinitely in v1.
- 90 days is the minimum retention guarantee, not a purge threshold.

### Sensitive Data

- SMTP passwords must be encrypted at application layer with AES-256-GCM.
- Encryption key comes from `APP_ENCRYPTION_KEY`.
- Secrets must be supplied by environment variables.
- Never commit `.env` files or real secrets.

---

## 8. Email and Worker Rules

Transactional email uses SMTP and the `email_jobs` table.

### Worker

- Use an in-process polling worker.
- Poll every 30 seconds.
- Claim jobs atomically with `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 10`.
- Move claimed jobs to `processing` before sending.
- Move successful jobs to `sent` and set `sent_at`.
- Reset stale `processing` jobs older than 5 minutes to `retrying`.
- Retry with exponential backoff:
  - 5 minutes after first failure
  - 30 minutes after second failure
  - 2 hours after third failure
- After the third failed attempt, mark as `failed` and populate `error_message`.
- Worker exceptions must be logged and must not crash the API server process.

### Email Templates

- Default templates are seeded on startup only if `email_templates` is empty.
- Never overwrite Admin customisations during startup.
- Template `trigger_type` is immutable after seeding.
- System templates cannot be deleted.
- Subject must be plain text only.
- HTML body must pass strict allowlist sanitisation.
- Plain-text fallback is required.
- Template variables use `{{variableName}}`.
- Escape variables by default before rendering.
- Preview must validate missing required variables.

---

## 9. Setup Wizard Rules

On first boot:

- If setup is incomplete, generate a 32-byte random setup token.
- Store only the SHA-256 hash in `setup_config.token_hash`.
- Print a full clickable setup URL to stdout using `PUBLIC_BASE_URL`.
- The `/setup` route is public only before setup completion.
- After setup completes, `/setup` returns 404 permanently.
- If the server restarts before setup completion, generate a new setup token and invalidate the previous hash.

Setup wizard step order:

1. Token validation
2. Admin email and password
3. Event details
4. CFP configuration

Do not add SMTP or TLS steps.

After setup completion, instruct the Admin to configure SMTP in the Admin Dashboard, set CFP status from Draft to Open, and invite reviewers.

---

## 10. Security Implementation Requirements

### CSRF

- Protect all `POST`, `PUT`, `PATCH`, and `DELETE` endpoints with CSRF tokens.
- Use `@fastify/csrf-protection`.
- Validate CSRF token through a request header such as `x-csrf-token`.

### Input Validation and Output Encoding

- Validate all user input server-side.
- Client-side validation is supplementary only.
- Strip HTML from plain text fields before storage.
- Escape output for browser rendering context.
- Escape email template interpolation values.

### Rate Limiting

- Authentication endpoints: 10 requests per minute per IP.
- Read endpoints: 300 requests per minute per IP.
- Proposal submission: 5 submissions per authenticated user per hour.
- JSON body limit: 10 KB.
- File upload limit: 2 MB.

### Proxy Handling

- Use Fastify `request.ip` for rate limit keys.
- `TRUST_PROXY=true` only when behind a trusted proxy such as Caddy or nginx.
- Never enable `TRUST_PROXY=true` on direct internet exposure.

### File Uploads

Event logo upload only:

- JPEG or PNG accepted.
- Maximum size: 2 MB.
- Validate MIME by magic bytes, not by extension or `Content-Type`.
- Strip EXIF metadata.
- Resize to 400x400 px.
- Convert to WebP.
- Store under `/app/uploads/event-logo/<uuid>.webp`.
- Serve only from `/app/uploads/event-logo/`.
- Disable directory listing.
- Accept only UUID-format filenames.
- Set `Cache-Control: public, max-age=86400`.
- Delete previous logo file when a new logo is uploaded.

### HTTP Security Headers

Production CSP:

```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'
```

Development CSP:

```text
default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:*
```

Other required headers:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## 11. Frontend Rules

### Routes

Use a flat, single-event route model:

- `/` public CFP landing page
- `/login`
- `/register`
- `/setup`
- `/app/*` authenticated app shell
- `/uploads/event-logo/:filename`

Do not introduce slug-based event routes.

The event slug may be used only for canonical and Open Graph metadata.

### Required Screens

Implement and preserve the following screens:

- Public CFP Landing Page
- Login
- Speaker Registration
- Reviewer Invitation Acceptance
- Setup Wizard
- Admin Dashboard
- Admin Submission List
- Admin Submission Detail
- Admin Reviewer Management
- Admin Email Templates Editor
- Admin SMTP Settings
- Admin Audit Log Viewer
- Reviewer Queue
- Full Review Screen
- Speaker My Proposals
- Speaker Proposal Form
- 403 and 404 pages

### Stores

Use these Vue store boundaries:

- `authStore`: identity, role, session state, route guards
- `eventStore`: event config, CFP status, transitions
- `proposalStore`: speaker proposals, admin/reviewer proposal list and detail
- `reviewStore`: reviewer queue, submitted reviews, review edits
- `adminStore`: dashboard stats, reviewer management, bulk decision state

### UX Principles

- Role-based navigation derived from role metadata.
- Forbidden routes return 403.
- CFP-state-aware buttons and clear disabled messages.
- Loading states, success toasts, inline validation errors.
- Empty states for every list view.
- Responsive screens down to 375 px width.
- Confirmation modals for destructive actions.
- Cursor pagination for Admin submission list.

Status badge colour semantics:

- Submitted: blue
- Under Review: amber
- Accepted: green
- Rejected: red
- Withdrawn: grey

---

## 12. API Surface Expectations

The API must expose route groups aligned with the specification:

- `POST /setup/*`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /me`
- `PATCH /me`
- `GET /event`
- `PATCH /event`
- `POST /event/logo`
- `GET /proposals`
- `POST /proposals`
- `GET /proposals/:id`
- `PATCH /proposals/:id`
- `POST /proposals/:id/withdraw`
- `GET /reviews`
- `POST /reviews`
- `PATCH /reviews/:id`
- `POST /admin/proposals/:id/decide`
- `GET /admin/dashboard`
- `GET /admin/submissions`
- `GET /admin/reviewers`
- `POST /admin/reviewers/invite`
- `DELETE /admin/reviewers/:id`
- `GET /admin/email-templates`
- `PATCH /admin/email-templates/:id`
- `POST /admin/email-templates/:id/preview`
- `GET /admin/smtp`
- `PUT /admin/smtp`
- `POST /admin/smtp/test`
- `GET /admin/audit-logs`
- `GET /health`
- `GET /uploads/event-logo/:filename`

OpenAPI 3.1 must be generated from Fastify route schemas and served at `/docs` in development.

---

## 13. Health Check

`GET /health` must return HTTP 200 with this JSON shape:

```json
{
  "status": "ok",
  "db": "ok",
  "worker": {
    "email": {
      "lastRunAt": "2026-01-01T00:00:00.000Z",
      "pendingJobs": 0
    },
    "sessionPurge": {
      "lastRunAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

Allowed values:

- `status`: `ok` or `degraded`
- `db`: `ok` or `error`

Set status to `degraded` if database connection check fails.

---

## 14. Docker and Startup Rules

### Dockerfile

Use a multi-stage Docker build.

Builder stage:

- Base image: `node:22-alpine`
- `WORKDIR /app`
- Run `npm ci`
- Copy source
- Run `npm run build`

Production stage:

- Base image: `node:22-alpine`
- `NODE_ENV=production`
- `WORKDIR /app`
- Run `npm ci --omit=dev`
- Copy compiled `/app/dist`
- Run as non-root `node` user
- Expose default app port `3000`
- Entrypoint: `node dist/server.js`

### Startup Sequence

The production entrypoint must perform this order:

1. Load and validate environment variables.
2. Establish database connection.
3. Run Kysely migrations with `migrator.migrateToLatest()`.
4. Exit with code `1` if migrations fail.
5. Seed default email templates if the table is empty.
6. Start email and session purge workers.
7. Start Fastify server.

Do not require a separate production `npm run migrate` step.

### Docker Compose

- PostgreSQL must define a health check using `pg_isready`.
- App must use `depends_on: condition: service_healthy`.
- Use `restart: unless-stopped` for all services.
- Inject configuration through `.env`.
- Do not hard-code secrets in `docker-compose.yml`.
- PostgreSQL port should remain internal to the Docker network.
- Persist PostgreSQL data and `/app/uploads` using named volumes.

---

## 15. Environment Variables

Required or expected environment variables include:

- `PUBLIC_BASE_URL`
- `DATABASE_URL`
- `COOKIE_SECURE`
- `TRUST_PROXY`
- `APP_ENCRYPTION_KEY`
- `ADMIN_RECOVERY_EMAIL` optional
- SMTP-related variables when applicable
- PostgreSQL Compose variables such as `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`

Removed and forbidden in v4:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

`.env.example` must document all required variables with placeholder values and descriptions.

`.env` must be ignored by Git.

---

## 16. Test and Release Gates

Before any release, all critical-path tests must pass:

1. Setup wizard completes and `/setup` returns 404 afterward.
2. Admin login succeeds with correct credentials and fails safely with incorrect credentials.
3. Speaker self-registration and login.
4. Reviewer invitation acceptance and credential creation.
5. Session creation, inactivity expiry, and logout.
6. Password reset lifecycle: issue, use, reject replay.
7. Event state transitions: allowed transitions succeed and forbidden transitions are rejected.
8. Proposal submission gating: blocked when CFP closed, allowed when open.
9. Proposal ownership and IDOR prevention.
10. Reviewer cannot review their own submitted proposal.
11. Reviewer cannot see another reviewer's comments or scores.
12. Admin accept/reject decision locks proposal and sends notification email.
13. Email job claiming atomicity prevents duplicate sends.
14. Audit log entries are written and immutable.
15. CSRF token is rejected on unsafe methods without valid token.
16. Role-based route protection.

Coverage targets:

- At least 80% unit test coverage on business logic.
- At least 60% integration test coverage on API routes.

Do not waive critical-path tests because aggregate coverage is high.

---

## 17. Code Review Checklist for Agents

Before marking work as complete, verify:

- The change follows the v4 specification.
- No removed v4 feature was reintroduced.
- No Redis dependency was added.
- No Google SSO code, routes, environment variables, CSP directives, or database tables were added.
- No JWT access/refresh token architecture was added.
- RBAC is enforced at API middleware/service boundaries.
- IDOR protections are present in database queries.
- CSRF protection applies to unsafe methods.
- All unsafe user input is validated and escaped.
- Sessions are stored in PostgreSQL and only token hashes are persisted.
- Email jobs use atomic claiming.
- Audit logs remain append-only.
- Migrations are Kysely migrations.
- OpenAPI route schemas are updated.
- Required tests were added or updated.
- Docker startup still runs migrations before serving traffic.
- `.env.example` was updated if configuration changed.
- No secrets or local `.env` files are committed.

---

## 18. Implementation Philosophy

Prefer simple, explicit, inspectable code.

Good choices for this project:

- Direct SQL through Kysely instead of ORM magic.
- PostgreSQL sessions instead of distributed token complexity.
- PostgreSQL polling worker instead of queue infrastructure.
- Reverse proxy TLS instead of app-owned certificate lifecycle.
- Role-aware route metadata instead of scattered conditional rendering.
- Database constraints plus service-layer validation.
- Clear migration files over ad hoc schema edits.

When unsure, choose the implementation with fewer moving parts, stronger security defaults, and clearer operational behavior.

---

## 19. Agent Operating Instructions

When modifying this repository:

1. Read this file and `PaperSubmit_Spec_v4.md` first.
2. Identify the affected requirement IDs before coding.
3. Keep changes narrow and aligned with the lean architecture.
4. Do not add dependencies unless the need is directly justified by the specification.
5. Add or update tests for every behavior change.
6. Update OpenAPI schemas when API behavior changes.
7. Update `.env.example` when configuration changes.
8. Document operational impacts in README when deployment behavior changes.
9. Never silently weaken security controls to make tests pass.
10. Report any conflict with the specification instead of guessing.
11. When in doubt, present the best recommendations based on the requirements and criteria before taking any action.

---

## 20. Out-of-Scope Features for v1

Do not implement these unless the specification is explicitly updated:

- Multi-event support
- Multi-tenant SaaS mode
- Multiple Admin accounts
- Google SSO
- TOTP MFA
- Redis/BullMQ
- JWT refresh token rotation
- In-app TLS management
- Event cloning
- Reviewer tracks
- Proposal file attachments
- LGPD consent automation
- Decision reversal
- Speaker account deletion
- Speaker data export
- Email address change workflow
- S3/MinIO storage implementation
- Progressive login backoff

---

End of AGENTS.md.
