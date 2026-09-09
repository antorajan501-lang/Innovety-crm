# Production Deployment Checklist & Verification Guide

Follow this step-by-step checklist to deploy the backend fixes and resolve 502 Bad Gateway issues on `https://crm.innoveity.tech`.

---

## 1. SSH into the Production VPS Server

Connect to your server:
```bash
ssh user@crm.innoveity.tech
```

Navigate to your application root directory:
```bash
cd /path/to/MRF-crm
```

---

## 2. Execute Deployment Commands

Run the standard deployment sequence:

```bash
# 1. Pull the latest backend fixes from git repository
git pull

# 2. Install any new dependencies (if applicable)
npm install

# 3. Regenerate Prisma Client
npx prisma generate

# 4. Apply Prisma database schema migrations cleanly without data loss
npx prisma migrate deploy

# 5. Seed initial multi-tenant organizations and accounts
npx prisma db seed

# 6. Restart PM2 node application processes
pm2 restart all

# 6. Check PM2 logs to verify clean startup and database connection
pm2 logs --lines 50

# 7. Test Nginx reverse proxy configuration syntax
sudo nginx -t

# 8. Reload Nginx configuration cleanly
sudo systemctl reload nginx
```

---

## 3. Recommended Nginx Reverse Proxy Configuration

Ensure `/etc/nginx/sites-available/innoveity-crm` or `/etc/nginx/conf.d/crm.conf` includes:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

---

## 4. Production Health Verification

Run these verification commands directly on the server or from any terminal:

```bash
# 1. Verify health probe endpoint (Expect HTTP 200: {"status":"healthy"})
curl https://crm.innoveity.tech/api/health

# 2. Verify platform settings endpoint (Expect HTTP 200 OK)
curl https://crm.innoveity.tech/api/platform/settings

# 3. Verify organizations endpoint (Expect HTTP 200 OK)
curl https://crm.innoveity.tech/api/organizations
```

---

## 5. Environment Variables Audit (`.env`)

Ensure your production `backend/.env` file contains:

```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/mrf_crm?schema=public"
JWT_SECRET="your_secure_jwt_secret_here"
JWT_REFRESH_SECRET="your_secure_refresh_secret_here"
NODE_ENV="production"
FRONTEND_URL="https://crm.innoveity.tech"
```
