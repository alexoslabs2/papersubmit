# Paper Submit Specification v4

This repository restores the v4 specification from `AGENTS.md`. When implementation details conflict, the requirements in `AGENTS.md` and this document are the release contract.

The platform is a single-instance, single-event CFP management application using Vue 3, Vite, TypeScript, Fastify, PostgreSQL 15+, Kysely migrations, PostgreSQL-backed sessions, SMTP email, and PostgreSQL-backed workers. Redis, JWT refresh-token architecture, Google SSO, TOTP MFA, multi-tenancy, multiple admins, event cloning, reviewer tracks, proposal attachments, and in-app TLS are out of scope for v1.

Core release requirements:

- Local email/password authentication with Argon2id, password blocklist checks, login lockout, generic auth responses, and PostgreSQL sessions.
- Strict event state machine: `draft -> open -> reviewing -> closed`.
- Strict proposal state machine: `submitted -> withdrawn`, `submitted -> under_review`, `under_review -> accepted/rejected`.
- Backend RBAC and IDOR-safe queries for Admin, Reviewer, Speaker, and Public contexts.
- Setup wizard with hashed setup token, single admin creation, event/CFP configuration, post-setup operating instructions, and post-completion 404 behavior.
- Transactional email through `email_jobs`, atomic PostgreSQL claiming, retry policy, stale job reset, and default template seeding only when empty.
- Immutable audit logs, UTC `TIMESTAMPTZ` storage, UUID v7 externally referenced IDs, PostgreSQL `updated_at` triggers, and application-layer encryption for SMTP passwords.
- Vue app with public CFP, auth, setup, admin, reviewer, speaker, 403, and 404 screens.
- Docker Compose production deployment with PostgreSQL health check, automatic migrations on startup, named volumes, and reverse-proxy TLS.
