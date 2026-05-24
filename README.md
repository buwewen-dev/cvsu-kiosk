# CvSU Multi-Service University Kiosk System

A self-service kiosk system for Cavite State University, Cavite City Campus. It lets students request academic documents, track live queues, view announcements, find offices on a campus map, and pay through an e-wallet or at the cashier. Office staff and system administrators manage requests, announcements, FAQs, and accounts from a separate admin console.

This is the thesis prototype for the project **Development of a Multi-Service University Kiosk System for Student Service Management in Cavite State University, Cavite City Campus** (Agedio, Balicat, Diaz, Estores, Ornales, May 2026).

## Features

**Kiosk (public)**
- Welcome screen with QR student ID login or guest access
- Main menu with live queue ticker
- Document request flow (office, document, review, payment) with reference number
- E-wallet QR payment or pay-at-cashier option
- Live queue display for each office
- Campus map with clickable buildings and office lookup
- Announcements and events
- FAQs with category filter
- Mission, Vision, and Core Values screen
- Auto-printable receipts

**Office Admin (Registrar, Cashier, OSAS)**
- Per-office dashboard with KPI tiles
- Request management with status updates (pending, processing, ready, released, cancelled)
- Mark requests as paid
- Announcements management for the office
- FAQs management for the office
- Auto-refresh every 20 seconds

**System Admin**
- Cross-office overview and per-office breakdown
- User management (create, activate, deactivate)
- All requests view across offices
- Global announcements
- Mission and Vision editor

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** SQLite (local dev), PostgreSQL (production on Render)
- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework)
- **Auth:** Cookie-based sessions with bcrypt password hashing

## Local Development

Requirements: Node.js 18 or later.

```bash
cd kiosk-system
npm install
npm start
```

Open:
- Kiosk: http://localhost:3000
- Admin: http://localhost:3000/admin

The database is created automatically on first run as `data/kiosk.db` (SQLite).

### Default credentials

- **System Admin:** `admin` / `admin123`
- **Registrar Admin:** `registrar` / `reg123`
- **Cashier Admin:** `cashier` / `cash123`
- **OSAS Admin:** `osas` / `osas123`

### Demo students (for kiosk login)

- `202301234` Railey Mae D. Agedio
- `202300001` Althea Balicat
- `202300002` Florence Sophia V. Diaz
- `202300003` Aicee Emari H. Estores
- `202300004` Alexis F. Ornales

## Deploy to Render

1. Push this folder to a GitHub repository.
2. In Render, click **New** then **Blueprint** and select the repository.
3. Render reads `render.yaml` and provisions:
   - A web service named `cvsu-kiosk`
   - A free PostgreSQL database named `cvsu-kiosk-db`
   - Auto-wires `DATABASE_URL` from the database to the web service
4. After the first deploy, visit the URL Render provides.

The database tables are created and seeded on first start.

## Reset the database (local)

To clear all data and reseed locally, delete the SQLite file:

```bash
rm data/kiosk.db
npm start
```

## Demo Walkthrough (5 minutes)

1. **Welcome.** Open the kiosk. Tap **Scan Student ID** then **Use Demo Student**.
2. **Menu.** Show the 6 service cards and the live queue ticker.
3. **Document Request.** Pick Registrar then Transcript of Records. Review, then pick E-Wallet.
4. **QR Payment.** Show the generated QR code, tap **I have paid**.
5. **Receipt.** Show the receipt with reference number and queue number.
6. **Admin side.** Open `/admin` in another tab, sign in as `registrar` / `reg123`.
7. **Admin Dashboard.** Show the stats and the new request that just appeared.
8. **Update Request.** Open the request, click **Mark Ready**, then **Release Document**.
9. **System Admin.** Sign in as `admin` / `admin123`. Show user management and cross-office overview.

## Project Structure

```
kiosk-system/
  package.json           Node.js dependencies and scripts
  server.js              Express server, API routes, sessions
  db.js                  Database abstraction (SQLite or PostgreSQL)
  seed.js                Initial seed data on first run
  render.yaml            Render Blueprint deployment config
  data/                  Local SQLite database file (gitignored)
  public/                Kiosk (student-facing) frontend
    index.html
    css/styles.css
    js/app.js
    js/data.js
  admin/                 Admin console frontend
    login.html
    office.html          Office admin dashboard
    system.html          System admin console
    css/admin.css
    js/login.js
    js/office.js
    js/system.js
  assets/                Floor plan images and other static assets
```
