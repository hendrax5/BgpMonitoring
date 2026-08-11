'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';

const MANAGE_ROLES = ['superadmin', 'orgadmin', 'networkengineer'];

type Result = { success: boolean; error?: string };

// Quick "Add Device" usable from the main dashboard by any manage-role user
// (PRTG-style). Superadmin may target a specific tenant; others use their own.
export async function addDeviceQuick(formData: FormData): Promise<Result> {
    const session = await requireSession();
    if (!MANAGE_ROLES.includes(session.role)) return { success: false, error: 'Permission denied.' };

    const hostname = (formData.get('hostname') as string || '').trim();
    const ipAddress = (formData.get('ipAddress') as string || '').trim();
    const vendor = (formData.get('vendor') as string || 'mikrotik').trim();
    const snmpCommunity = (formData.get('snmpCommunity') as string || '').trim() || null;
    const pollMethod = (formData.get('pollMethod') as string || 'snmp_ssh_mix').trim();
    const sshUser = (formData.get('sshUser') as string || '').trim();
    const sshPass = (formData.get('sshPass') as string || '').trim();
    const sshPort = parseInt((formData.get('sshPort') as string || '22'), 10);
    const tenantIdRaw = (formData.get('tenantId') as string || '').trim();

    if (!hostname) return { success: false, error: 'Hostname is required.' };
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^[0-9a-fA-F:]+$/;
    if (!ipAddress || (!ipv4.test(ipAddress) && !ipv6.test(ipAddress))) return { success: false, error: 'A valid IP address is required.' };

    const tenantId = session.role === 'superadmin' && tenantIdRaw ? tenantIdRaw : session.tenantId;
    if (session.role === 'superadmin' && !tenantIdRaw) return { success: false, error: 'Select an organization for this device.' };

    try {
        let sshCredentialId: number | null = null;
        if (sshUser && sshPass) {
            const cred = await (prisma as any).deviceCredential.upsert({
                where: { tenantId_deviceIp: { tenantId, deviceIp: ipAddress } },
                create: { tenantId, deviceIp: ipAddress, sshUser, sshPass, sshPort, vendor },
                update: { sshUser, sshPass, sshPort, vendor },
            });
            sshCredentialId = cred.id;
        }

        await (prisma as any).routerDevice.create({
            data: { tenantId, hostname, ipAddress, vendor, snmpCommunity, pollMethod, sshCredentialId },
        });

        await logAudit(session, { action: 'create', entityType: 'device', entityLabel: `${hostname} (${ipAddress})`, tenantId, metadata: { vendor, via: 'dashboard' } });
        revalidatePath('/');
        revalidatePath('/config-management');
        return { success: true };
    } catch (e: any) {
        if (e?.code === 'P2002') return { success: false, error: 'A device with this hostname or IP already exists.' };
        return { success: false, error: e?.message || 'Failed to add device.' };
    }
}
