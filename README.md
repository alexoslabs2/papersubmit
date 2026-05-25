# Paper Submit

Paper Submit is a lean, single-event CFP management platform. It uses Vue 3, Vite, TypeScript, Fastify, PostgreSQL, Kysely migrations, PostgreSQL-backed sessions, and a PostgreSQL-backed transactional email worker.

## Local Development

1. Copy `.env.example` to `.env` and replace the placeholder secrets.
2. Start PostgreSQL with `docker compose up db`.
3. Run `npm install`.
4. Start the API with `npm run dev:server`.
5. Start the frontend with `npm run dev`.

The production container runs migrations automatically before serving traffic.

## Production

Run the app with Docker Compose. The included Caddy service is the public reverse proxy and automatically obtains and renews Let's Encrypt certificates for `CADDY_DOMAIN`.

Production traffic flow:

```text
Internet -> Caddy :80/:443 -> app:3000 -> PostgreSQL
```

Only Caddy publishes public ports. The Node app exposes port `3000` only inside the Docker network, and PostgreSQL remains internal.

Before starting production:

1. Point the DNS `A`/`AAAA` record for your CFP hostname to the server.
2. Allow inbound firewall traffic on ports `80` and `443`.
3. Keep ports `3000` and `5432` closed to the internet.
4. Copy `.env.example` to `.env`, replace placeholders, and set these production values:

```env
PUBLIC_BASE_URL=https://cfp.example.com
CADDY_DOMAIN=cfp.example.com
COOKIE_SECURE=true
TRUST_PROXY=true
```

Then start:

```bash
docker compose up --build
```

The Compose project is named `papersubmit`, so generated container names use the
`papersubmit-*` prefix.

TLS is handled by Caddy, not by the Node app.

Required release checks:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `docker compose build`

## Operational Notes

- The first boot before setup completion prints a clickable setup URL based on `PUBLIC_BASE_URL`.
- `/setup` returns 404 after setup is complete.
- Sessions use a sliding server-side inactivity timeout. The v4 default is `SESSION_INACTIVITY_MINUTES=480`; set it to `30` for a 30-minute idle timeout.
- After setup, sign in as Admin, configure SMTP in the Admin Dashboard, set CFP status from Draft to Open, and invite reviewers.
- SMTP passwords are encrypted with `APP_ENCRYPTION_KEY`.
- Email delivery uses the `email_jobs` table and an in-process polling worker.
- Event lifecycle automation runs in-process every 30 seconds and moves the single event from `open` to `reviewing` after the CFP close time.
- Event logos are stored in the local `/app/uploads` Docker volume. `STORAGE_PROVIDER=local` is the only supported v1 value.
- Audit logs are append-only and protected by a database trigger.
