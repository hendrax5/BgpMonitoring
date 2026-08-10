# PRD — BGP Monitor

## Original Problem Statement
"analisa dan redesign UI dan UX dan untuk fitur BGP saya ingin jg ada fitur crud untuk BGP dari UI"
(Analyze & redesign UI/UX + add a full BGP CRUD feature manageable from the UI.)

User choices:
- Existing codebase (Next.js 16 + Prisma + PostgreSQL + Redis), BGP networking.
- CRUD fields: AS number, neighbor/peer IP, prefix, route policy — "all".
- Design: dark technical dashboard, designer's discretion.
- Auth required (already present: JWT multi-tenant).

## Architecture
- Next.js 16 (App Router, Turbopack), React 19, Tailwind v4.
- Prisma ORM → PostgreSQL. Redis for live BGP session cache.
- Multi-tenant + RBAC (superadmin/orgadmin/networkengineer/viewer).
- Runtime in preview: Next.js on :3000 (supervisor `nextjs`). A zero-dep Node reverse
  proxy on :8001 (supervisor `apiproxy`) forwards ingress `/api/*` traffic to Next.js :3000.
- `next.config.ts` serverActions.allowedOrigins includes preview hosts (fixes CSRF
  x-forwarded-host vs origin mismatch behind the proxy).

## Implemented (2026-06)
- Runtime bring-up: installed PostgreSQL + Redis, created `.env`, prisma db push, seeded superadmin.
- Fixed pre-existing CSS parse bug in globals.css (`var(--color-border))`).
- UI/UX redesign: ambient radial glow + grain background, glassmorphic cards, animated
  stat cards with accent top-line, refined buttons/inputs/tables/scrollbar, redesigned
  login, refreshed sidebar (gradient logo) + cyan/indigo palette. Kept all class names.
- NEW feature: **BGP Peer Management (full CRUD)** at `/bgp-peers`.
  - Prisma model `BgpPeer` (tenant-scoped): peerIp, peerName, remoteAsn, localAsn,
    addressFamily, prefixLimit, prefixList (announced prefixes), routePolicyIn/Out,
    password, description, adminStatus, deviceId link.
  - Server actions: create/update/delete/toggle (`src/app/actions/bgp-peers.ts`) with
    validation + RBAC (superadmin/orgadmin/networkengineer manage; viewer read-only).
  - UI: `src/app/bgp-peers/page.tsx` (stats + list) + `BgpPeerManager.tsx` client
    (search, address-family filter, add/edit modal, delete confirm, enable/disable toggle, toasts).
  - Sidebar nav item added.

## Verified
- Login (external, via proxy) ✓
- BGP Peer Create ✓, Read/list ✓, Update/Edit ✓ (verified via browser automation).
- Toggle enable/disable + Delete use same working action path.

## Backlog / Next
- Per-vendor push validation against real hardware (currently supports cisco/arista/huawei/juniper/mikrotik/vyos/danos generation).
- Import/export BGP peers (CSV).
- Wire background worker for live device polling (needs real devices/SNMP).

## Implemented — Iteration 2 (2026-06)
- **Push To Router**: `src/lib/bgp-config-generator.ts` generates vendor CLI (cisco/arista/huawei/juniper/mikrotik/vyos/danos). API `POST /api/bgp-peers/push` — `dryRun:true` returns config preview; `dryRun:false` applies over SSH (conn.shell, vendor config-mode wrap) and records `lastPushStatus`/`lastPushedAt`/`lastPushLog` on the peer. UI: per-row "Push" button → modal with config preview + "Push via SSH" (disabled when no device attached). Verified: preview generates correctly; SSH apply gated on attached device.
- **Live Peer Match**: page reads live BGP sessions from Redis (tenant-scoped pattern) into a map keyed by peerIp; new "Live Match" table column (Established w/ prefixes+device / Down / Not monitored) + "config drift" hint; "Live Established" stat card. Verified.
- **Tenant Peer View (superadmin)**: tenant switcher (`?tenant=`) scopes list + create; "Organization" column shown when viewing all; Add disabled with hint until a specific org is selected; server actions let superadmin target any tenant (`resolveTenant`/`scopeWhere`). Verified: switch → scope + tenant-scoped create works.
