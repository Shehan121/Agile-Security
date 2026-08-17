# Vulnerability Dashboard

A security findings aggregator built for a **DevSecOps** university project at
TH Aschaffenburg. Security scanners are good at producing reports and bad at
producing decisions — every tool writes its own format, and re-running a
pipeline duplicates everything it already found. This service takes the raw
output of several scanners across multiple applications, deduplicates it,
stores it, and renders one prioritised view of where the real risk is.

Built as part of *Groupe Trois, Sprint 1*. The project brief, tool research and
sprint documentation live in a companion repository:
**[ITSecurtiy](https://github.com/Shehan121/ITSecurtiy)**.

![Node](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![GitLab CI](https://img.shields.io/badge/GitLab-CI%2FCD-FC6D26?logo=gitlab&logoColor=white)

---

## What problem it solves

The two applications under test — an internal **to-do list** and the
deliberately vulnerable **OWASP Juice Shop** — are scanned by several tools at
different pipeline stages (SAST, dependency scanning, container scanning,
secret detection). That creates three practical problems:

| Problem | How this service handles it |
|---|---|
| Each tool emits a different report format | A single normalised `POST /vulnerabilities` contract that any scanner can be adapted to |
| Re-running the pipeline duplicates every finding | A new report **replaces** all prior findings for that app + tool, so totals never inflate |
| A single report can repeat the same finding | Exact duplicates are collapsed *within* the incoming batch before insert |
| Nobody can see whether security is improving | Every run is snapshotted, so the dashboard can plot a trend over time |

## Features

- **Ingest API** — scanners POST findings from any pipeline stage
- **Three-layer deduplication** — per report, within a batch, and a one-time cleanup at boot
- **Severity triage** — Critical / High / Medium / Low summary cards
- **Charts** — severity donut and per-application bar chart (Chart.js)
- **Findings table** — free-text search, filter by app / severity / tool, sortable columns, paginated 25 at a time
- **Trend history** — totals per pipeline run, so improvement is measurable
- **Light and dark theme**, persisted to `localStorage`
- **Persistent storage** — SQLite in a named Docker volume, surviving redeploys
- **Automated deployment** — GitLab CI builds both images and deploys over SSH

---

## Architecture

```
GitLab CI pipeline                    Server host
┌──────────────────┐                  ┌─────────────────────────────────┐
│ SAST             │                  │  vuln-frontend  (nginx :3002)   │
│ dependency scan  │  POST /vulner-   │    single-page index.html       │
│ container scan   │  abilities       │            │ fetch()            │
│ secret detection │ ───────────────► │            ▼                    │
└──────────────────┘                  │  vuln-backend  (Express :3001)  │
                                      │            │                    │
                                      │            ▼                    │
                                      │  SQLite  /data/vulns.db         │
                                      │  (named volume: vuln-data)      │
                                      └─────────────────────────────────┘
```

Design decisions and the reasoning behind them are in
**[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## API

Base URL: `http://<host>:3001`

### `POST /vulnerabilities`

Submit a scan report. Replaces all existing findings for the same `app` + `tool`.

```json
{
  "app": "juice-shop",
  "tool": "semgrep",
  "run_id": "pipeline-1423",
  "vulnerabilities": [
    {
      "severity": "HIGH",
      "title": "SQL injection in login handler",
      "description": "User input concatenated into a query string",
      "file_path": "routes/login.js"
    }
  ]
}
```

`app`, `tool` and `vulnerabilities` (array) are required — anything else is a
`400`. `run_id` defaults to `"manual"`, and each finding's fields fall back to
`UNKNOWN` / `"No title"` / `""`.

**Response**

```json
{ "message": "Saved 12 vulnerabilities from semgrep for juice-shop (run pipeline-1423) — skipped 3 exact duplicate(s) in the report" }
```

### `GET /vulnerabilities`

All findings, newest first. Optional filters, combined with `AND`:

| Query param | Example |
|---|---|
| `app` | `?app=juice-shop` |
| `severity` | `?severity=CRITICAL` |
| `tool` | `?tool=trivy` |

### `GET /vulnerabilities/stats`

Summary counts for the dashboard cards.

```json
{
  "total": 47,
  "by_severity": [{ "severity": "HIGH", "count": 12 }],
  "by_app":      [{ "app": "juice-shop", "count": 31 }]
}
```

### `GET /vulnerabilities/trend`

One row per pipeline run (`run_id`, `run_at`, `total`, `critical`, `high`,
`medium`, `low`), oldest first, for the history chart.

---

## Database schema

SQLite with `journal_mode = WAL`, stored at `$DB_PATH` (default `/data/vulns.db`).

**`vulnerabilities`** — one row per finding

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | primary key |
| `app` | TEXT | required |
| `tool` | TEXT | required |
| `run_id` | TEXT | defaults to `manual` |
| `severity` | TEXT | `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` / `UNKNOWN` |
| `title` | TEXT | |
| `description` | TEXT | |
| `file_path` | TEXT | |
| `created_at` | TEXT | ISO 8601 |

Indexed on `(app, tool)` — the pair every ingest deletes by.

**`run_snapshots`** — one row per pipeline run, keyed on `run_id`, upserted on
conflict so a re-run updates its own snapshot instead of adding another.

---

## Running it

### Locally

```bash
npm ci
DB_PATH=./vulns.db node server.js       # backend on :3001
```

Then serve `index.html` with any static server, or open it directly. Note the
API base URL is currently hardcoded — see *Known issues* below.

Seed it with a finding to check the round trip:

```bash
curl -X POST http://localhost:3001/vulnerabilities \
  -H 'Content-Type: application/json' \
  -d '{"app":"todo-app","tool":"semgrep","vulnerabilities":[
        {"severity":"HIGH","title":"Hardcoded secret","file_path":"config.js"}]}'

curl http://localhost:3001/vulnerabilities/stats
```

### Docker

```bash
docker compose up --build     # backend :3001, frontend :3002
```

`docker-compose.yml` expects `./backend` and `./frontend` directories — see
*Known issues*.

### CI/CD

`.gitlab-ci.yml` defines two stages:

1. **publish** — build and push `backend:latest` and `frontend:latest` to the
   GitLab container registry (Docker-in-Docker)
2. **deploy** — SSH to the target host, pull both images, recreate the
   containers on a shared `vuln-network`

Required CI variables: `SSH_PRIVATE_KEY`, `SSH_USER`, `SSH_IP`. `CI_REGISTRY*`
variables are provided by GitLab.

---

## Known issues

Documented rather than hidden — these are real and worth fixing:

1. **`docker-compose.yml` does not work against this repository layout.** It
   builds from `./backend` and `./frontend`, but the source files sit flattened
   at the repository root. The correct two-directory layout exists only inside
   the committed `.zip`. Fixing this means moving `server.js`, `package*.json`
   and the `Dockerfile` into `backend/`, and `index.html` plus a three-line
   nginx `Dockerfile` into `frontend/`.

2. **The frontend API URL is hardcoded to a private address** —
   `const API = 'http://10.97.13.101:3001'` in `index.html:334`. The dashboard
   therefore only works on the network where that host exists. It should come
   from a build-time or runtime configuration value.

3. **A build artifact is committed.** `vulnerabilitydashboard-shehan (3).zip`
   duplicates the whole project. It is retained for now only because it is the
   sole copy of the intended `backend/` + `frontend/` structure; it should go
   once issue 1 is fixed.

4. **No automated tests.** For a project whose subject is software quality,
   this is the most conspicuous gap. The ingest endpoint's deduplication logic
   is the obvious place to start.

5. **The ingest endpoint is unauthenticated.** Acceptable inside a private
   network for a coursework deployment; it would need a token before being
   exposed anywhere real.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 (alpine) |
| API | Express 4.18, CORS enabled, 10 MB JSON limit |
| Database | SQLite via `better-sqlite3` 9.4 (synchronous, WAL) |
| Frontend | Single-file HTML + vanilla JS, Chart.js 4.4.1 via CDN |
| Web server | nginx:alpine |
| Orchestration | Docker Compose |
| CI/CD | GitLab CI with Docker-in-Docker |

## Repository layout

```
.
├── server.js              Express API — ingest, query, stats, trend
├── index.html             the entire dashboard UI (single file)
├── package.json           express, cors, better-sqlite3
├── Dockerfile             backend image (node:20-alpine)
├── docker-compose.yml     backend + frontend + named volume
├── .gitlab-ci.yml         publish and deploy pipeline
├── ARCHITECTURE.md        design decisions and reasoning
└── README.md
```

## Author

**Shehan Nimsara** — B.Sc. Software Design (International), TH Aschaffenburg
