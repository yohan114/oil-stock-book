# 🛢️ Oil Stock Book — Issue / Receive Tracking & Monitoring

A self-contained web app that turns **Edward & Christie (Pvt) Ltd**'s Excel fuel &
lubricant stock book into a live system of record. Store keepers record receipts and
issues with automatic running balances; managers monitor stock levels, reorder alerts,
**per-machine** and **per-project** consumption, and run-out forecasts.

It imports the two source Excel files (the stock book and the 412-machine fleet list) on
first run, links every oil issue to the machine or project that consumed it, and
reconciles **exactly** to the original book.

![Dashboard](docs/screenshots/dashboard.png)

---

## ✨ Features

- **Live stock ledger** — add Receipts & Issues; running balance auto-recalculated; void with one click. Each product keeps a row-for-row ledger identical to the official book.
- **Smart consumer linking** — each issue is matched to a **fleet machine** (by E&C code or registration) or a **project/site**, normalising typos and spelling variants. Unmatched entries land in a **Mapping** screen where one click links them and back-fills history.
- **Low-stock & reorder alerts** — per-product reorder levels and optional unit prices → stock valuation and a prioritised "needs attention" list.
- **Per-machine consumption** — oil used per machine with **abnormal-usage detection** (robust median + MAD vs. same-type machines) to surface likely leaks, faults or mis-entries.
- **Per-project / site consumption** — total oil (and cost, if prices are set) issued to CEP-03, Ruwanwella, Marawila, Port City, etc.
- **Trends & forecast** — monthly received-vs-issued charts, top consumers, and a projected **run-out date** per product at the current burn rate.
- **Printable stock book** — official-looking, per-product ledger with company header and signature lines (Print / Save as PDF).

| Trends & forecast | Record movement |
|---|---|
| ![Trends](docs/screenshots/trends.png) | ![Entry](docs/screenshots/modal.png) |

---

## 🚀 Quick start

Requires **Node.js 18+** (tested on Node 22).

```bash
npm run setup     # installs server + client deps and builds the web UI
npm start         # starts the app on http://localhost:3000
```

On first start, an empty database is **auto-seeded** from the Excel files in
`data/source/`, so the app opens fully populated.

### Development (hot reload)

```bash
npm run dev       # API (3000) + Vite dev server (5173) with /api proxy
```

### Re-import the Excel data

```bash
npm run import            # idempotent — never duplicates, keeps manual entries
npm run import -- --fresh # wipe and re-import from scratch
```

---

## 🧱 Tech stack

- **Backend** — Node.js + Express + [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (synchronous SQLite).
- **Importer** — [`xlsx`](https://sheetjs.com) (SheetJS).
- **Frontend** — Vite + React + Tailwind CSS + [Recharts](https://recharts.org), built to static and served by Express (one process, one port).
- **Database** — a single SQLite file at `data/oilbook.db`.

---

## 📁 Project structure

```
oil-stock-book/
├── data/source/        # the two source .xlsx (used to seed the DB)
├── scripts/
│   ├── import.js       # ETL: parse sheets, classify consumers, reconcile balances
│   └── lib.js          # shared normalise() / date parsing / classification rules
├── server/
│   ├── index.js        # Express bootstrap, static serving, first-run auto-import
│   ├── db.js           # SQLite connection + schema + settings
│   ├── schema.sql      # data model
│   ├── ledger.js       # recomputeLedger() — single source of truth for balances
│   ├── util.js         # consumer classification + query helpers
│   └── routes/         # products, transactions, assets, projects, analytics, aliases, settings
└── client/             # Vite + React app (pages/ + components/)
```

---

## 🔌 API overview (`/api`)

| Area | Endpoints |
|---|---|
| Products | `GET /products`, `GET /products/:id`, `PATCH /products/:id`, `GET /products/:id/ledger` |
| Transactions | `GET /transactions`, `POST /transactions`, `PATCH /transactions/:id`, `POST /transactions/:id/void` |
| Fleet | `GET /assets?search=`, `GET /assets/:id`, `GET /assets/types` |
| Projects | `GET /projects`, `GET /projects/:id`, `POST /projects` |
| Monitoring | `GET /dashboard/stock`, `GET /dashboard/alerts`, `GET /forecast`, `GET /consumption/by-asset`, `GET /consumption/by-project`, `GET /trends/monthly`, `GET /trends/top-consumers` |
| Mapping | `GET /aliases`, `POST /aliases/:id/resolve` |
| Settings | `GET /settings`, `PUT /settings` |

---

## 📊 Data fidelity

The importer treats the spreadsheet's **Balance** column as authoritative: opening
balances (`b/f`) and stock-take adjustments are captured as movements so the recomputed
running balance reproduces the book exactly. On every import a cross-check prints the
computed balance against the original "Summery" snapshot — **all 18 listed products
match to the unit.** Out-of-range dates are tolerated (flagged, never dropped).

## ⚠️ Notes

- Designed as a single-user local / office-LAN app — there is no authentication.
- The `xlsx` import library carries a known advisory; it only ever parses the
  organisation's own trusted files at import time, never untrusted uploads at runtime.
