import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

export async function GET(_request: NextRequest) {
    const session = await requireSession();
    const isSuperAdmin = session.role === 'superadmin';

    const devices = await (prisma as any).routerDevice.findMany({
        where: isSuperAdmin ? {} : { tenantId: session.tenantId },
        include: { sshCredential: true },
        orderBy: { hostname: 'asc' },
    });

    const csvData = devices.map((d: any) => ({
        'Hostname':         d.hostname,
        'IP Address':       d.ipAddress,
        'Vendor':           d.vendor,
        'Poll Method':      d.pollMethod,
        'SNMP Version':     d.snmpVersion || '',
        'SNMP Community':   d.snmpCommunity || '',
        'SNMP Port':        d.snmpPort || 161,
        'SSH User':         d.sshCredential?.sshUser || '',
        'SSH Password':     d.sshCredential?.sshPass || '',
        'SSH Port':         d.sshCredential?.sshPort || 22,
    }));

    const csv = Papa.unparse(csvData);
    const filename = `devices_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
        headers: {
            'Content-Type':        'text/csv',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
