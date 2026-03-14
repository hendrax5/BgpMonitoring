import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { MikrotikPoller } from '../lib/pollers/vendors/mikrotik';
import { CiscoPoller } from '../lib/pollers/vendors/cisco';
import { DanosPoller } from '../lib/pollers/vendors/danos';
import { VyosPoller } from '../lib/pollers/vendors/vyos';
import { JuniperPoller } from '../lib/pollers/vendors/juniper';
import { HuaweiPoller } from '../lib/pollers/vendors/huawei';
import { BgpPeerState } from '../lib/pollers/base';

// Telegram config is read from AppSettings DB at runtime (configurable via Settings UI)

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function lookupAsnName(asn: bigint): Promise<string> {
    const cached = await prisma.asnDictionary.findUnique({ where: { asn } });
    if (cached && !/^AS\d+$/.test(cached.organizationName)) {
        return cached.organizationName;
    }

    let orgName = `AS${asn}`;
    const rdapUrls = [
        `https://rdap.arin.net/registry/autnum/${asn}`,
        `https://rdap.db.ripe.net/autnum/${asn}`
    ];

    for (const rdapUrl of rdapUrls) {
        try {
            const res = await fetch(rdapUrl, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const data = await res.json();
                const name = data.name ||
                    data.entities?.[0]?.vcardArray?.[1]?.find((v: any[]) => v[0] === 'fn')?.[3];
                if (name && name !== asn.toString()) {
                    orgName = name;
                    break;
                }
            }
        } catch {
            // try next
        }
    }

    await prisma.asnDictionary.upsert({
        where: { asn },
        create: { asn, organizationName: orgName },
        update: { organizationName: orgName, lastUpdatedAt: new Date() },
    });

    return orgName;
}

export async function sendTelegramAlert(type: 'DOWN' | 'UP', data: any, organizationName: string, duration?: number, botToken?: string, chatId?: string) {
    const TELEGRAM_ENABLED = !!(botToken && chatId);

    const icon = type === 'DOWN' ? '🚨' : '✅';
    const stateLabel = type === 'DOWN' ? 'DOWN' : 'RECOVERED';
    const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    let message = `${icon} *BGP ${stateLabel}*\n`;
    message += `*Device:* ${data.deviceName} \`(${data.deviceIp})\`\n`;
    message += `*Peer IP:* \`${data.peerIp}\`\n`;
    message += `*ASN:* AS${data.remoteAsn} — *${organizationName}*\n`;
    message += `*Waktu:* ${nowStr}\n`;

    if (type === 'UP' && duration !== undefined) {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        message += `*Total Downtime:* ${mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}\n`;
    }

    if (!TELEGRAM_ENABLED) {
        console.log(`\n--- [Telegram Alert - Not Configured] ---`);
        console.log(message.replace(/\*/g, ''));
        console.log(`-----------------------------------------\n`);
        return;
    }

    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
            }),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
            const err = await res.text();
            console.error(`❌ Telegram API error: ${err}`);
        } else {
            console.log(`📨 Telegram ${type} alert sent for ${data.peerIp}`);
        }
    } catch (err: any) {
        console.error(`❌ Failed to send Telegram alert: ${err.message}`);
    }
}

export async function forceSyncLibreNMS(triggeredBy: string = 'Worker') {
    console.log(`[${new Date().toISOString()}] Starting Direct SNMP/SSH ${triggeredBy} Polling cycle...`);

    // --- Load Telegram config from DB (set via Settings UI) ---
    let telegramBotToken = '';
    let telegramChatId = '';
    try {
        const tgSettings = await (prisma as any).appSettings.findMany({
            where: { key: { in: ['telegram_bot_token', 'telegram_chat_id'] } }
        });
        const tgMap = Object.fromEntries(tgSettings.map((r: any) => [r.key, r.value]));
        telegramBotToken = tgMap['telegram_bot_token'] || '';
        telegramChatId = tgMap['telegram_chat_id'] || '';
    } catch {
        // appSettings table might not exist yet on first run
    }

    let devices: any[] = [];
    try {
        devices = await prisma.routerDevice.findMany({
            include: { sshCredential: true }
        });
    } catch (e) {
        console.error("⚠️ Failed to load router devices from database.", e);
        return;
    }

    // --- Global Cleanup: Remove orphaned Redis sessions for deleted devices ---
    try {
        const allKeys = await redis.keys('BgpSession:*');
        const validDeviceNames = new Set(devices.map(d => d.hostname));
        const orphanedKeys = allKeys.filter(k => {
            // Key format: BgpSession:SERVER_NAME(hostname):DEVICE_ID:PEER_IP
            const parts = k.split(':');
            return parts.length >= 2 && !validDeviceNames.has(parts[1]);
        });
        
        if (orphanedKeys.length > 0) {
            await redis.del(...orphanedKeys);
            console.log(`🗑️ Global Cleanup: Removed ${orphanedKeys.length} orphaned sessions from Redis for deleted routers.`);
        }
    } catch (err) {
        console.error("⚠️ Failed to clean up orphaned Redis keys", err);
    }

    if (devices.length === 0) {
        console.warn("⚠️ No Routers configured in the Database. Please add one via the Settings UI.");
        return;
    }

    for (const device of devices) {
        console.log(`\n🔄 Polling Router: ${device.hostname} (${device.vendor})`);
        
        let poller;
        switch (device.vendor.toLowerCase()) {
            case 'mikrotik':
                poller = new MikrotikPoller(device);
                break;
            case 'cisco':
                poller = new CiscoPoller(device);
                break;
            case 'juniper':
                poller = new JuniperPoller(device);
                break;
            case 'huawei':
                poller = new HuaweiPoller(device);
                break;
            case 'danos':
                poller = new DanosPoller(device);
                break;
            case 'vyos':
                poller = new VyosPoller(device);
                break;
            default:
                console.log(`⏭️ Unknown vendor poller for ${device.hostname}`);
                continue;
        }

        let activeSessions: BgpPeerState[] = [];
        try {
            activeSessions = await poller.poll();
        } catch (error: any) {
            console.log(`⏭️ Skipping sync for ${device.hostname} due to polling error: ${error.message}`);
            continue;
        }

        for (const peer of activeSessions) {
            const isUp = peer.bgpState === 'Established';
            const orgName = await lookupAsnName(BigInt(peer.remoteAsn));
            
            // Map the parsed data exactly onto the old LibreNMS expected schema
            const session = {
                serverName: device.hostname,
                deviceId: device.id,
                deviceName: device.hostname,
                deviceDescription: `${device.vendor} Router`,
                deviceIp: device.ipAddress,
                peerIp: peer.peerIp,
                remoteAsn: peer.remoteAsn,
                bgpState: peer.bgpState,
                acceptedPrefixes: peer.acceptedPrefixes,
                advertisedPrefixes: peer.advertisedPrefixes,
                peerDescription: peer.description || '',  // ← from vendor poller
            };

            const redisKey = `BgpSession:${session.serverName}:${session.deviceId}:${session.peerIp}`;

            try {
                const existingStateStr = await redis.hget(redisKey, 'data');
                const existingState = existingStateStr ? JSON.parse(existingStateStr) : null;

                const currentStateObj = {
                    ...session,
                    stateChangedAt: existingState?.stateChangedAt || new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                };

                if (!existingState) {
                    await redis.hset(redisKey, 'data', JSON.stringify(currentStateObj));
                    continue;
                }

                const wasUp = existingState.bgpState === 'Established';

                if (wasUp && !isUp) {
                    // UP -> DOWN
                    await (prisma as any).historicalEvent.create({
                        data: {
                            serverName: session.serverName,
                            eventTimestamp: new Date(),
                            deviceName: session.deviceName,
                            deviceIp: session.deviceIp,
                            peerIp: session.peerIp,
                            peerDescription: session.peerDescription || null,
                            asn: session.remoteAsn,
                            organizationName: orgName,
                            eventType: 'DOWN'
                        }
                    });
                    sendTelegramAlert('DOWN', session, orgName, undefined, telegramBotToken, telegramChatId).catch(() => {});
                    currentStateObj.stateChangedAt = new Date().toISOString();
                }
                else if (!wasUp && isUp) {
                    // DOWN -> UP
                    const lastDownEvent = await prisma.historicalEvent.findFirst({
                        where: {
                            serverName: session.serverName,
                            peerIp: session.peerIp,
                            eventType: 'DOWN'
                        },
                        orderBy: { eventTimestamp: 'desc' }
                    });

                    let downtimeDuration = null;
                    let downEventId = null;

                    if (lastDownEvent) {
                        downtimeDuration = Math.floor((new Date().getTime() - lastDownEvent.eventTimestamp.getTime()) / 1000);
                        downEventId = lastDownEvent.eventId;
                    }

                    await (prisma as any).historicalEvent.create({
                        data: {
                            serverName: session.serverName,
                            eventTimestamp: new Date(),
                            deviceName: session.deviceName,
                            deviceIp: session.deviceIp,
                            peerIp: session.peerIp,
                            peerDescription: session.peerDescription || null,
                            asn: session.remoteAsn,
                            organizationName: orgName,
                            eventType: 'UP',
                            downEventId,
                            downtimeDuration
                        }
                    });
                    sendTelegramAlert('UP', session, orgName, downtimeDuration ?? undefined, telegramBotToken, telegramChatId).catch(() => {});
                     currentStateObj.stateChangedAt = new Date().toISOString();
                }

                await redis.hset(redisKey, 'data', JSON.stringify(currentStateObj));
            } catch (err: any) {
                console.error(`❌ Redis/DB error while processing session for ${session.deviceName} (${session.peerIp}):`, err.message);
            }
            // Sleep briefly to yield SQLite lock
            await sleep(10);
        }

        // --- Cleanup: Remove stale sessions from Redis ---
        const storedKeys = await redis.keys(`BgpSession:${device.hostname}:*`);
        const activeKeys = new Set(
            activeSessions.map((s) => `BgpSession:${device.hostname}:${device.id}:${s.peerIp}`)
        );

        const staleKeys = storedKeys.filter(key => !activeKeys.has(key));

        if (staleKeys.length > 0) {
            await redis.del(...staleKeys);
            console.log(`🗑️ Removed ${staleKeys.length} stale session(s) from Redis for ${device.hostname}.`);
        }

        console.log(`✅ Completed ${device.hostname}: Processed ${activeSessions.length} sessions.`);

        // --- Fetch & Save SSH BGP log to DB ---
        try {
            const logEntries = await poller.fetchBgpLog();
            if (logEntries.length > 0) {
                // Delete old entries (keep max 500 per device)
                const count = await (prisma as any).bgpLog.count({ where: { deviceId: device.id } });
                if (count > 450) {
                    const oldest = await (prisma as any).bgpLog.findMany({
                        where: { deviceId: device.id },
                        orderBy: { fetchedAt: 'asc' },
                        take: count - 450,
                        select: { id: true }
                    });
                    await (prisma as any).bgpLog.deleteMany({ where: { id: { in: oldest.map((e: any) => e.id) } } });
                }
                // Insert new entries
                await (prisma as any).bgpLog.createMany({
                    data: logEntries.map(e => ({
                        deviceId: device.id,
                        deviceName: device.hostname,
                        peerIp: e.peerIp,
                        eventType: e.eventType,
                        message: e.message,
                    }))
                });
                console.log(`📜 Saved ${logEntries.length} SSH log entries for ${device.hostname}.`);
            }
        } catch (err: any) {
            console.error(`⚠️ Failed to save BGP log for ${device.hostname}: ${err.message}`);
        }
    }

    console.log(`[${new Date().toISOString()}] Synchronization ${triggeredBy} cycle complete.`);
}
