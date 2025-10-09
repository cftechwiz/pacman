# Pac-Man Modernized

This repo hosts a modernized take on the classic Pac-Man Node.js game. The app now targets Node 18+, uses the latest MongoDB driver, renders server views with EJS, and emits structured logs through Pino. Docker and Kubernetes manifests plus GitHub Actions workflows provide an end-to-end delivery pipeline, and a fresh test suite keeps critical routes covered.

## Features

- **Current Node.js stack** – Express 4, MongoDB driver 6, EJS templates, and Pino logging.
- **Structured logging** – Consistent JSON output across the API, location probes, and server bootstrap.
- **Automated testing** – Mocha/Chai tests with Mongo Memory Server and Supertest integration coverage.
- **Container & orchestration ready** – Production-grade `Dockerfile`, `docker-compose.yml`, and `pacman.yaml` for Kubernetes.
- **CI/CD workflows** – GitHub Actions lint/test/build pipeline plus a release workflow that packages artifacts with `npm pack`.
- **Observability-ready** – Includes OpenTelemetry runtime dependencies so you can plug in tracing/exporters without extra plumbing.

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- MongoDB instance (local, Atlas, or provided via Docker/Kubernetes)

### Installation

```bash
npm install
```

### Environment Variables

Most runtime settings live in `.env`. The key values are:

| Variable | Purpose | Default in `.env` |
| --- | --- | --- |
| `NODE_ENV` | Runtime mode | `production` |
| `PORT` | HTTP port | `8080` |
| `MONGO_SERVICE_HOST` | MongoDB host (single or comma-separated list) | `pacman-mongo` |
| `MY_MONGO_PORT` | MongoDB port | `27017` |
| `MONGO_DATABASE` | Database name | `pacman` |
| `MONGO_USE_SSL` / `MONGO_VALIDATE_SSL` | SSL flags | `false` / `true` |
| `MONGO_AUTH_USER`, `MONGO_AUTH_PWD`, `MONGO_REPLICA_SET` | Optional auth/replica-set settings | empty |
| `SPLUNK_REALM` | Splunk Observability realm | empty |
| `SPLUNK_RUM_ACCESS_TOKEN` | Splunk RUM access token | empty |
| `SPLUNK_APPLICATION_NAME` | Application name reported to Splunk | `pacman` |
| `SPLUNK_APPLICATION_VERSION` | Application version reported to Splunk | `0.0.1` |
| `SPLUNK_DEPLOYMENT_ENVIRONMENT` | Environment label for Splunk | `production` |
| `SPLUNK_SESSION_RECORDER` | Session recorder implementation (e.g. `web`) | `web` |
| `SPLUNK_ACCESS_TOKEN` | Splunk Observability access token for Node agent | empty |
| `OTEL_LOG_LEVEL` | Node.js OTel agent log level | `debug` |
| `OTEL_SERVICE_NAME` | Service name reported to OTel | `pacman-app` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector endpoint for OTel spans/metrics | `http://collector.example.com:4318` |
| `OTEL_RESOURCE_ATTRIBUTES` | Extra OTel resource attributes | `deployment.environment=production,service.version=0.0.1` |
| `SPLUNK_METRICS_ENABLED` | Enable Splunk metrics export | `true` |
| `SPLUNK_INSTRUMENTATION_METRICS_ENABLED` | Enable instrumentation metrics | `true` |
| `SPLUNK_PROFILER_ENABLED` | Enable Splunk continuous profiler | `true` |
| `SPLUNK_PROFILER_LOGS_ENDPOINT` | Profiler logs endpoint | `http://collector.example.com:4318` |
| `SPLUNK_REALM` | Splunk Observability realm | empty |
| `SPLUNK_RUM_ACCESS_TOKEN` | Splunk RUM access token | empty |
| `SPLUNK_APPLICATION_NAME` | Application name reported to Splunk | `pacman` |
| `SPLUNK_APPLICATION_VERSION` | Application version reported to Splunk | `0.0.1` |
| `SPLUNK_DEPLOYMENT_ENVIRONMENT` | Environment label for Splunk | `production` |

### Splunk RUM Instrumentation

The browser loads `/js/splunk-instrumentation.js`, which the Express app generates on the fly using the Splunk-related environment variables. Provide `SPLUNK_RUM_ACCESS_TOKEN` (and optionally realm/name/version/environment) in `.env` or your deployment secrets and the script will call `SplunkOtelWeb.init` only when a token is present. If you also set `SPLUNK_SESSION_RECORDER`, the auto-generated module imports `@splunk/otel-web-session-recorder` and calls `SplunkSessionRecorder.init` with those values.

### Local Development

```bash
# Run the app
npm start

# Hot-reload development server (nodemon)
npm run dev

# Lint, test, and combined build script
npm run lint
npm test
npm run build
```

Tests use `mongodb-memory-server`. No external MongoDB is required for the test suite.

### Load Simulation

An automated browser-based load driver is available to exercise the UI and backing API routes. Install Playwright (v1.56.x) browsers once:

```bash
npx playwright install chromium
```

Then start the app (`npm start`) in one terminal and, in another, run:

```bash
npm run load:test
```

Docker Compose users can run the same driver in an ephemeral container (the bundled image already contains the matching Playwright 1.56 runtime):

```bash
docker compose run --rm pacman-load
```

(`docker-compose run --rm pacman-load` on older Compose releases.)

Environment variables control the session behaviour:

| Variable | Description | Default |
| --- | --- | --- |
| `LOAD_TEST_BASE_URL` | Target URL for the load driver | `http://localhost:8080` |
| `LOAD_TEST_VUS` | Number of concurrent virtual users | `5` |
| `LOAD_TEST_MIN_SESSION` / `LOAD_TEST_MAX_SESSION` | Session duration range (seconds) | `10` / `30` |
| `LOAD_TEST_THINK_TIME_MS` | Think time between actions (ms) | `750` |
| `LOAD_TEST_MAX_SCORE` / `LOAD_TEST_MAX_LEVEL` / `LOAD_TEST_MAX_LIVES` | Gameplay metric limits | `5000` / `25` / `5` |

Each virtual user opens the site headlessly, posts user stats & highscores, and polls the REST endpoints with randomised cadence to simulate real gameplay traffic.

## Docker & Docker Compose

Build the production image from the project root:

```bash
docker build -t <registry>/<user>/pacman-app:latest .
```

Run the local stack (app + MongoDB):

```bash
docker compose up --build
```

The compose file maps the `.env` values into both containers and persists MongoDB data via the `mongo-data` volume.

## Kubernetes Deployment

`pacman.yaml` contains everything needed to deploy into a cluster:

- Namespace, ConfigMap, and PersistentVolumeClaim
- MongoDB Deployment + Service
- Pac-Man Deployment + LoadBalancer Service

Adjust the `pacman-app` image reference to match your registry, then apply:

```bash
kubectl apply -f pacman.yaml
```

If your cluster lacks a LoadBalancer, switch the service type to `NodePort` or expose via an Ingress.

## Continuous Integration & Releases

GitHub Actions workflows live in `.github/workflows`:

- `ci.yml` runs lint ➝ tests (Node 18/20 matrix) ➝ build on pushes to `master` or `modernize`, and on pull requests.
- `release.yml` triggers on version tags (`v*`) or manual dispatch, running lint/test/build, packaging with `npm pack`, uploading artifacts, and attaching the tarball to a GitHub Release.

CI relies on `npm ci`, so ensure `package-lock.json` stays up to date.

## Project Structure Highlights

```
.
├── app.js                # Express app setup
├── bin/server.js         # HTTP server bootstrap with Pino logging
├── public/               # Front-end game assets (HTML/CSS/JS/media)
├── routes/               # REST API routes (highscores, user stats, location metadata)
├── lib/                  # Database connector, logger, configuration helpers
├── test/                 # Mocha/Chai/Supertest specs
├── Dockerfile            # Production container image (node:20-alpine)
├── docker-compose.yml    # Local app + Mongo stack
├── pacman.yaml           # Kubernetes deployment
└── .github/workflows/    # CI/CD pipelines
```

## Summary of Modernization Work

- Upgraded runtime dependencies, adopted async/await across Mongo usage, and replaced Jade with EJS.
- Added a Pino-based logging layer to the server and routes for consistent structured output.
- Implemented unit and integration tests with MongoMemoryServer & Supertest.
- Delivered container, docker-compose, and Kubernetes manifests for repeatable deployments.
- Established linting, build, test scripts, and GitHub Actions workflows, including artifact-based releases.

Enjoy the refreshed Pac-Man experience!
