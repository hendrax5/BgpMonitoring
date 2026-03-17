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

        const url = new URL(req.url);
        const deviceIdParam = url.searchParams.get('deviceId');
        
        if (!deviceIdParam) {
            return NextResponse.json({ error: 'Missing deviceId parameter' }, { status: 400 });
        }
        
        const deviceId = parseInt(deviceIdParam, 10);

        // Validasi kepemilikan
        const device = await prisma.routerDevice.findFirst({
            where: { id: deviceId, tenantId: session.tenantId }
        });
        if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

        const backups = await prisma.deviceConfigBackup.findMany({
            where: { deviceId: deviceId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                configHash: true,
                isCompliant: true,
                complianceLog: true,
                configText: true // Send configText for diff viewer
            }
        });

        return NextResponse.json({ backups }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
