# 🚀 Deployment Guide – Comic Reading Platform

> **Phiên bản**: 1.0  
> **Environments**: Development → Staging → Production  
> **Cập nhật**: 2026-02-10

---

## 1. Tổng quan Environments

| Environment | Mục đích | URL | Branch |
|------------|----------|-----|--------|
| **Development** | Local dev, testing | `localhost:3000` / `localhost:4000` | `feature/*` |
| **Staging** | Pre-production testing | `staging.comicplatform.vn` | `develop` |
| **Production** | Live | `comicplatform.vn` | `main` |

---

## 2. Infrastructure Map

```
┌───────────────────────────────────────────────────────┐
│                   PRODUCTION                           │
│                                                        │
│  ┌──────────────────┐   ┌──────────────────┐          │
│  │     Vercel        │   │    Railway        │          │
│  │  ┌──────────────┐ │   │  ┌──────────────┐ │          │
│  │  │  Next.js      │ │   │  │    NestJS     │ │          │
│  │  │  Frontend     │ │   │  │    Backend    │ │          │
│  │  └──────────────┘ │   │  └──────────────┘ │          │
│  └──────────────────┘   │  ┌──────────────┐ │          │
│                          │  │  PostgreSQL   │ │          │
│  ┌──────────────────┐   │  └──────────────┘ │          │
│  │   Cloudflare      │   │  ┌──────────────┐ │          │
│  │  ┌──────────────┐ │   │  │    Redis      │ │          │
│  │  │  CDN + DNS    │ │   │  └──────────────┘ │          │
│  │  │  R2 Storage   │ │   └──────────────────┘          │
│  │  │  WAF          │ │                                 │
│  │  └──────────────┘ │   ┌──────────────────┐          │
│  └──────────────────┘   │   Meilisearch      │          │
│                          │   (Railway/Cloud)  │          │
│                          └──────────────────┘          │
└───────────────────────────────────────────────────────┘
```

---

## 3. Local Development Setup

### 3.1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS | https://nodejs.org |
| pnpm | 8+ | `npm install -g pnpm` |
| Docker | Latest | https://docker.com |
| Git | Latest | https://git-scm.com |

### 3.2. Cài đặt lần đầu

```bash
# 1. Clone repository
git clone https://github.com/your-org/comic-platform.git
cd comic-platform

# 2. Install dependencies
pnpm install

# 3. Setup environment variables
cp .env.example .env.local
# Sửa file .env.local theo hướng dẫn bên dưới

# 4. Start databases với Docker
docker compose up -d postgres redis meilisearch

# 5. Run database migrations
pnpm prisma migrate dev

# 6. Seed database
pnpm prisma db seed

# 7. Start development servers
pnpm dev          # Frontend (Next.js) → localhost:3000
pnpm dev:api      # Backend (NestJS) → localhost:4000
```

### 3.3. Docker Compose (Local)

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: comic_dev
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: comic_platform
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

  meilisearch:
    image: getmeili/meilisearch:v1.6
    ports:
      - "7700:7700"
    environment:
      MEILI_MASTER_KEY: dev_master_key
    volumes:
      - meili_data:/meili_data

volumes:
  postgres_data:
  meili_data:
```

### 3.4. Environment Variables

```env
# .env.local (Development)

# ── App ──
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000

# ── Database ──
DATABASE_URL=postgresql://comic_dev:dev_password@localhost:5432/comic_platform

# ── Redis ──
REDIS_URL=redis://localhost:6379

# ── Auth ──
JWT_SECRET=your-dev-jwt-secret-at-least-32-chars
JWT_REFRESH_SECRET=your-dev-refresh-secret-at-least-32-chars
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# ── OAuth ──
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ── Storage (R2) ──
R2_ACCOUNT_ID=your-cf-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_BUCKET_NAME=comics-dev
CDN_URL=https://cdn-dev.comicplatform.vn

# ── Search ──
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=dev_master_key

# ── AI (Optional for dev) ──
OPENAI_API_KEY=sk-your-openai-key

# ── Monitoring ──
SENTRY_DSN=https://your-sentry-dsn
```

---

## 4. CI/CD Pipeline (GitHub Actions)

### 4.1. Pipeline Overview

```mermaid
graph LR
    subgraph PR["Pull Request"]
        A["Push to feature/*"] --> B["Lint + Type Check"]
        B --> C["Unit Tests"]
        C --> D["Build Check"]
        D --> E["Preview Deploy<br/>(Vercel)"]
    end

    subgraph Staging["Staging"]
        F["Merge to develop"] --> G["Lint + Tests"]
        G --> H["Build"]
        H --> I["Deploy Staging"]
        I --> J["E2E Tests"]
    end

    subgraph Prod["Production"]
        K["Merge to main"] --> L["Full Test Suite"]
        L --> M["Build"]
        M --> N["DB Migration"]
        N --> O["Deploy Production"]
        O --> P["Smoke Tests"]
        P --> Q["Monitor 30min"]
        Q -->|Issues| R["Auto Rollback"]
    end
```

### 4.2. GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test

  build:
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway (Staging)
        # Railway auto-deploys from branch

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Run DB Migrations
        run: pnpm prisma migrate deploy
      - name: Deploy to Railway (Production)
        # Railway auto-deploys from main
```

### 4.3. Vercel Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "regions": ["sin1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

---

## 5. Database Management

### 5.1. Migration Workflow

```mermaid
graph TD
    A["Create migration locally"] --> B["Test on local DB"]
    B --> C["Commit migration file"]
    C --> D["PR Review"]
    D --> E["Auto-run on Staging"]
    E --> F["Verify data integrity"]
    F --> G["Merge to main"]
    G --> H["Auto-run on Production<br/>(prisma migrate deploy)"]
```

### 5.2. Backup Strategy

| Environment | Frequency | Retention | Method |
|------------|-----------|-----------|--------|
| Production | Every 6 hours | 30 days | Railway auto-backup |
| Production | Daily | 90 days | Manual pg_dump to R2 |
| Staging | Daily | 7 days | Railway auto-backup |

### 5.3. Disaster Recovery

```
Recovery Point Objective (RPO): 6 hours
Recovery Time Objective (RTO): 1 hour

Steps:
1. Identify issue
2. Railway → restore from backup
3. Verify data integrity
4. Update DNS if needed
5. Monitor
```

---

## 6. Deployment Checklist

### 6.1. Pre-deployment ✅

- [ ] Tất cả tests pass
- [ ] Code review approved
- [ ] Database migration tested trên staging
- [ ] Environment variables đã set đúng
- [ ] Không có console.log / debug code
- [ ] Performance audit passed
- [ ] Security audit (nếu có thay đổi auth)

### 6.2. Deployment Steps ✅

- [ ] Backup production database
- [ ] Run migration trên production
- [ ] Deploy backend (Railway)
- [ ] Deploy frontend (Vercel)
- [ ] Verify health check endpoints
- [ ] Test critical user flows
- [ ] Check error rates trên Sentry

### 6.3. Post-deployment ✅

- [ ] Monitor error rates (30 min)
- [ ] Check performance metrics
- [ ] Verify CDN cache working
- [ ] Announce release notes (nếu có features mới)

---

## 7. Rollback Procedures

### 7.1. Frontend Rollback (Vercel)

```bash
# Vercel hỗ trợ instant rollback
# 1. Go to Vercel Dashboard → Deployments
# 2. Find previous stable deployment
# 3. Click "..." → "Promote to Production"
# Hoặc dùng CLI:
vercel rollback
```

### 7.2. Backend Rollback (Railway)

```bash
# Railway tự động giữ previous deployments
# 1. Go to Railway Dashboard → Service
# 2. Go to Deployments tab
# 3. Click on previous stable deployment
# 4. Click "Redeploy"
```

### 7.3. Database Rollback

```bash
# ⚠️ CẨN THẬN: Chỉ khi thực sự cần thiết

# Option 1: Revert migration (nếu có down migration)
npx prisma migrate resolve --rolled-back <migration-name>

# Option 2: Restore from backup
# Railway Dashboard → Database → Backups → Restore
```

---

## 8. Monitoring & Alerts

### 8.1. Health Check Endpoints

| Endpoint | Check |
|----------|-------|
| `GET /health` | Basic API alive |
| `GET /health/db` | Database connection |
| `GET /health/redis` | Redis connection |
| `GET /health/search` | Meilisearch connection |

### 8.2. Alert Rules

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error rate | > 1% | > 5% | Check Sentry, rollback nếu cần |
| Response time (p95) | > 1s | > 3s | Check slow queries, scale up |
| CPU usage | > 70% | > 90% | Scale up |
| Memory usage | > 70% | > 90% | Check memory leaks, restart |
| Disk usage | > 70% | > 90% | Cleanup, expand storage |
| Uptime | < 99.9% | < 99% | Investigate root cause |

### 8.3. On-call Procedures

```
Alert received
    │
    ├── Severity: LOW → Review during business hours
    ├── Severity: MEDIUM → Respond within 1 hour
    └── Severity: HIGH → Respond within 15 minutes
         │
         ├── 1. Check Sentry for errors
         ├── 2. Check Railway logs
         ├── 3. Check Cloudflare analytics
         ├── 4. If deployment-related → Rollback
         └── 5. Document incident
```

---

## 9. Scaling Guide

### 9.1. When to Scale

| Signal | Action |
|--------|--------|
| Response time p95 > 2s consistently | Scale API instances |
| DB CPU > 80% | Add read replicas |
| Redis memory > 80% | Scale Redis or optimize keys |
| CDN cache hit < 80% | Review cache rules |
| Upload queue > 100 jobs pending | Add more workers |

### 9.2. Railway Scaling

```bash
# Horizontal scaling (multiple instances)
# Railway Dashboard → Service → Settings → Replicas

# Vertical scaling (more resources)
# Railway Dashboard → Service → Settings → Resources
#   CPU: 1-8 vCPU
#   Memory: 512MB - 8GB
```
