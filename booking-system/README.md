# Single-Business Booking Website Template

React/Vite + Express/MongoDB booking website for one local service business. The template includes a public booking flow, customer manage links, owner admin, monitoring, email jobs, reminders, review requests, and production deployment notes.

## What Is Included

- Public website pages: home, services, booking, manage booking, verify booking
- Privacy and cookie notice pages for per-business legal customization
- Owner admin: calendar, leads, email automations
- Monitor dashboard: health, email recovery, operational controls, incidents
- Booking safeguards: service durations, slot conflicts, busy overrides, rate limits
- Email automation: verification/manage link, owner notice, reminders, review requests
- Release checks: production build, frontend smoke tests, API tests
- Deployment support: Vercel frontend proxying `/api/*` to a Render backend

## Customize For A Business

Start with these files:

- `client/src/template.ts` for public brand name, category, hero copy, CTA text, and page headings
- `client/src/data/services.ts` for frontend fallback service examples
- `server/src/services.ts` for backend default services, timezone-driven slots, email defaults, and operational defaults
- `client/src/assets/service-hero.jpg` for the public hero image
- `client/src/pages/PrivacyPage.tsx` and `client/src/pages/CookiesPage.tsx` for legal notices
- `.env.example` and `.env.production.example` for environment-specific values

Keep service IDs stable once a business is live, because existing bookings store those IDs.

## Local Setup

```bash
npm install
cp .env.example .env
```

Set real local values in `.env`, especially:

- `MONGODB_URL`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `MONITOR_PASSWORD_HASH`
- `MONITOR_SESSION_SECRET`

Generate password hashes:

```bash
node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash(process.argv[1], 12));" "your-password"
```

Install the browser used by frontend smoke tests once:

```bash
npx playwright install chromium
```

Run development servers:

```bash
npm run dev
```

## Verification

Fast checks:

```bash
npm run build
npm run test:smoke
npm audit --omit=dev
```

Full release check:

```bash
npm run verify:release
```

Local API tests start an isolated in-memory MongoDB by default, so they do not use the
MongoDB URL from `.env`. GitHub Actions uses its MongoDB service container. To force a
specific test database, set `TEST_MONGODB_URL`.

## Deployment

Use the detailed deployment guide in `DEPLOYMENT.md`.

Default production target:

- Frontend: Vercel
- Backend/API/workers: Render
- Database: MongoDB Atlas
- Email: Resend SMTP through Nodemailer

The browser should call same-origin `/api/*`. Do not point browser code directly at Render unless cookie/CORS behavior is intentionally changed and retested.

## Clean Zip Export

Do not zip the working folder directly. It contains local files such as `.env`, `node_modules`, logs, and build output.

Use:

```bash
git archive --format=zip --output booking-template.zip HEAD
```

This exports only tracked project files from the current commit.

## Cookie Note

The template uses secure admin/monitor session cookies for authenticated operator areas. These are required for login security. If you add analytics, pixels, ads, heatmaps, or other non-essential tracking scripts, add a proper cookie consent mechanism before those scripts load.
