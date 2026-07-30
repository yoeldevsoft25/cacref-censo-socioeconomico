# SECURITY

## Authentication & Authorization

- **Password hashing:** bcrypt with cost factor 10 (~30ms per verify). Demo password is `censo2025` (hashed: `$2b$10$fETDCGLMEEKDNvqCikPtIejMQY90zD3nrAJTEq2Aot5tRbxebqSje`).
- **Session tokens:** HMAC SHA-256 signed, 8-hour TTL with **30-minute idle timeout**.
- **Session storage:** HttpOnly, SameSite=Strict cookies. `Secure` flag is enabled in production (`NODE_ENV=production`).
- **Role-based access control:** 4 roles with hierarchical permissions:
  - `capturista` — read all, change to `EN_REVISION`
  - `vocal` — change any state, make decisions, comment
  - `presidente` — all `vocal` permissions
  - `director` — all permissions + audit log + user listing
- **Session rotation:** session token is regenerated on login. No JWT. No refresh tokens.

## Brute Force Protection

- **Login rate limit:** 5 attempts per 15 minutes per IP, blocked for 15 minutes after.
- **Form submission rate limit:** 20 submissions per hour per IP.
- **File upload rate limit:** implicit via express.json limit (10MB per file).
- **Bulk import rate limit:** implicit via multer file size limit (5MB).
- **Export/Deletion rate limit:** 5 exports per hour, 3 deletions per hour per IP.

## Security Headers

All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (production)

In production deploy (Netlify Function), additional:
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'`
- `X-Frame-Options: DENY`
- `Cache-Control: no-store`

## CSRF Protection

- **SameSite=Strict cookies** prevent most CSRF attacks.
- **No third-party form embedding** is allowed (CSP `frame-ancestors 'none'`).
- **All state-changing endpoints** require authenticated session OR are public-only (form submission, file upload).
- **No GET methods** modify state.

For higher-assurance deployments, consider adding:
- CSRF token in custom header (`X-CSRF-Token`) validated against a session-bound token.
- Same-origin check on all state-changing requests.

## SQL Injection

- **All database queries use parameterized statements** (`?` placeholders). No string concatenation.
- **ORM-less with raw SQL** but every query is verified to use parameters.
- **No raw user input** in SQL identifiers.

## XSS Prevention

- **React auto-escapes** all interpolated content (`{variable}` syntax).
- **No `dangerouslySetInnerHTML`** anywhere in the codebase.
- **Content Security Policy** restricts script sources (production deploy).

## File Upload Security

- **MIME type validation** + **extension whitelist** (.pdf, .jpg, .jpeg, .png for census uploads; .csv for bulk import).
- **Max file size:** 10MB for census, 5MB for CSV.
- **Random storage filenames:** prevent enumeration attacks.
- **Static serving only** via `/uploads/:filename` with `nosniff` header.

## Audit Logging

- **Every authentication event** is logged (login success/fail, logout).
- **Every state change** is logged with before/after values.
- **Every file operation** is logged.
- **IP address and user agent** are recorded.
- **Logs are append-only** (no UPDATE/DELETE operations on audit_log table).
- **Retention:** 10 years.

## Data at Rest

- **Database:** SQLite (local) or Turso/libSQL (deploy) with TLS in transit.
- **Files:** stored on local disk (local) or Turso-compatible storage. NOT encrypted at rest in this MVP.
- **TODO for production hardening:**
  - Enable full-disk encryption on the database host.
  - Use Turso's encryption at rest (available in paid tier).
  - Consider client-side encryption of health data fields.

## Data in Transit

- **HTTPS enforced** via `Strict-Transport-Security` header.
- **Cookies never sent over HTTP** in production.
- **All API responses** require HTTPS in production.

## Secrets Management

- **Demo passwords** are stored as bcrypt hashes in code (not as plaintext).
- **Session secret** uses environment variable `ADMIN_SESSION_SECRET` with secure default warning.
- **Email API key** (Resend) via `RESEND_API_KEY` env var. If missing, emails are logged to console (mock mode).
- **Database URL and token** via `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` env vars.
- **No secrets in code** (except demo hashes which are public by definition).

## Recommended for Production Hardening

1. **Secrets in a vault** (HashiCorp Vault, AWS Secrets Manager) instead of `.env` files.
2. **TLS certificates** from Let's Encrypt or commercial CA. Auto-renewal via certbot.
3. **WAF** (Web Application Firewall) like Cloudflare in front of the app.
4. **DDoS protection** at the edge (Cloudflare, AWS Shield).
5. **Database encryption at rest** (Turso encrypted tier, or local LUKS).
6. **Backup encryption** with separate keys from primary database.
7. **2FA for director role** (TOTP via `speakeasy` or `otplib`).
8. **IP allowlisting** for admin access (only allow CACREF office IPs).
9. **Intrusion detection** (OSSEC, Wazuh).
10. **Penetration testing** annually by third party.

## Incident Response

In case of a security breach:

1. **Contain:** rotate all secrets, force re-login of all sessions.
2. **Assess:** review audit log to determine scope of breach.
3. **Notify:** inform affected users within 72 hours (per LOPDP Art. 34).
4. **Document:** record the incident, response, and lessons learned.
5. **Prevent:** update this SECURITY.md and code to prevent recurrence.

## Security Contact

For security issues, contact: `seguridad@futpvcacref.com`

For data protection inquiries: `protecciondedatos@futpvcacref.com`
