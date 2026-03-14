'use server';

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function addRouterDevice(formData: FormData) {
    const hostname = formData.get('hostname') as string;
    const ipAddress = formData.get('ipAddress') as string;
    const vendor = formData.get('vendor') as string;
    const pollMethod = formData.get('pollMethod') as string;
    const snmpVersion = formData.get('snmpVersion') as string;
    const snmpCommunity = formData.get('snmpCommunity') as string;
    const snmpPort = parseInt(formData.get('snmpPort') as string || '161', 10);
    
    let sshCredentialId: number | null = null;
    const sshCredStr = formData.get('sshCredentialId') as string;
    if (sshCredStr && sshCredStr !== '') {
        sshCredentialId = parseInt(sshCredStr, 10);
    }

    if (!hostname || !ipAddress || !vendor || !pollMethod) {
        redirect(`/settings?error=${encodeURIComponent('Hostname, IP Address, Vendor, and Polling Method are required.')}`);
    }

    try {
        await prisma.routerDevice.create({
            data: {
                hostname,
                ipAddress,
                vendor,
                pollMethod,
                snmpVersion,
                snmpCommunity,
                snmpPort,
                sshCredentialId
            }
        });
    } catch (error: any) {
        // Only redirect if the error is not literally a navigation redirect error from Next.js!
        if (error.message && error.message.includes('NEXT_REDIRECT')) {
            throw error;
        }
        if (error.code === 'P2002') {
            redirect(`/settings?error=${encodeURIComponent('A router with this hostname or IP already exists.')}`);
        }
        redirect(`/settings?error=${encodeURIComponent(error.message || 'Failed to add router.')}`);
    }

    redirect('/settings');
}

export async function updateRouterDevice(formData: FormData) {
    const id = parseInt(formData.get('id') as string);
    const hostname = formData.get('hostname') as string;
    const ipAddress = formData.get('ipAddress') as string;
    const vendor = formData.get('vendor') as string;
    const pollMethod = formData.get('pollMethod') as string;
    const snmpVersion = formData.get('snmpVersion') as string;
    const snmpCommunity = formData.get('snmpCommunity') as string;
    const snmpPort = parseInt(formData.get('snmpPort') as string || '161', 10);

    let sshCredentialId: number | null = null;
    const sshCredStr = formData.get('sshCredentialId') as string;
    if (sshCredStr && sshCredStr !== '') {
        sshCredentialId = parseInt(sshCredStr, 10);
    }

    if (!id || !hostname || !ipAddress) {
        redirect(`/settings?error=${encodeURIComponent('Hostname and IP Address are required.')}`);
    }

    try {
        const existingRouter = await prisma.routerDevice.findUnique({
            where: { id }
        });

        if (!existingRouter) {
            redirect(`/settings?error=${encodeURIComponent('Router not found.')}`);
        }

        const updateData = { 
            hostname, ipAddress, vendor, pollMethod, 
            snmpVersion, snmpCommunity, snmpPort, sshCredentialId 
        };

        if (existingRouter.hostname !== hostname) {
            // If the name changed, we need to cascade the name update to the state tables
            
            // 1. Clear old Redis keys (the worker will recreate them with the new name on next sync)
            const oldKeys = await redis.keys(`BgpSession:${existingRouter.hostname}:*`);
            if (oldKeys.length > 0) {
                await redis.del(...oldKeys);
            }

            // 2. Cascade historical events and update the server name in SQLite
            await prisma.$transaction([
                prisma.historicalEvent.updateMany({
                    where: { serverName: existingRouter.hostname },
                    data: { serverName: hostname }
                }),
                prisma.routerDevice.update({
                    where: { id },
                    data: updateData,
                })
            ]);
        } else {
            // No name change, simple update
            await prisma.routerDevice.update({
                where: { id },
                data: updateData,
            });
        }
    } catch (error: any) {
        if (error.message && error.message.includes('NEXT_REDIRECT')) {
            throw error;
        }
        redirect(`/settings?error=${encodeURIComponent(error.message || 'Failed to update router.')}`);
    }

    redirect('/settings');
}

export async function deleteRouterDevice(id: number) {
    try {
        const existingRouter = await prisma.routerDevice.findUnique({
            where: { id }
        });

        if (existingRouter) {
            // 1. Clear associated BGP sessions from Redis cache
            const serverKeys = await redis.keys(`BgpSession:${existingRouter.hostname}:*`);
            if (serverKeys.length > 0) {
                await redis.del(...serverKeys);
            }

            // 2. Cascade delete the associated historical data and router config from SQLite
            await prisma.$transaction([
                prisma.historicalEvent.deleteMany({
                    where: { serverName: existingRouter.hostname }
                }),
                prisma.routerDevice.delete({
                    where: { id }
                })
            ]);
        }
        
        revalidatePath('/settings');
    } catch (error: any) {
        if (error.message && error.message.includes('NEXT_REDIRECT')) {
            throw error;
        }
        redirect(`/settings?error=${encodeURIComponent(error.message || 'Failed to delete router.')}`);
    }
}

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function triggerManualSync() {
    try {
        // Run the background worker script via shell instead of importing it
        // This ensures Next.js webpack doesn't try to bundle native SNMP/SSH libraries
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
    const rows = await prisma.appSettings.findMany({
        where: { key: { in: ['telegram_bot_token', 'telegram_chat_id'] } }
    });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
        botToken: map['telegram_bot_token'] || '',
        chatId: map['telegram_chat_id'] || '',
    };
}

export async function saveTelegramSettings(formData: FormData) {
    const botToken = (formData.get('telegram_bot_token') as string || '').trim();
    const chatId = (formData.get('telegram_chat_id') as string || '').trim();

    await prisma.$transaction([
        prisma.appSettings.upsert({
            where: { key: 'telegram_bot_token' },
            create: { key: 'telegram_bot_token', value: botToken },
            update: { value: botToken },
        }),
        prisma.appSettings.upsert({
            where: { key: 'telegram_chat_id' },
            create: { key: 'telegram_chat_id', value: chatId },
            update: { value: chatId },
        }),
    ]);

    revalidatePath('/settings');
}
