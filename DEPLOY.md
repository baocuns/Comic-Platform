# Deployment Guide

## Prerequisites
- Node.js 20+, pnpm 9+
- PostgreSQL (Neon), Redis (Upstash), Cloudflare R2

## Local Development

```bash
# Install
pnpm install

# Start API (http://localhost:4000)
cd apps/api && npx nest start --watch

# Start Web (http://localhost:3000)
cd apps/web && pnpm dev
```

## Environment Variables

### Backend (.env at root)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=<random-64-char>
JWT_REFRESH_SECRET=<random-64-char>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=comics-dev
R2_PUBLIC_URL=https://<bucket>.r2.dev
REDIS_URL=<upstash-redis-url>
REDIS_TOKEN=<upstash-redis-token>
APP_URL=http://localhost:3000
```

### Frontend (apps/web/.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/v1
```

## Deploy to Production

### Backend → Railway
1. Create Railway project, link GitHub repo
2. Set root directory: `/` (the root of the repository)
3. Build: `pnpm install && pnpm --filter api build`
4. Start: `node apps/api/dist/src/main.js`
5. Add all env vars from above

### Frontend → Vercel
1. Import GitHub repo to Vercel
2. Set root directory: `apps/web`
3. Framework: Next.js
4. Set `NEXT_PUBLIC_API_URL` to your Railway API URL

### CI/CD (GitHub Actions)
Add these secrets to your repo:
- `RAILWAY_TOKEN` — from Railway dashboard
- `VERCEL_TOKEN` — from Vercel settings
- `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` — from `.vercel/project.json`

Pipeline runs automatically on push to `main`.
