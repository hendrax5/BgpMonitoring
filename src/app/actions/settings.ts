'use server';

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function addLibrenmsServer(formData: FormData) {
    const name = formData.get('name') as string;
    const apiUrl = formData.get('apiUrl') as string;
    const apiToken = formData.get('apiToken') as string;

    if (!name || !apiUrl || !apiToken) {
        redirect(`/settings?error=${encodeURIComponent('Name, API URL, and API Token are required.')}`);
    }

    // Pre-flight API Validation
    try {
        const url = apiUrl.endsWith('/') ? `${apiUrl}devices` : `${apiUrl}/devices`;
        const res = await fetch(url, {
            headers: { 'X-Auth-Token': apiToken }
        });

        if (!res.ok) {
            redirect(`/settings?error=${encodeURIComponent(`Invalid API Request: Server returned ${res.status} ${res.statusText}. Please check URL and Token.`)}`);
        }

        const data = await res.text();

        try {
            JSON.parse(data);
        } catch (e) {
            redirect(`/settings?error=${encodeURIComponent('Invalid API URL: Server returned HTML/Text instead of JSON. Ensure the URL points strictly to the /api/v0/ path.')}`);
        }

    } catch (error: any) {
        // Only redirect if the error is not literally a navigation redirect error from Next.js!
        if (error.message && error.message.includes('NEXT_REDIRECT')) {
            throw error;
        }
        redirect(`/settings?error=${encodeURIComponent(`Connection failed: ${error.message}`)}`);
    }

    try {
        await prisma.librenmsServer.create({
            data: {
                name,
                apiUrl,
                apiToken
            }
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            redirect(`/settings?error=${encodeURIComponent('A server with this name already exists.')}`);
        }
        redirect(`/settings?error=${encodeURIComponent(error.message || 'Failed to add server.')}`);
    }

    redirect('/settings');
}

export async function updateLibrenmsServer(formData: FormData) {
    const id = parseInt(formData.get('id') as string);
    const name = formData.get('name') as string;
    const apiUrl = formData.get('apiUrl') as string;
    const apiToken = formData.get('apiToken') as string;

    if (!id || !name || !apiUrl) {
        redirect(`/settings?error=${encodeURIComponent('Name and API URL are required.')}`);
    }

    try {
        const existingServer = await prisma.librenmsServer.findUnique({
            where: { id }
        });

        if (!existingServer) {
            redirect(`/settings?error=${encodeURIComponent('Server not found.')}`);
        }

        const updateData: any = { name, apiUrl };
        // Only update token if a new one was provided
        if (apiToken && apiToken.trim()) {
            updateData.apiToken = apiToken;
        }

        if (existingServer.name !== name) {
            // If the name changed, we need to cascade the name update to the state tables
            
            // 1. Clear old Redis keys (the worker will recreate them with the new name on next sync)
            const oldKeys = await redis.keys(`BgpSession:${existingServer.name}:*`);
            if (oldKeys.length > 0) {
                await redis.del(...oldKeys);
            }

            // 2. Cascade historical events and update the server name in SQLite
            await prisma.$transaction([
                prisma.historicalEvent.updateMany({
                    where: { serverName: existingServer.name },
                    data: { serverName: name }
                }),
                prisma.librenmsServer.update({
                    where: { id },
                    data: updateData,
                })
            ]);
        } else {
            // No name change, simple update
            await prisma.librenmsServer.update({
                where: { id },
                data: updateData,
            });
        }
    } catch (error: any) {
        // Only redirect if the error is not literally a navigation redirect from Next.js
        if (error.message && error.message.includes('NEXT_REDIRECT')) {
            throw error;
        }
        redirect(`/settings?error=${encodeURIComponent(error.message || 'Failed to update server.')}`);
    }

    redirect('/settings');
}

export async function deleteLibrenmsServer(id: number) {
    try {
        const existingServer = await prisma.librenmsServer.findUnique({
            where: { id }
        });

        if (existingServer) {
            // 1. Clear associated BGP sessions from Redis cache
            const serverKeys = await redis.keys(`BgpSession:${existingServer.name}:*`);
            if (serverKeys.length > 0) {
                await redis.del(...serverKeys);
            }

            // 2. Cascade delete the associated historical data and server config from SQLite
            await prisma.$transaction([
                prisma.historicalEvent.deleteMany({
                    where: { serverName: existingServer.name }
                }),
                prisma.librenmsServer.delete({
                    where: { id }
                })
            ]);
        }
        
        revalidatePath('/settings');
    } catch (error: any) {
        redirect(`/settings?error=${encodeURIComponent(error.message || 'Failed to delete server.')}`);
    }
}

export async function triggerManualSync() {
    try {
        const { forceSyncLibreNMS } = await import('@/worker/sync');
        await forceSyncLibreNMS('Manual UI');
        revalidatePath('/');
        revalidatePath('/settings');
        revalidatePath('/reports');
        return { success: true, message: 'Data synchronization completed successfully.' };
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to synchronize data.' };
    }
}
