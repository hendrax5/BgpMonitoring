'use server';

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { requireSession } from '@/lib/auth';
import { scopedDb } from '@/lib/scoped-db';
import { can } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function addRouterDevice(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'device.manage')) {
        redirect('/settings?error=Permission+denied%3A+only+OrgAdmin+and+above+can+add+devices.');
    }
    const db = scopedDb(session.tenantId);

    const hostname = formData.get('hostname') as string;
    const ipAddress = formData.get('ipAddress') as string;
    const vendor = formData.get('vendor') as string;
    const pollMethod = formData.get('pollMethod') as string;
    const snmpVersion = formData.get('snmpVersion') as string;
    const snmpCommunity = formData.get('snmpCommunity') as string;
    const snmpPort = parseInt(formData.get('snmpPort') as string || '161', 10);
    const sshUser = (formData.get('sshUser') as string || '').trim();
    const sshPass = (formData.get('sshPass') as string || '').trim();
    const sshPort = parseInt(formData.get('sshPort') as string || '22', 10);
    const isBgpMonitoring = formData.get('isBgpMonitoring') === 'on';
    const isConfigBackup = formData.get('isConfigBackup') === 'on';

    if (!hostname || !ipAddress || !vendor || !pollMethod) {
        redirect(`/settings?error=${encodeURIComponent('Hostname, IP Address, Vendor, and Polling Method are required.')}`);
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

        await db.routerDevice.create({
            data: { hostname, ipAddress, vendor, pollMethod, snmpVersion, snmpCommunity, snmpPort, sshCredentialId, isBgpMonitoring, isConfigBackup }
        });
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) throw error;
        redirect(`/settings?error=${encodeURIComponent(error.message || 'Failed to add router.')}`);
    }
    redirect('/settings');
}

export async function updateRouterDevice(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'device.manage')) {
        redirect('/settings?error=Permission+denied%3A+only+OrgAdmin+and+above+can+edit+devices.');
    }

    const id = parseInt(formData.get('id') as string);
    const hostname = formData.get('hostname') as string;
    const ipAddress = formData.get('ipAddress') as string;
    const vendor = formData.get('vendor') as string;
    const pollMethod = formData.get('pollMethod') as string;
    const snmpVersion = formData.get('snmpVersion') as string;
    const snmpCommunity = formData.get('snmpCommunity') as string;
    const snmpPort = parseInt(formData.get('snmpPort') as string || '161', 10);
    const sshUser = (formData.get('sshUser') as string || '').trim();
    const sshPass = (formData.get('sshPass') as string || '').trim();
    const sshPort = parseInt(formData.get('sshPort') as string || '22', 10);
    const isBgpMonitoring = formData.get('isBgpMonitoring') === 'on';
    const isConfigBackup = formData.get('isConfigBackup') === 'on';

    if (!id || !hostname || !ipAddress) {
        redirect(`/settings?error=${encodeURIComponent('Hostname and IP Address are required.')}`);
    }

    try {
        const existingRouter = await (prisma as any).routerDevice.findFirst({ where: { id, tenantId: session.tenantId } });
        if (!existingRouter) redirect(`/settings?error=${encodeURIComponent('Router not found.')}`);

        let sshCredentialId: number | null = existingRouter.sshCredentialId;
        if (sshUser && sshPass) {
            const cred = await (prisma as any).deviceCredential.upsert({
                where: { tenantId_deviceIp: { tenantId: session.tenantId, deviceIp: ipAddress } },
                create: { tenantId: session.tenantId, deviceIp: ipAddress, sshUser, sshPass, sshPort, vendor },
                update: { sshUser, sshPass, sshPort, vendor },
            });
            sshCredentialId = cred.id;
        }

        const updateData = { hostname, ipAddress, vendor, pollMethod, snmpVersion, snmpCommunity, snmpPort, sshCredentialId, isBgpMonitoring, isConfigBackup };

        if (existingRouter.hostname !== hostname || existingRouter.isBgpMonitoring !== isBgpMonitoring) {
            const oldKeys = await redis.keys(`BgpSession:${session.tenantId}:${existingRouter.hostname}:*`);
            if (oldKeys.length > 0) await redis.del(...oldKeys);
        }

        await (prisma as any).routerDevice.update({ where: { id }, data: updateData });
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) throw error;
        redirect(`/settings?error=${encodeURIComponent(error.message || 'Failed to update router.')}`);
    }
    redirect('/settings');
}

export async function deleteRouterDevice(id: number) {
    const session = await requireSession();
    if (!can(session.role, 'device.manage')) return;

    try {
        const existing = await (prisma as any).routerDevice.findFirst({ where: { id, tenantId: session.tenantId } });
        if (existing) {
            const redisKeys = await redis.keys(`BgpSession:${session.tenantId}:${existing.hostname}:*`);
            if (redisKeys.length > 0) await redis.del(...redisKeys);
            await (prisma as any).routerDevice.delete({ where: { id } });
        }
        revalidatePath('/settings');
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) throw error;
        redirect(`/settings?error=${encodeURIComponent(error.message || 'Failed to delete router.')}`);
    }
}

export async function triggerManualSync() {
    try {
        await execAsync('npm run worker');
        revalidatePath('/');
        revalidatePath('/settings');
        revalidatePath('/reports');
        return { success: true, message: 'Data synchronization completed successfully.' };
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to synchronize data.' };
    }
}

export async function getTelegramSettings(): Promise<{ botToken: string; chatId: string }> {
    const session = await requireSession();
    const db = scopedDb(session.tenantId);
    const rows = await db.appSettings.findMany({ where: { key: { in: ['telegram_bot_token', 'telegram_chat_id'] } } } as any);
    const map = Object.fromEntries((rows as any[]).map((r: any) => [r.key, r.value]));
    return {
        botToken: map['telegram_bot_token'] || '',
        chatId: map['telegram_chat_id'] || '',
    };
}

export async function saveTelegramSettings(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'monitoring.configAlerts')) {
        redirect('/settings?error=Permission+denied%3A+only+NetworkEngineer+and+above+can+configure+alerts.');
    }
    const db = scopedDb(session.tenantId);
    const botToken = (formData.get('telegram_bot_token') as string || '').trim();
    const chatId = (formData.get('telegram_chat_id') as string || '').trim();

    await db.appSettings.upsert({ where: { key: 'telegram_bot_token' }, create: { key: 'telegram_bot_token', value: botToken }, update: { value: botToken } } as any);
    await db.appSettings.upsert({ where: { key: 'telegram_chat_id' }, create: { key: 'telegram_chat_id', value: chatId }, update: { value: chatId } } as any);

    revalidatePath('/settings');
}

/**
 * Force-remove a specific BGP session from Redis.
 * Used when a peer has been deleted from the router config but still appears
 * in the dashboard because the worker hasn't polled yet or the router still
 * briefly reports the peer in Idle/Active state.
 */
export async function removeSession(formData: FormData) {
    const session = await requireSession();
    const tenantId = session.tenantId;
    const serverName = formData.get('serverName') as string;
    const deviceId = formData.get('deviceId') as string;
    const peerIp = formData.get('peerIp') as string;

    if (!serverName || !deviceId || !peerIp) {
        revalidatePath('/');
        return;
    }

    // Find matching Redis key (wildcard then exact peerIp match)
    const keysToCheck = await redis.keys(`BgpSession:${tenantId}:${serverName}:${deviceId}:*`);
    const matchedKeys = keysToCheck.filter((k: string) => {
        const kPeerIp = k.split(':').slice(4).join(':');
        return kPeerIp === peerIp;
    });
    if (matchedKeys.length > 0) {
        await redis.del(...matchedKeys);
    }
    revalidatePath('/');
}

export async function getBackupSettings(): Promise<{ intervalCron: string }> {
    const session = await requireSession();
    const db = scopedDb(session.tenantId);
    const setting = await db.appSettings.findFirst({ where: { key: 'backup_interval_cron' } } as any);
    return { intervalCron: setting?.value || '0 * * * *' }; // Default 1 Hour
}

export async function saveBackupSettings(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'device.manage')) {
        redirect('/settings?error=Permission+denied+to+configure+backups.');
    }
    const db = scopedDb(session.tenantId);
    const intervalCron = (formData.get('backup_interval_cron') as string || '0 * * * *').trim();

    await db.appSettings.upsert({ 
        where: { key: 'backup_interval_cron' }, 
        create: { key: 'backup_interval_cron', value: intervalCron }, 
        update: { value: intervalCron } 
    } as any);

    revalidatePath('/settings');
}

export async function addVendorProfile(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'device.manage')) redirect('/settings?error=Permission+denied');

    const vendorName = formData.get('vendorName') as string;
    const connectionMode = formData.get('connectionMode') as string || 'exec';
    const backupCommand = formData.get('backupCommand') as string || '';
    const disablePagingCmd = formData.get('disablePagingCmd') as string || '';

    if (!vendorName || !backupCommand) redirect('/settings?error=Vendor+Name+and+Backup+Command+are+required');

    try {
        await (prisma as any).vendorProfile.create({
            data: { vendorName, connectionMode, backupCommand, disablePagingCmd }
        });
        revalidatePath('/settings');
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) throw error;
        redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    }
}

export async function updateVendorProfile(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'device.manage')) redirect('/settings?error=Permission+denied');

    const id = parseInt(formData.get('id') as string);
    const vendorName = formData.get('vendorName') as string;
    const connectionMode = formData.get('connectionMode') as string || 'exec';
    const backupCommand = formData.get('backupCommand') as string || '';
    const disablePagingCmd = formData.get('disablePagingCmd') as string || '';

    if (!id || !vendorName || !backupCommand) redirect('/settings?error=Required+fields+missing');

    try {
        await (prisma as any).vendorProfile.update({
            where: { id },
            data: { vendorName, connectionMode, backupCommand, disablePagingCmd }
        });
        revalidatePath('/settings');
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) throw error;
        redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    }
}

export async function deleteVendorProfile(id: number) {
    const session = await requireSession();
    if (!can(session.role, 'device.manage')) redirect('/settings?error=Permission+denied');
    
    try {
        await (prisma as any).vendorProfile.delete({ where: { id } });
        revalidatePath('/settings');
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) throw error;
        redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    }
}
