# Vercel API

Production runs React and the Node.js API together in the existing Vercel project.
The original Java backend remains in `backend/` for local use; Render is no longer required.

## Deploy

Run from `frontend/`:

```powershell
npm ci
npm run test:api
npm test -- --watchAll=false
npm run build
npx vercel deploy --prod --yes
```

The Vercel project root is this `frontend/` directory. The Neon integration supplies
`DATABASE_URL` to Production and Preview. Keep credentials server-side; never prefix
database settings with `REACT_APP_`. Leave `REACT_APP_API_URL` unset so the browser uses
the same-origin `/api` functions. A fresh database creates `admin` / `admin@123`;
change the password under Staff after signing in. `INITIAL_ADMIN_PASSWORD` can override
the initial password before the first request. Changing it later does not reset an account.

`GET /api/health` verifies the database connection and initializes the schema on a new
cold start. Table names and fields match the Java app. Existing plaintext passwords
are upgraded to scrypt hashes at successful login. New passwords are always hashed.
Sessions use random HttpOnly, Secure, SameSite cookies on Vercel, with hashed tokens
stored in PostgreSQL and a seven-day lifetime. Sign out revokes the server session.
Password and role changes revoke all sessions for the affected account. Login attempts
are rate limited per account and source address. Public queue responses omit phone numbers.

Staff operations require a server session. Account management and archive clearing
require ADMIN. Vehicle release and sale insertion use one transaction to prevent
lost vehicles or duplicate sales. Sale dates use Africa/Johannesburg.

## Tests and local development

`npm run test:api` uses a temporary, isolated schema in the local `queuemasters` PostgreSQL
database and removes it afterward. Override with `TEST_DATABASE_URL` for a dedicated test
database. Do not point tests at production. The tests cover authorization, founder
protection, server pricing, status progression, session revocation, concurrent release,
and rollback when sale insertion fails.

`npm start` still proxies `/api` to the original Java backend on port 8080. To run the
Node functions locally, use `npx vercel dev` with a local development `DATABASE_URL`.
The Java login does not issue the Node session cookie; use the Node API to test server
sessions. Java cannot authenticate newly hashed Node passwords, so use separate databases
when comparing the two backends.

The free Vercel Hobby plan is for personal/non-commercial demos, with plan usage limits.
Neon Free also has usage limits. This deployment does not select paid services.
