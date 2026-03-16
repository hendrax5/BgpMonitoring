import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
    const session = await requireSession();
    if (!can(session.role, 'device.manage')) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const text = await request.text();
    const { data, errors } = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
    });

    if (errors.length > 0) {
        return NextResponse.json({ error: 'CSV parse error', details: errors[0].message }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;
    const errorRows: string[] = [];

    for (const row of data) {
        const hostname      = row['Hostname']?.trim();
        const ipAddress     = row['IP Address']?.trim();
        const vendor        = row['Vendor']?.trim()?.toLowerCase();
        const pollMethod    = row['Poll Method']?.trim() || 'ssh';
        const snmpVersion   = row['SNMP Version']?.trim() || '';
        const snmpCommunity = row['SNMP Community']?.trim() || '';
        const snmpPort      = parseInt(row['SNMP Port'] || '161', 10);
        const sshUser       = row['SSH User']?.trim() || '';
        const sshPass       = row['SSH Password']?.trim() || '';
        const sshPort       = parseInt(row['SSH Port'] || '22', 10);

        if (!hostname || !ipAddress || !vendor) {
            errorRows.push(`Missing required fields: ${JSON.stringify(row)}`);
            skipped++;
            continue;
        }

        try {
            let sshCredentialId: number | null = null;
            if (sshUser && sshPass) {
                const cred = await (prisma as any).deviceCredential.upsert({
                    where: { tenantId_deviceIp: { tenantId: session.tenantId, deviceIp: ipAddress } },
                    create: { tenantId: session.tenantId, deviceIp: ipAddress, sshUser, sshPass, sshPort, vendor },
                    update: { sshUser, sshPass, sshPort, vendor },
                });
                sshCredentialId = cred.id;
            }

            // Skip if device with same hostname already exists for this tenant
            const existing = await (prisma as any).routerDevice.findFirst({
                where: { tenantId: session.tenantId, hostname },
            });

            if (existing) {
                skipped++;
                continue;
            }

            await (prisma as any).routerDevice.create({
                data: {
                    tenantId: session.tenantId,
                    hostname, ipAddress, vendor, pollMethod,
                    snmpVersion, snmpCommunity, snmpPort, sshCredentialId,
                },
            });
            imported++;
        } catch (err: any) {
            errorRows.push(`${hostname}: ${err.message}`);
            skipped++;
        }
    }

    return NextResponse.json({ imported, skipped, errors: errorRows });
}
