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

## Backend Environment
Create `backend/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/api-rate-limiter
JWT_SECRET=change_this_secret
REDIS_URL=redis://127.0.0.1:6379
PORT=5001
```

## Frontend Environment
Create `frontend/.env` (or copy `frontend/.env.example`):

```env
VITE_API_URL=http://localhost:5001
```

Keep `backend/.env` `PORT` and `frontend/.env` `VITE_API_URL` aligned to the same backend port.

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
