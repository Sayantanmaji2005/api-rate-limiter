# API Rate Limiter Service

Production-style API rate limiter with:
- JWT auth and API key support
- Tier-based limits (`FREE`, `PRO`, `ENTERPRISE`)
- Algorithm selection (`TOKEN_BUCKET`, `SLIDING_WINDOW`)
- Distributed limiting using Redis
- Cost-based endpoint limiting and custom per-endpoint rules
- Circuit breaker fallback for limiter backend failures
- Whitelist/Blacklist management (admin)
- User/Admin analytics dashboard

## Tech Stack
- Backend: Node.js, Express, MongoDB (Mongoose), Redis
- Frontend: React + Vite

## Run Locally

1. Start Redis
2. Start MongoDB
3. Configure backend env
4. Start backend and frontend

```bash
# terminal 1
cd backend
npm install
npm run dev

# terminal 2
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies backend calls to `VITE_API_URL` (default: `http://localhost:5001`).

## Deploy (Docker Compose - Recommended)

This repo now includes:
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf` (serves React app + proxies API routes to backend)
- `docker-compose.prod.yml`

### 1. Prepare environment
Create `backend/.env` from `backend/.env.example` and set at least:

```env
JWT_SECRET=replace_with_a_long_random_secret
```

You can keep these defaults when using `docker-compose.prod.yml`:
- `PORT=5001`
- `MONGO_URI` is overridden to `mongodb://mongo:27017/api-rate-limiter`
- `REDIS_URL` is overridden to `redis://redis:6379`

### 2. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 3. Verify deployment

```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost:8080/health
```

Open app at `http://localhost:8080`.

### 4. Stop deployment

```bash
docker compose -f docker-compose.prod.yml down
```

Add `-v` to also remove Mongo/Redis volumes:

```bash
docker compose -f docker-compose.prod.yml down -v
```

## Deploy Frontend with GitHub Pages (Project Link)

If you want a public project URL directly from GitHub, this repo now includes:
- `.github/workflows/deploy-pages.yml`

After pushing to `main`, frontend deploys automatically to:
- `https://<your-github-username>.github.io/<your-repo-name>/`

### GitHub setup steps

1. Push your latest code to GitHub (`main` branch).
2. In GitHub repo settings, open `Pages` and set `Source` to `GitHub Actions`.
3. In GitHub repo settings, open `Secrets and variables` -> `Actions` -> `Variables`.
4. Add repository variable:
   - `VITE_API_URL` = your backend public URL (example: `https://your-api.onrender.com`)
5. Re-run workflow `Deploy Frontend to GitHub Pages` if needed.

To allow frontend calls from GitHub Pages, set backend `CORS_ORIGIN` to your pages URL:
- `https://<your-github-username>.github.io`

## Deploy Backend on Render

This repo now includes `render.yaml` for Render Blueprint deploy.

### 1. Prepare MongoDB (Atlas)

Render does not provide managed MongoDB in this setup, so create a MongoDB Atlas cluster and copy its connection string.

### 2. Create Render services from Blueprint

1. In Render dashboard, click `New` -> `Blueprint`.
2. Connect this GitHub repo: `https://github.com/Sayantanmaji2005/api-rate-limiter`.
3. Render reads `render.yaml` and creates:
   - `api-rate-limiter-backend` (Node web service)
   - `api-rate-limiter-redis` (Redis)

### 3. Set required backend env vars in Render

In `api-rate-limiter-backend` -> `Environment`, set:
- `JWT_SECRET` = strong random secret
- `MONGO_URI` = your Atlas connection string
- `CORS_ORIGIN` = `https://sayantanmaji2005.github.io`

`REDIS_URL` is auto-wired from the Render Redis service via `render.yaml`.

### 4. Use backend URL in GitHub Pages build

After backend is live, copy its public URL (for example `https://api-rate-limiter-backend.onrender.com`) and set:

GitHub repo -> `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`:
- `VITE_API_URL` = your Render backend URL

Then re-run workflow `Deploy Frontend to GitHub Pages`.

## Backend Environment
Create `backend/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/api-rate-limiter
JWT_SECRET=change_this_secret
REDIS_URL=redis://127.0.0.1:6379
PORT=5001
CORS_ORIGIN=http://localhost:5173
```

## Frontend Environment
Create `frontend/.env` (or copy `frontend/.env.example`):

```env
VITE_API_URL=http://localhost:5001
```

Keep `backend/.env` `PORT` and `frontend/.env` `VITE_API_URL` aligned to the same backend port.

For separate frontend/backend deployments, set `backend/.env` `CORS_ORIGIN` to your frontend URL (comma-separated for multiple origins).

## Core Endpoints

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/rotate-api-key`

### Protected APIs
- `GET /api/data`
- `GET /api/heavy-data`
- `GET /api/analytics`
- `GET /api/analytics/summary`
- `PUT /api/settings/algorithm`
- `PUT /api/settings/rules`
- `DELETE /api/settings/rules`
- `GET /api/limiter-status`

### Admin APIs
- `GET /admin/users`
- `GET /admin/analytics`
- `GET /admin/analytics/summary`
- `PUT /admin/upgrade/:id`
- `PUT /admin/users/:id/algorithm`
- `PUT /admin/users/:id/whitelist`
- `PUT /admin/users/:id/blacklist`

## Health Check
- `GET /health` returns uptime and Mongo/Redis status.

## Validation Commands

```bash
cd backend
npm run check

cd ../frontend
npm run check
```
