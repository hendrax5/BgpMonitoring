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
