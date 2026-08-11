# Test Credentials

## App: BGP Monitor (Next.js + Prisma + PostgreSQL + Redis)

### Superadmin (platform)
- URL: /login
- Username: `admin`
- Password: `admin123`
- Role: superadmin

Notes:
- Auth is JWT (cookie `bgp_session`) via `/api/auth/login`.
- Seeded by env `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` in `/app/.env`.

### Orgadmin (tenant branding demo — MitraNet)
- URL: /login
- Username: `mitraadmin`
- Password: `orgadmin123`
- Role: orgadmin, Tenant: MitraNet (slug `mitra-net`)
- Branding: logo + primary color `#f97316` + monitoring name "MitraNet NOC" (stored in AppSettings). Re-seed with `node scripts/seed-orgadmin-branding.js`.

### In-pod lab router (test double for SSH push/diff)
- Host: 127.0.0.1:2222 (supervisor program `labrouter`, `scripts/lab-router.js`)
- SSH user/pass: `labadmin` / `labpass`
- Seeded device `lab-router-01` (127.0.0.1, cisco) linked to the BGP peers; run `node scripts/seed-lab.js` to re-seed device + live Redis sessions.
