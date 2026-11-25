# Leo Analytics

Self-hosted, cookieless, fingerprint-free web analytics built with **React**, **Tailwind CSS** (*Instrument Serif* + *Instrument Sans*), **Node.js 26**, **TypeScript**, and **SQLite** (WAL mode).

- Unlimited websites from one dashboard
- Zero cookies, zero `localStorage`, zero browser fingerprinting (daily rotating SHA-256 salt; raw IPs are never persisted)
- Unique visitors, visits, pageviews, views/visit, bounce rate, visit duration, live visitors
- Channels, referrers, UTM campaigns, top/entry/exit pages, countries (offline `geoip-lite` + CDN header support), browsers, OS, and devices
- Lightweight `< 1.2 KB` tracking script with SPA support (`/js/script.js`)
- Locked by default until an admin account is created via CLI

---

## Requirements

- **Node.js 26+** (`.nvmrc` is included for Laravel Herd / nvm)
- **pnpm** (`corepack enable` or `npm i -g pnpm`)

---

## Local Development

```bash
pnpm install
pnpm create-admin    # Required to unlock the dashboard
pnpm dev             # API on :3001, Vite UI on :5173
```

Optional: populate 3 sample websites with 35 days of demo traffic:

```bash
pnpm seed
```

To wipe local data and start fresh:

```bash
rm -rf data
pnpm create-admin
```

---

## Production Deployment on Laravel Forge (Zero-Downtime)

### 1. Shared Paths

Because SQLite runs in **WAL mode**, it writes three sibling files (`analytics.db`, `analytics.db-wal`, `analytics.db-shm`). Always share the **directory**, not just the `.db` file.

In Forge → **Site → Deployments → Shared Paths**, add:

- `data` (recommended — matches the default `data/analytics.db` path with zero extra config)

*(Alternatively, if you prefer Forge's `storage` directory, add `storage` as a shared path and set `DATABASE_PATH=/home/forge/analytics.yourdomain.com/current/storage/analytics.db` in `.env`.)*

Forge automatically shares `.env` across releases.

### 2. Environment File (`.env`)

In Forge → **Site → Environment**, configure:

```env
NODE_ENV=production
PORT=3001
# Optional if sharing `storage` instead of `data`:
# DATABASE_PATH=/home/forge/analytics.yourdomain.com/current/storage/analytics.db
```

### 3. Deployment Script

In Forge → **Site → Deployments → Deploy Script**:

```bash
$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

pnpm install --frozen-lockfile
pnpm build

$ACTIVATE_RELEASE()

# Replace daemon-XXXXXXX with your Forge Background Process ID
sudo supervisorctl restart daemon-XXXXXXX:*
```

*(Ensure Node 26 and `pnpm` are installed on the server, e.g. via `nvm` or NodeSource + `corepack enable`.)*

### 4. Background Process (Daemon)

In Forge → **Server → Daemons** (or **Site → Background Processes**), create a daemon:

- **Command**: `node /home/forge/analytics.yourdomain.com/current/server/dist/index.js`
- **User**: `forge` (or your site's isolated user)
- **Directory**: `/home/forge/analytics.yourdomain.com/current`

Equivalent Supervisor config:

```ini
[program:daemon-XXXXXXX]
directory=/home/forge/analytics.yourdomain.com/current/
command=node /home/forge/analytics.yourdomain.com/current/server/dist/index.js
process_name=%(program_name)s_%(process_num)02d
autostart=true
autorestart=true
user=forge
numprocs=1
redirect_stderr=true
stdout_logfile=/home/forge/.forge/daemon-XXXXXXX.log
stdout_logfile_maxbytes=5MB
stdout_logfile_backups=3
stopwaitsecs=15
stopasgroup=true
killasgroup=true
```

### 5. Nginx Reverse Proxy

In Forge → **Site → Nginx Configuration**, proxy requests to `127.0.0.1:3001` and forward client IPs so offline country lookup works accurately:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Enable SSL (Let's Encrypt / Cloudflare) — in production (`NODE_ENV=production`), auth cookies use `Secure: true`.

### 6. First-Run Admin Setup (SSH)

Until you create an admin user, the dashboard stays locked. After your first deployment, SSH into the server and run:

```bash
cd /home/forge/analytics.yourdomain.com/current
pnpm create-admin
```

*(You can also run it non-interactively: `pnpm create-admin --email you@domain.com --password your-strong-password`.)*

Because `data/` (or `storage/`) is a shared path, your admin account, registered sites, and analytics database will persist across all future zero-downtime deployments.

---

## Installing the Tracker on Your Websites

Add one script tag inside `<head>` on any website you register in the dashboard:

```html
<script defer data-domain="example.com" src="https://analytics.yourdomain.com/js/script.js"></script>
```
