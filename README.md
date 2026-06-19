# Paper Submit

Paper Submit is a lean, single-event CFP management platform.

## Local Development

1. Copy `.env.example` to `.env` and replace the placeholder secrets.
2. Set the vars 

PUBLIC_BASE_URL to http://localhost

CADDY_DOMAIN to :80

DATABASE password in DATABASE_URL and POSTGRES_PASSWORD

COOKIE_SECURE to false

TRUST_PROXY to false

APP_ENCRYPTION_KEY=replace-with-32-byte-base64-key

COOKIE_SECRET=replace-with-32-byte-base64-key

Tip: Use the command openssl rand -base64 32 to generate the APP_ENCRYPTION_KEY and COOKIE_SECRET

```bash
docker compose build && docker compose up -d`
```

## Production

1. Point the DNS `A`/`AAAA` record for your CFP hostname to the server.
2. Allow inbound firewall traffic on ports `80` and `443`.
3. Keep ports `3000` and `5432` closed to the internet.
4. Copy `.env.example` to `.env`, replace placeholders, and set these production values:

```env
PUBLIC_BASE_URL=https://cfp.example.com
CADDY_DOMAIN=cfp.example.com
COOKIE_SECURE=true
TRUST_PROXY=true
DATABASE password in DATABASE_URL and POSTGRES_PASSWORD
APP_ENCRYPTION_KEY=replace-with-32-byte-base64-key
COOKIE_SECRET=replace-with-32-byte-base64-key
```
Tip: Use the command openssl rand -base64 32 to generate the APP_ENCRYPTION_KEY and COOKIE_SECRET

Then start:

```bash
docker compose up -d
```

## Operational Notes

1. Check the setup url in container log 

```bash
docker compose logs | egrep token
```

```
Setup URL: http://<CFP_URL>/setup?token=YD7_1boOUJR6e1ZgrrS73njNPf3aQnW6blvUQ9KCrGM
```

2. Fill the CFP Infos
3. Access the Admin Page
4. Configure the SMTP (Tip: https://smtp2go.com)
5. Upload the Event logo and Change CFP Status
6. Invite the Reviews
