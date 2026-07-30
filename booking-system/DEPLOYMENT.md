# Production Deployment

The production target is a split deployment:

- Frontend: Vercel, serving the Vite React app.
- Backend: Render, running the Express API and background email/monitoring workers.
- Email: Resend SMTP through Nodemailer.
- Database: MongoDB Atlas or another managed MongoDB instance.

The browser always calls same-origin `/api/*`. Vercel handles those requests with `api/[...path].js` and forwards them to Render using `RENDER_BACKEND_URL`. This keeps admin and monitor cookies same-origin on the public website domain.

## 1. Prepare External Services

1. Create a production MongoDB database.
2. Create and verify the sending domain in Resend.
3. Create a Resend API key for SMTP.
4. Decide the final public frontend URL, for example `https://your-domain.com`.

## 2. Generate Secrets

Create separate admin and monitor passwords, then generate bcrypt hashes:

```bash
node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash(process.argv[1], 12));" "your-admin-password"
node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash(process.argv[1], 12));" "your-monitor-password"
```

Generate separate session secrets:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Do not reuse the admin password/hash/secret for monitoring.

## 3. Deploy Backend on Render

Use the included `render.yaml` Blueprint, or create a Render Web Service manually with:

- Runtime: Node
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/api/ready`

Set these Render environment variables:

- `NODE_ENV=production`
- `APP_BASE_URL=https://your-domain.com`
- `CLIENT_ORIGIN=https://your-domain.com`
- `MONGODB_URL=...`
- `MONGODB_DB_NAME=booking_production`
- `BUSINESS_TIMEZONE=...`
- `BUSINESS_OWNER_EMAIL=owner@your-domain.com`
- `SMTP_HOST=smtp.resend.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=resend`
- `SMTP_PASS=re_your_resend_api_key`
- `MAIL_FROM=Booking Notifications <bookings@your-verified-domain.com>`
- `ALERTING_ENABLED=true`
- `ALERT_EMAIL_TO=operator@your-domain.com`
- `AUTOMATED_EMAILS_ENABLED=true`
- `EMAIL_JOB_WORKER_ENABLED=true`
- `TRUST_PROXY=true`
- `ADMIN_PASSWORD_HASH=...`
- `ADMIN_SESSION_SECRET=...`
- `ADMIN_SESSION_VERSION=1`
- `MONITOR_PASSWORD_HASH=...`
- `MONITOR_SESSION_SECRET=...`
- `MONITOR_SESSION_VERSION=1`
- `MONITOR_MFA_ENABLED=true`
- `MONITOR_MFA_CODE_TTL_MINUTES=10`
- `MONITOR_MFA_MAX_ATTEMPTS=5`

After Render deploys, verify:

```bash
curl https://your-render-service.onrender.com/api/health
curl https://your-render-service.onrender.com/api/ready
```

## 4. Deploy Frontend on Vercel

The included `vercel.json` builds only the Vite frontend and serves `dist/client`.

Set this Vercel environment variable:

- `RENDER_BACKEND_URL=https://your-render-service.onrender.com`

Vercel should use:

- Install command: `npm ci`
- Build command: `npm run build:client`
- Output directory: `dist/client`

After Vercel deploys, verify these through the Vercel domain:

```bash
curl https://your-domain.com/api/health
curl https://your-domain.com/api/ready
```

Then test in the browser:

- Customer booking flow creates a booking.
- Customer receives the Resend booking email.
- `/admin` login works.
- `/monitoring` login sends a Resend MFA code in production.
- `/monitoring` dashboard loads and reports database/email status.

## 5. Release Check

Before treating a deployment as production-ready, run:

```bash
npm run verify:release
```

Local API tests start an isolated in-memory MongoDB by default, so they do not use the MongoDB URL from `.env`. GitHub Actions uses its MongoDB service container. Set `TEST_MONGODB_URL` only when you intentionally want the API tests to use a specific isolated test database.
It also runs the frontend smoke tests. Install the Playwright Chromium browser once locally with `npx playwright install chromium` if it is not already present.

## Notes

- Production validation rejects unsafe defaults, shared admin/monitor credentials, disabled monitor MFA, localhost SMTP, and test-looking database names.
- Do not disable `MONITOR_MFA_ENABLED` in production.
- Do not make browser code call Render directly. Keep `/api/*` same-origin through Vercel.
