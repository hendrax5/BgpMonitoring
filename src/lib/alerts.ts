import { prisma } from '@/lib/prisma';
import { scopedDb } from '@/lib/scoped-db';

export type AlertEventData = {
    tenantId: string;
    eventType: 'UP' | 'DOWN' | 'COMPLIANCE_FAILED';
    title: string;
    message: string;
    meta?: Record<string, any>;
};

export async function dispatchAlert(data: AlertEventData) {
    const { tenantId, eventType, title, message } = data;
    const db = scopedDb(tenantId);

    try {
        const activeChannels = await db.alertChannel.findMany({
            where: { isActive: true }
        });

        // Filter channels that subscribe to this eventType
        const targetChannels = activeChannels.filter((c: any) => 
            c.eventTypes.includes(eventType) || c.eventTypes === '*'
        );

        const promises = targetChannels.map((channel: any) => {
            switch(channel.provider) {
                case 'telegram':
                    return sendTelegram(channel, title, message);
                case 'slack':
                case 'discord':
                case 'webhook':
                    return sendWebhook(channel, title, message);
                default:
                    return Promise.resolve();
            }
        });

        await Promise.allSettled(promises);
    } catch (e) {
        console.error('Failed to dispatch alerts:', e);
    }
}

async function sendTelegram(channel: any, title: string, message: string) {
    const { botToken, chatId } = channel;
    if (!botToken || !chatId) return;

    const text = `*${title}*\n\n${message}`;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown'
        })
    }).catch(() => {});
}

async function sendWebhook(channel: any, title: string, message: string) {
    if (!channel.webhookUrl) return;

    let payload: any = { content: `**${title}**\n${message}` };

    if (channel.provider === 'slack') {
        payload = { text: `*${title}*\n${message}` };
    } else if (channel.provider === 'webhook') {
        payload = { title, message, provider: 'bgpmon' };
    }

    await fetch(channel.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(() => {});
}
