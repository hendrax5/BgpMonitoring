import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const session = await requireSession();
        if (!session.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Ambil semua device untuk tenant
        const devices = await prisma.routerDevice.findMany({
            where: { tenantId: session.tenantId },
            include: {
                configBackups: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        // Format hasil
        const result = devices.map(d => {
            const lastBackup = d.configBackups[0];
            return {
                id: d.id,
                hostname: d.hostname,
                ipAddress: d.ipAddress,
                vendor: d.vendor,
                lastBackupDate: lastBackup ? lastBackup.createdAt : null,
                isCompliant: lastBackup ? lastBackup.isCompliant : null,
                latestBackupId: lastBackup ? lastBackup.id : null
            };
        });

        return NextResponse.json({ devices: result }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
