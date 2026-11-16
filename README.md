# 🚗 QueueMasters: Auto-Care Management System

[![Frontend](https://img.shields.io/badge/Frontend-React.js-blue.svg)](https://reactjs.org/)
[![Status](https://img.shields.io/badge/Status-Active_Development-brightgreen.svg)]()

Managing a high-volume car wash shouldn't be chaotic. **QueueMasters** is a real-time operational dashboard and customer queue tracking system built to streamline auto-care workflows. From the moment a vehicle rolls into the bay to the final release, this system keeps staff coordinated, tracks financial analytics, and ensures customers know exactly when their car is ready.

## ✨ Core Features

* **Real-Time Queue Tracking:** A customer-facing digital board that live-polls vehicle statuses across three stages: *Waiting*, *Washing*, and *Ready*.
* **Role-Based Access Control (RBAC):** Secure entry differentiating between **Admins** (Managers) and **Washers** (Yard Staff). Managers get full access to financial archives and HR controls.
* **Live Financial Analytics:** An intuitive dashboard calculating projected revenue from the active queue, total daily sales, and service composition (Standard, Valet, Engine Clean).
* **Operational Dashboard:** Staff can update vehicle stages, edit intake errors on the fly, and "Release" vehicles to automatically archive the sale into the database.
* **Founder Protection:** Built-in HR logic that prevents the primary system administrator from being accidentally locked out or deleted by other staff.

## 🛠️ Tech Stack

* **Frontend Environment:** React.js, React Router DOM
* **State Management & Data Fetching:** React Hooks (`useState`, `useEffect`), Axios
* **Styling:** Custom CSS with dynamic status pill rendering and progress bars.
* **Backend:** Spring Boot RESTful API (Java 17+) running on `localhost:8080`.
* **Database:** PostgreSQL (staff accounts, live queue and the historical sales archive). Tests use an in-memory H2 database so they need no server.
* **IDE:** IntelliJ and VS CODE 
## 🚀 Quick Start

To get the QueueMasters frontend running locally, follow these steps:

The source code now lives unzipped in `backend/` and `frontend/` (the old `.zip` files are kept only for reference).

### 0. One-time: create the PostgreSQL database
Requires **PostgreSQL 14+** running on port 5432 ([download](https://www.postgresql.org/download/windows/)). Then, from the project root:
```bash
# Windows (adjust the version folder if yours differs)
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f backend\db\setup.sql
# Linux / macOS
psql -U postgres -f backend/db/setup.sql
```
This creates a role `queuemasters` (password `queuemasters123`) and a database `queuemasters`. The backend creates the tables itself on first start.

To use different credentials or a remote server, set environment variables instead of editing code: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (see `backend/src/main/resources/application.properties`).

**Upgrading from the old H2 version?** Your staff accounts and sales archive were exported to `backend/db/migrate-from-h2.sql`. Load them once with:
```bash
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U queuemasters -d queuemasters -f backend\db\migrate-from-h2.sql
```

### ⚡ Easiest: double-click `start.bat` (Windows)
It finds Java automatically (including the JDK that comes with Android Studio or IntelliJ), checks that PostgreSQL is running (and starts its Windows service if needed), installs the frontend packages the first time, starts the backend and frontend in their own windows, and opens http://localhost:3000. Close those two windows to stop the system.

### Or start them by hand
#### 1. Start the backend (Spring Boot, port 8080)
Requires **Java 17+** and the PostgreSQL database from step 0.
```bash
cd backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
```
On a brand-new database a founder account is created automatically: **`admin` / `admin@123`**. Change it under **Staff** after the first login. Convention for this system: managers use `admin@123`, washers use `staff@123`.

#### 2. Start the frontend (React, port 3000)
Requires **Node 18+**.
```bash
cd frontend
npm install
npm start
```
Open http://localhost:3000. To point at a different API, create `frontend/.env` with `REACT_APP_API_URL=http://host:8080/api`.

#### 3. Run the tests
```bash
cd frontend && npm test -- --watchAll=false
cd backend && ./mvnw test          # uses in-memory H2, no PostgreSQL needed
```

## ☁️ Deploy (Vercel + Render)

Vercel hosts static sites, so it serves the **React frontend**. The **Spring Boot API and PostgreSQL** run on
[Render](https://render.com) (free tier) from the `render.yaml` blueprint in the project root. Both pieces are
configured by environment variables only, nothing in the code changes between local and production.

| Piece | Where | Config |
|---|---|---|
| Frontend | Vercel project `queuemasters` → https://queuemasters-alpha.vercel.app | `frontend/vercel.json`, env `REACT_APP_API_URL` |
| API | Render web service `queuemasters-api` (Docker, `backend/Dockerfile`) | `render.yaml`, env `DB_*`, `CORS_ALLOWED_ORIGINS`, `PORT` |
| Database | Render PostgreSQL `queuemasters-db` | wired automatically by `render.yaml` |

### 1. Backend + database on Render (no card needed)
Render's **Blueprint** feature (`render.yaml`) asks for a payment method, so create the two free resources by hand instead:
1. Push this repository to GitHub (Render builds from the repo).
2. **Database:** Render dashboard → **New → Postgres** → name `queuemasters-db`, Instance type **Free** → Create.
   On its page copy the **Internal Database URL** (`postgresql://user:password@host/db`).
3. **API:** **New → Web Service** → pick the `QueueMasters-system` repo → Language **Docker**, Root Directory **`backend`**,
   Instance type **Free**. Under *Environment variables* add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Internal Database URL from step 2 |
   | `CORS_ALLOWED_ORIGINS` | `https://queuemasters-alpha.vercel.app` (your Vercel URL) |

   Optional: Health Check Path `/api/health`. Click **Deploy Web Service**.
4. When the build is live, copy the service URL, e.g. `https://queuemasters-api.onrender.com`, and check `https://queuemasters-api.onrender.com/api/health` returns `{"status":"ok"}`.
5. First login on the empty database: **`admin` / `admin@123`** (created by `DataSeeder`). Change it under **Staff**.
   To carry over local data, run `backend/db/migrate-from-h2.sql` against the Render database (use the External Database URL with `psql`).

The backend accepts either one `DATABASE_URL` (`postgres://...`, as Render, Railway, Neon, Supabase and Heroku provide it) or the
separate `DB_URL` / `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` variables.

Notes: the free web service sleeps after 15 minutes without traffic, so the first request after that takes ~30 s (the frontend waits for it).
Render's free PostgreSQL is deleted 30 days after creation unless upgraded; a free [Neon](https://neon.tech) database never expires and
works the same way: paste its connection string as `DATABASE_URL`. If you do have a card on file, **New → Blueprint** with `render.yaml` sets all of this up automatically.

### 2. Frontend on Vercel
```bash
cd frontend
npx vercel link --yes --project queuemasters                   # once per machine
npx vercel env add REACT_APP_API_URL production                 # paste: https://queuemasters-api.onrender.com/api
npx vercel deploy --prod --yes
```
`REACT_APP_API_URL` is baked in at build time, so redeploy after changing it. `vercel.json` routes every path to
`index.html` (React Router) and caches `/static/*` for a year. To deploy on every push instead, run `npx vercel git connect`.

### 3. Allow the frontend to call the API
`CORS_ALLOWED_ORIGINS` on the Render service lists the browser origins the API accepts (comma-separated, `*` wildcards allowed).
`render.yaml` already contains `https://queuemasters-alpha.vercel.app` and this project's preview URLs; add a custom domain there if you attach one.

## 🗺️ Pages
| Route | Who | What |
|---|---|---|
| `/` | Everyone | Landing page: live queue stats, services, how it works, plate tracker |
| `/book` | Everyone | Book a wash, then get a ticket and a "track my car" link |
| `/tracker` | Everyone | TV-style live board (`?plate=MP123GP` highlights a car) |
| `/admin` | Washers & managers | Operations dashboard: filter, search, advance stages, release |
| `/reports` | Managers | Revenue analytics, service mix, recent sales |
| `/manage-staff`, `/signup` | Managers | Staff accounts, with the founder protected from deletion and demotion |

Photos are from [Unsplash](https://unsplash.com) (free to use under the Unsplash License) and are stored in `frontend/public/images/`.
