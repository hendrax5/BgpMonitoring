import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await requireSession();
    if (!session.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const where: any = {};
    if (session.role !== 'superadmin') where.tenantId = session.tenantId;

    const runs = await (prisma as any).complianceRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
    });

    return NextResponse.json({
        runs: runs.reverse().map((r: any) => ({
            id: r.id,
            at: r.createdAt.toISOString(),
            deviceCount: r.deviceCount,
            compliant: r.compliant,
            nonCompliant: r.nonCompliant,
            noBackup: r.noBackup,
            policiesEvaluated: r.policiesEvaluated,
        })),
    });
}
