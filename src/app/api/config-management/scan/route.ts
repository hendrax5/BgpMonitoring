import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MANAGE_ROLES = ['superadmin', 'orgadmin', 'networkengineer'];

// On-demand compliance scan: re-evaluate each device's LATEST stored config
// backup against all currently-enabled compliance policies (no device fetch).
export async function POST(req: NextRequest) {
    const session = await requireSession();
    if (!session.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!MANAGE_ROLES.includes(session.role)) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const requestedTenant = req.nextUrl.searchParams.get('tenantId');
    const where: any = {};
    if (session.role === 'superadmin') {
        if (requestedTenant && requestedTenant !== 'all') where.tenantId = requestedTenant;
    } else {
        where.tenantId = session.tenantId;
    }

    const policies = await (prisma as any).compliancePolicy.findMany({ where: { isActive: true } });

    const devices = await prisma.routerDevice.findMany({
        where,
        include: { configBackups: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    let compliant = 0, nonCompliant = 0, noBackup = 0;
    const violations: { hostname: string; messages: string[] }[] = [];

    for (const d of devices) {
        const backup = d.configBackups[0];
        if (!backup) { noBackup++; continue; }

        const cfg = backup.configText || '';
        let isCompliant = true;
        const msgs: string[] = [];

        for (const p of policies) {
            const target = p.vendorMatch.toLowerCase();
            if (target !== 'all' && target !== d.vendor.toLowerCase()) continue;
            try {
                const matched = new RegExp(p.regexPattern, 'im').test(cfg);
                if (p.mustMatch && !matched) {
                    isCompliant = false;
                    msgs.push(`[${p.severity.toUpperCase()}] "${p.name}" — missing required pattern: ${p.regexPattern}`);
                } else if (!p.mustMatch && matched) {
                    isCompliant = false;
                    msgs.push(`[${p.severity.toUpperCase()}] "${p.name}" — found forbidden pattern: ${p.regexPattern}`);
                }
            } catch {
                msgs.push(`ERROR: invalid regex in policy "${p.name}"`);
            }
        }

        await (prisma as any).deviceConfigBackup.update({
            where: { id: backup.id },
            data: { isCompliant, complianceLog: msgs.join('\n') },
        });

        if (isCompliant) compliant++;
        else { nonCompliant++; violations.push({ hostname: d.hostname, messages: msgs }); }
    }

    const runTenant = session.role === 'superadmin' ? (requestedTenant && requestedTenant !== 'all' ? requestedTenant : null) : session.tenantId;
    await (prisma as any).complianceRun.create({
        data: { tenantId: runTenant, deviceCount: devices.length, compliant, nonCompliant, noBackup, policiesEvaluated: policies.length },
    });

    return NextResponse.json({
        scanned: devices.length,
        policiesEvaluated: policies.length,
        compliant,
        nonCompliant,
        noBackup,
        violations,
    });
}
