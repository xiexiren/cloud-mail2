# cloud-mail Cloudflare compatibility & optimization review

Review date: 2026-08-08

## Applied fixes

1. Workers AI default model changed from deprecated `@cf/meta/llama-3.1-8b-instruct` to active `@cf/meta/llama-3.1-8b-instruct-fast`.
2. Incoming Email Routing parsing now feeds `message.raw` directly to `postal-mime` instead of buffering/decoding it chunk-by-chunk.
3. `/attachments/*`, `/static/*`, and `/oss/*` now read through the selected storage backend (KV / native R2 / S3) and return 404 safely.
4. Cloudflare Email Service messages are recorded as `SENT` after `send()` rather than `DELIVERED`; true delivery requires Email Sending lifecycle events.
5. Attachment-count and Cloudflare recipient-count validation moved before the provider send call to prevent send-success/database-failure duplicate retries.
6. Cloudflare Email Service errors are mapped to useful numeric API statuses while retaining the Cloudflare error code in the message.
7. Static assets use selective `run_worker_first` patterns (`/api/*`, `/attachments/*`, `/static/*`) instead of invoking the Worker for every frontend asset.
8. Database initialization now prefers POST + `X-Init-Secret`, keeping secrets out of URLs; legacy GET remains compatible.
9. GitHub Action initialization retries and default AI model updated.
10. `pnpm test` now runs Vitest instead of deploying a test Worker; Vitest points to the existing TOML config and stale Hello World tests were replaced.
11. Removed an unnecessary inner `await` that serialized one branch of a `Promise.all`.
12. Added an administrator-only `/api/cloudflare/health` smoke-test endpoint. Use `?probeAi=1` for a real tiny Workers AI inference.
13. Random OAuth/import fallback passwords now use `crypto.getRandomValues()` instead of `Math.random()`.

## Cloudflare services used by this project

- Workers + Static Assets
- D1
- Workers KV
- R2 (optional, with S3-compatible external storage fallback)
- Email Routing / Email Workers
- Email Service `send_email` binding (optional)
- Workers AI (verification-code extraction)
- Turnstile Siteverify
- Cron Triggers

## Deployment checks still required in your Cloudflare account

Code/API compatibility does not prove that a particular account has the necessary bindings, domains, routing rules, paid-plan capability, or API-token permissions. Verify: D1 and KV bindings exist, Email Routing points the domain to this Worker, Email Sending domain is onboarded if outbound Cloudflare Email is enabled, the API token has D1 Write when the workflow auto-creates D1, and Turnstile site/secret keys match the deployed hostname.

## Remaining high-priority recommendations (not changed automatically)

1. **Password KDF**: `src/utils/crypto-utils.js` still stores passwords as one salted SHA-256 digest. Migrate to a password KDF (PBKDF2/scrypt/Argon2) with a versioned hash format and backward-compatible login migration before changing existing accounts.
2. **Session revocation consistency**: login sessions/revocation are stored in Workers KV. KV is eventually consistent across regions, so logout/revocation is not the best fit for security state requiring immediate global consistency. Consider D1 or Durable Objects for authoritative session state and use KV only as a cache.
3. **CORS**: `src/hono/hono.js` enables unrestricted CORS for every route. If the frontend and API are served from the same origin, restrict allowed origins or remove global CORS; retain an allow-list only if cross-origin API clients are required.
4. **Inbound idempotency**: received email rows have no unique constraint on provider `message_id`. Add an idempotency strategy before changing retry/error behavior so a retried inbound message cannot be persisted twice.
5. **Cloudflare Email delivery events**: if UI needs true `DELIVERED`/`BOUNCED`/`COMPLAINED` states for Cloudflare Email Service, add a Queue event subscription consumer keyed by Cloudflare `messageId`. The optimized code intentionally records the immediate result only as `SENT`.
6. **Compatibility date/dependencies**: upgrade `compatibility_date` and major dependencies in a dedicated test branch rather than bumping them together with functional fixes.
