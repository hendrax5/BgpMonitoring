import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ACTION_META: Record<string, { cls: string; color: string; icon: string }> = {
    create: { cls: 'badge-established', color: '#34d399', icon: 'add_circle' },
    update: { cls: 'badge-warning', color: '#fbbf24', icon: 'edit' },
    delete: { cls: 'badge-down', color: '#fb7185', icon: 'delete' },
};
const ENTITY_ICON: Record<string, string> = { tenant: 'corporate_fare', user: 'person', device: 'dns', branding: 'palette' };

function fmtWhen(d: Date): string {
    // Deterministic (server-rendered only) UTC timestamp.
    return d.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; action?: string }> }) {
    const session = await requireSession();
    if (session.role !== 'superadmin') redirect('/');
    const sp = await searchParams;
    const q = (sp.q || '').trim();
    const type = sp.type || '';
    const action = sp.action || '';

    const where: any = {};
    if (type) where.entityType = type;
    if (action) where.action = action;
    if (q) where.OR = [
        { entityLabel: { contains: q, mode: 'insensitive' } },
        { actorUsername: { contains: q, mode: 'insensitive' } },
    ];

    const logs = await (prisma as any).auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 250 });
    const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
    const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name]));

    const total = await (prisma as any).auditLog.count();

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b glass" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                    <div className="flex items-center gap-2 text-xs mb-0.5">
                        <Link href="/admin" style={{ color: '#fbbf24' }} className="font-bold uppercase tracking-wider hover:text-white">Admin</Link>
                        <span style={{ color: '#475569' }}>/</span>
                        <span className="text-white">Audit Log</span>
                    </div>
                    <h2 className="text-white font-bold text-base">Activity Trail</h2>
                </div>
                <Link href="/admin" className="btn-ghost text-xs">← Back to Admin</Link>
            </header>

            <main className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Audit Log</h1>
                        <p className="text-sm mt-1" style={{ color: '#64748b' }}>Who created, updated or deleted tenants, users and devices — {total} total events.</p>
                    </div>
                </div>

                {/* Filters */}
                <form method="get" className="card p-4 flex flex-col sm:flex-row gap-3" data-testid="audit-filters">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#475569' }}>search</span>
                        <input name="q" defaultValue={q} placeholder="Search actor or entity…" className="form-input" style={{ paddingLeft: '2.4rem' }} data-testid="audit-search" />
                    </div>
                    <select name="type" defaultValue={type} className="form-select" style={{ maxWidth: '11rem' }} data-testid="audit-filter-type">
                        <option value="">All Entities</option>
                        <option value="tenant">Tenant</option>
                        <option value="user">User</option>
                        <option value="device">Device</option>
                        <option value="branding">Branding</option>
                    </select>
                    <select name="action" defaultValue={action} className="form-select" style={{ maxWidth: '10rem' }} data-testid="audit-filter-action">
                        <option value="">All Actions</option>
                        <option value="create">Create</option>
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                    </select>
                    <button type="submit" className="btn-primary" data-testid="audit-apply">
                        <span className="material-symbols-outlined text-base">filter_alt</span> Apply
                    </button>
                    {(q || type || action) && (
                        <Link href="/admin/audit" className="btn-ghost" data-testid="audit-clear">Clear</Link>
                    )}
                </form>

                {/* Table */}
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full data-table" data-testid="audit-table">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>Actor</th>
                                    <th>Action</th>
                                    <th>Entity</th>
                                    <th>Target</th>
                                    <th>Organization</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem' }}>
                                        <span className="material-symbols-outlined text-4xl block mb-3" style={{ color: '#334155' }}>history</span>
                                        <p className="text-white font-medium">No activity recorded yet</p>
                                        <p className="text-xs mt-1" style={{ color: '#475569' }}>Tenant, user and device changes will appear here.</p>
                                    </td></tr>
                                ) : logs.map((l: any) => {
                                    const am = ACTION_META[l.action] || ACTION_META.update;
                                    return (
                                        <tr key={l.id} data-testid={`audit-row-${l.id}`}>
                                            <td><span className="font-mono text-xs" style={{ color: '#94a3b8' }}>{fmtWhen(new Date(l.createdAt))}</span></td>
                                            <td>
                                                <div className="flex flex-col">
                                                    <span className="text-white text-sm font-semibold">{l.actorUsername}</span>
                                                    {l.actorRole && <span className="text-[11px]" style={{ color: '#475569' }}>{l.actorRole}</span>}
                                                </div>
                                            </td>
                                            <td><span className={am.cls}><span className="material-symbols-outlined text-sm">{am.icon}</span>{l.action}</span></td>
                                            <td>
                                                <span className="inline-flex items-center gap-1.5 text-xs capitalize" style={{ color: '#a5b4c8' }}>
                                                    <span className="material-symbols-outlined text-base" style={{ color: '#64748b' }}>{ENTITY_ICON[l.entityType] || 'category'}</span>
                                                    {l.entityType}
                                                </span>
                                            </td>
                                            <td><span className="text-sm text-white">{l.entityLabel || '—'}</span></td>
                                            <td><span className="text-xs" style={{ color: '#64748b' }}>{l.tenantId ? (tenantMap[l.tenantId] || l.tenantId.slice(0, 8)) : '—'}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-5 py-3 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: '#64748b' }}>
                        Showing {logs.length} most recent event{logs.length !== 1 ? 's' : ''}{(q || type || action) ? ' (filtered)' : ''}
                    </div>
                </div>
            </main>
        </div>
    );
}
