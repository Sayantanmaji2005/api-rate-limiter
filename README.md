# API Rate Limiter Service (Java)

Production-style API rate limiter with a Java backend and Java-served web UI.

## Features
- JWT auth and API key support
- Tier-based limits (`FREE`, `PRO`, `ENTERPRISE`)
- Algorithm selection (`TOKEN_BUCKET`, `SLIDING_WINDOW`)
- Redis-backed limiting (with memory fallback mode)
- Cost-based endpoint limiting and custom per-endpoint rules
- Circuit breaker fallback for limiter backend failures
- Whitelist/Blacklist management (admin)
- User/Admin analytics dashboard

## Tech Stack
- Backend + UI: Java, Spring Boot, Thymeleaf
- Database: MongoDB
- Cache/Rate-limit store: Redis

## Project Structure
- `backend-java/`: Spring Boot app (API + web pages)
- `.github/workflows/ci.yml`: Java validation pipeline
- `backend-java/VAADIN_OPTION.md`: optional Vaadin route path (Option 2)
- `docker-compose.prod.yml`: Mongo + Redis + Java app

## Run Locally

1. Start Redis
2. Start MongoDB
3. Configure environment in `backend-java/.env`
4. Start the Java app

```bash
cd backend-java
mvn spring-boot:run
```

Open the app at:
- `http://localhost:5001/dashboard`
- Browser opens automatically on startup (configurable).

## Deploy with Docker Compose

This repo includes:
- `backend-java/Dockerfile`
- `docker-compose.prod.yml`

### 1. Prepare environment
Create `backend-java/.env` from `backend-java/.env.example` and set:

```env
JWT_SECRET=replace_with_a_long_random_secret
```

### 2. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 3. Verify deployment

```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost:8080/health
```

Open app at:
- `http://localhost:8080/dashboard`

### 4. Stop deployment

```bash
docker compose -f docker-compose.prod.yml down
```

Remove volumes too:

```bash
docker compose -f docker-compose.prod.yml down -v
```

## Deploy Backend on Render

`render.yaml` is included for Render Blueprint deploy.

### Required env vars
- `JWT_SECRET`
- `MONGO_URI`
- `CORS_ORIGIN` (optional when same-origin only)
- `REDIS_URL` (wired from Render Redis)
- `SPRING_REDIS_URL` (wired from Render Redis)

## Environment

Create `backend-java/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/api-rate-limiter
JWT_SECRET=change_this_secret
REDIS_URL=redis://127.0.0.1:6379
SPRING_REDIS_URL=redis://127.0.0.1:6379
PORT=5001
CORS_ORIGIN=http://localhost:5001
OPEN_BROWSER_ON_STARTUP=true
STARTUP_PAGE=/dashboard
```

Browser auto-open controls:
- `OPEN_BROWSER_ON_STARTUP=true|false`
- `STARTUP_PAGE=/dashboard` (or any app route)

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

### Health
- `GET /health`

## Validation

```bash
cd backend-java
mvn -q test
mvn -q -DskipTests package
```
