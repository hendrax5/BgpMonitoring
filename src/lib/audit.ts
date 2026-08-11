import { prisma } from '@/lib/prisma';

interface AuditEvent {
    tenantId?: string | null;
    action: 'create' | 'delete' | 'update';
    entityType: 'tenant' | 'user' | 'device' | 'branding';
    entityId?: string | number | null;
    entityLabel?: string | null;
    metadata?: Record<string, any> | null;
}

interface AuditActor {
    userId?: number;
    username?: string;
    role?: string;
    tenantId?: string;
}

/** Records a platform-admin activity entry. Never throws (best-effort). */
export async function logAudit(actor: AuditActor | null | undefined, e: AuditEvent) {
    try {
        await (prisma as any).auditLog.create({
            data: {
                tenantId: e.tenantId ?? actor?.tenantId ?? null,
                actorId: actor?.userId ?? null,
                actorUsername: actor?.username ?? 'system',
                actorRole: actor?.role ?? null,
                action: e.action,
                entityType: e.entityType,
                entityId: e.entityId != null ? String(e.entityId) : null,
                entityLabel: e.entityLabel ?? null,
                metadata: e.metadata ? JSON.stringify(e.metadata) : null,
            },
        });
    } catch (err) {
        console.error('[audit] failed to write log', err);
    }
}
