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

## Implemented — Iteration 3 (2026-06)
- **Attach Device + real end-to-end SSH push**: peers link to a `RouterDevice` (with SSH credential); Push modal "Push via SSH" connects over SSH (ssh2 shell), runs vendor config-mode commands, captures output, and records `lastPushStatus`/`lastPushLog` (row shows a "Pushed" badge). Devices can be attached directly from the Push modal (`attachDeviceToPeer`). Verified end-to-end against an in-pod fake router.
- **Config Diff**: Push modal "Diff vs Router" tab fetches the device's running BGP config over SSH (vendor show command) and renders a diff (react-diff-viewer-continued) vs the generated config.
- **Auto Drift Alerts**: page flags peers that are `enabled` but whose live session is not `Established` — red dismissible banner listing drifted peers, a "Config Drift" stat card, and a per-row "⚠ config drift" hint.
- Test harness: `scripts/lab-router.js` (ssh2 fake router @127.0.0.1:2222, supervisor `labrouter`) + `scripts/seed-lab.js` seed a device linked to peers and live Redis sessions so Push/Diff/Drift/Live-Match are demonstrable. Lab creds: labadmin/labpass.

## Verified — Iteration 3
- Testing agent: 18/18 frontend checks PASS; `/api/bgp-peers/push` preview+diff+apply all 200 OK via real SSH. CRUD regression + dashboard OK.

## Implemented — Iteration 4 (2026-06): Config Management + Platform Admin redesign
- Re-themed the off-brand (blue/zinc) **Config Management** to the cyan/indigo glass SaaS system: glass sticky header + breadcrumb + role badge, segmented tab control (`.seg-tabs`), `stat-card` metrics + "Trigger Backup Now", and a fully rebranded **Compliance Policies** table + create/edit modal (design-system inputs/buttons). Files: `config-management/page.tsx`, `components/ConfigDashboard.tsx`, `ConfigPolicies.tsx`, `ConfigDevices.tsx`.
- Refreshed **Platform Admin** surfaces to match: `admin/page.tsx` (glass header + UserProfileDropdown, cyan/indigo `stat-card`s, branded create-tenant + tenants table), `admin/settings/page.tsx`, `admin/devices/page.tsx`, `admin/tenants/[tenantId]/page.tsx` (section icons, add/delete device+user, branding form, role/plan badges → brand tokens).
- Added CSS utilities: `.seg-tabs/.seg-tab`, `.animate-fade-in-up`, `.scrollbar-hide`, `.section-head`.
- **Resilience**: added `scripts/bootstrap.sh` + `bootstrap` supervisor program (idempotent) that starts Redis/PostgreSQL, ensures DB + schema, and re-seeds superadmin (`scripts/seed-superadmin.js`) + lab data on container restart. Verified after a container reset wiped Postgres/Redis.

## Verified — Iteration 4
- Testing agent: 100% (20/20) frontend checks PASS. Policy CRUD, tenant create, tenant detail (device/user/branding), device assignment, platform settings save, plus / and /bgp-peers regressions — all pass. No functional issues in redesigned pages.

## Implemented — Iteration 5 (2026-06)
- **Bug fix (Overview dashboard console)**: fixed SSR hydration mismatch on "Since:" timestamps (deterministic `fmtDate` + `suppressHydrationWarning` on the uptime cell) and duplicate React keys on the sessions table (row key now includes index). Verified: 0 hydration / 0 duplicate-key warnings.
- **Policy Templates**: `ConfigPolicies` gains a "Quick Templates" panel with 6 one-click hardening presets (No Telnet, SSH Enabled, NTP, No Default SNMP, Password Encryption, Central Logging) — enabling creates the policy and flips the button to "Enabled".
- **Tenant Branding Preview**: new client `BrandingForm` on the tenant detail page with a live sidebar preview that updates instantly as you type name/monitoring and pick a primary color; added `logo_url` + `primary_color` branding fields (stored in AppSettings).
- **Admin Audit Log**: new `AuditLog` Prisma model + `lib/audit.ts`; write events on tenant create/delete, user create/delete, device create/delete, and branding update. New searchable/filterable page `/admin/audit` (+ sidebar link).

## Verified — Iteration 5
- Testing agent: 100% (17/17). Bug fix confirmed fixed; templates, branding live-preview + persistence, and audit create/update/delete + search/filters all pass. No regressions.

## Implemented — Iteration 6 (2026-06)
- **Policy Scan Now**: on-demand compliance scan — API `POST /api/config-management/scan` re-evaluates each device's latest stored config backup against all active `CompliancePolicy` rules (vendor-aware, regex must-match/forbidden), updates `DeviceConfigBackup.isCompliant`/`complianceLog`, and returns per-device violations + counts. UI: "Run Compliance Scan" button on the Config Management dashboard with a rich result panel; stat cards refresh to match.
- **Dashboard Add Device (PRTG-style UX)**: `QuickAddDevice` modal + `addDeviceQuick` server action let any manage-role user (superadmin/orgadmin/networkengineer) add a device straight from the main Overview header (hidden for viewers). Supports hostname/IP/vendor/poll-method/SNMP + optional SSH creds; superadmin picks the org; duplicates & invalid IP handled; writes an AuditLog entry. Platform-admin-only items remain in the sidebar's "Platform Admin" section — role difference stays in that menu, day-to-day device management is unified in the main UI.

## Verified — Iteration 6
- Testing agent: 100% (13/13 UI + backend code-verified + live scan). Add-device happy path, invalid IP, duplicate constraint, required-tenant validation, and scan result/stat-sync all pass. No regressions.

## Backlog / Next
- Surface `lastPushLog` via tooltip on "Push failed" badge.
- Per-vendor push validation against real hardware.
- Import/export BGP peers (CSV).
- Optional: split BgpPeerManager modals into sub-components (~690 lines).

## Implemented — Iteration 2 (2026-06)
- **Push To Router**: `src/lib/bgp-config-generator.ts` generates vendor CLI (cisco/arista/huawei/juniper/mikrotik/vyos/danos). API `POST /api/bgp-peers/push` — `dryRun:true` returns config preview; `dryRun:false` applies over SSH (conn.shell, vendor config-mode wrap) and records `lastPushStatus`/`lastPushedAt`/`lastPushLog` on the peer. UI: per-row "Push" button → modal with config preview + "Push via SSH" (disabled when no device attached). Verified: preview generates correctly; SSH apply gated on attached device.
- **Live Peer Match**: page reads live BGP sessions from Redis (tenant-scoped pattern) into a map keyed by peerIp; new "Live Match" table column (Established w/ prefixes+device / Down / Not monitored) + "config drift" hint; "Live Established" stat card. Verified.
- **Tenant Peer View (superadmin)**: tenant switcher (`?tenant=`) scopes list + create; "Organization" column shown when viewing all; Add disabled with hint until a specific org is selected; server actions let superadmin target any tenant (`resolveTenant`/`scopeWhere`). Verified: switch → scope + tenant-scoped create works.
