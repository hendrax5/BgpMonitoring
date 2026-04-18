'use server';

import { requireSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { DeviceService } from '@/services/device.service';
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

    try {
        await DeviceService.addDevice(session.tenantId, {
            hostname: formData.get('hostname') as string,
            ipAddress: formData.get('ipAddress') as string,
            vendor: formData.get('vendor') as string,
            pollMethod: formData.get('pollMethod') as string,
            snmpVersion: formData.get('snmpVersion') as string,
            snmpCommunity: formData.get('snmpCommunity') as string,
            snmpPort: parseInt(formData.get('snmpPort') as string || '161', 10),
            sshUser: (formData.get('sshUser') as string || '').trim(),
            sshPass: (formData.get('sshPass') as string || '').trim(),
            sshPort: parseInt(formData.get('sshPort') as string || '22', 10),
            isBgpMonitoring: formData.get('isBgpMonitoring') === 'on',
            isConfigBackup: formData.get('isConfigBackup') === 'on',
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
    try {
        await DeviceService.updateDevice(session.tenantId, id, {
            hostname: formData.get('hostname') as string,
            ipAddress: formData.get('ipAddress') as string,
            vendor: formData.get('vendor') as string,
            pollMethod: formData.get('pollMethod') as string,
            snmpVersion: formData.get('snmpVersion') as string,
            snmpCommunity: formData.get('snmpCommunity') as string,
            snmpPort: parseInt(formData.get('snmpPort') as string || '161', 10),
            sshUser: (formData.get('sshUser') as string || '').trim(),
            sshPass: (formData.get('sshPass') as string || '').trim(),
            sshPort: parseInt(formData.get('sshPort') as string || '22', 10),
            isBgpMonitoring: formData.get('isBgpMonitoring') === 'on',
            isConfigBackup: formData.get('isConfigBackup') === 'on',
        });
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
        await DeviceService.deleteDevice(session.tenantId, id);
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

// --- Alert Channels ---

export async function addAlertChannel(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'monitoring.configAlerts')) {
        redirect('/settings?error=Permission+denied');
    }

    const name = formData.get('name') as string;
    const provider = formData.get('provider') as string;
    const webhookUrl = formData.get('webhookUrl') as string || null;
    const chatId = formData.get('chatId') as string || null;
    const botToken = formData.get('botToken') as string || null;
    const eventTypes = formData.get('eventTypes') as string || 'UP,DOWN,COMPLIANCE_FAILED';

    if (!name || !provider) {
        redirect('/settings?error=Name+and+Provider+are+required');
    }

    try {
        await scopedDb(session.tenantId).alertChannel.create({
            data: { name, provider, webhookUrl, chatId, botToken, eventTypes }
        } as any);
        revalidatePath('/settings');
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) throw error;
        redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    }
}

export async function updateAlertChannel(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'monitoring.configAlerts')) {
        redirect('/settings?error=Permission+denied');
    }

    const id = parseInt(formData.get('id') as string);
    const name = formData.get('name') as string;
    const provider = formData.get('provider') as string;
    const webhookUrl = formData.get('webhookUrl') as string || null;
    const chatId = formData.get('chatId') as string || null;
    const botToken = formData.get('botToken') as string || null;
    const eventTypes = formData.get('eventTypes') as string || 'UP,DOWN';
    const isActive = formData.get('isActive') === 'on';

    try {
        await scopedDb(session.tenantId).alertChannel.update({
            where: { id },
            data: { name, provider, webhookUrl, chatId, botToken, eventTypes, isActive }
        } as any);
        revalidatePath('/settings');
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) throw error;
        redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    }
}

export async function deleteAlertChannel(id: number) {
    const session = await requireSession();
    if (!can(session.role, 'monitoring.configAlerts')) return;

    try {
        await scopedDb(session.tenantId).alertChannel.delete({
            where: { id }
        } as any);
        revalidatePath('/settings');
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) throw error;
        redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    }
}
