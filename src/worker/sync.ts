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

    // --- Load all tenants ---
    let tenants: any[] = [];
    try {
        tenants = await (prisma as any).tenant.findMany({ select: { id: true, slug: true } });
    } catch (e) {
        console.error('⚠️ Failed to load tenants.', e);
        return;
    }

    if (tenants.length === 0) {
        console.warn('⚠️ No tenants found. Register an organization first.');
        return;
    }

    for (const tenant of tenants) {
        await pollTenant(tenant.id, tenant.slug);
    }
}

async function pollTenant(tenantId: string, tenantSlug: string) {
    console.log(`\n[Tenant: ${tenantSlug}] Starting poll...`);

    // --- Load Telegram config for this tenant ---
    let telegramBotToken = '';
    let telegramChatId = '';
    try {
        const tgSettings = await (prisma as any).appSettings.findMany({
            where: { tenantId, key: { in: ['telegram_bot_token', 'telegram_chat_id'] } }
        });
        const tgMap = Object.fromEntries(tgSettings.map((r: any) => [r.key, r.value]));
        telegramBotToken = tgMap['telegram_bot_token'] || '';
        telegramChatId = tgMap['telegram_chat_id'] || '';
    } catch { /* appSettings might not exist yet */ }

    let devices: any[] = [];
    try {
        devices = await (prisma as any).routerDevice.findMany({
            where: { tenantId },
            include: { sshCredential: true }
        });
    } catch (e) {
        console.error(`⚠️ [${tenantSlug}] Failed to load devices.`, e);
        return;
    }

    // --- Cleanup orphaned Redis sessions for this tenant ---
    try {
        const allKeys = await redis.keys(`BgpSession:${tenantId}:*`);
        const validDeviceNames = new Set(devices.map((d: any) => d.hostname));
        const orphanedKeys = allKeys.filter((k: string) => {
            const parts = k.split(':');
            return parts.length >= 3 && !validDeviceNames.has(parts[2]);
        });
        if (orphanedKeys.length > 0) {
            await redis.del(...orphanedKeys);
            console.log(`🗑️ [${tenantSlug}] Removed ${orphanedKeys.length} orphaned sessions from Redis.`);
        }
    } catch (err) { console.error(`⚠️ [${tenantSlug}] Failed to clean orphaned Redis keys`, err); }

    if (devices.length === 0) {
        console.warn(`⚠️ [${tenantSlug}] No routers configured.`);
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

        // --- Per-device stale peer cleanup ---
        // After a successful poll, remove Redis entries for peers no longer reported by this router.
        // This handles: BGP neighbor removed from router config, or peer entry manually deleted.
        try {
            // Key format: BgpSession:{tenantId}:{serverName}:{deviceId}:{peerIp}
            const deviceKeyPattern = `BgpSession:${tenantId}:${device.hostname}:${device.id}:*`;
            const existingPeerKeys = await redis.keys(deviceKeyPattern);
            // Build set of peerIps currently reported by router
            const activePeerIps = new Set(activeSessions.map(p => p.peerIp));
            const staleKeys = existingPeerKeys.filter((k: string) => {
                const peerIp = k.split(':').slice(4).join(':'); // handles IPv6 which has colons
                return !activePeerIps.has(peerIp);
            });
            if (staleKeys.length > 0) {
                await redis.del(...staleKeys);
                console.log(`🗑️ [${device.hostname}] Removed ${staleKeys.length} stale peer(s) from Redis: ${staleKeys.map((k: string) => k.split(':').slice(4).join(':')).join(', ')}`);
            }
        } catch (err) {
            console.error(`⚠️ [${device.hostname}] Failed to clean stale peer keys`, err);
        }

        for (const peer of activeSessions) {
            const isUp = peer.bgpState === 'Established';
            const orgName = await lookupAsnName(BigInt(peer.remoteAsn));
            
            // Map the parsed data exactly onto the expected schema
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
                peerDescription: peer.description || '',
                uptimeSeconds: peer.uptime ?? null,  // ← actual BGP peer uptime from router
            };

            const redisKey = `BgpSession:${tenantId}:${session.serverName}:${session.deviceId}:${session.peerIp}`;

            try {
                const existingStateStr = await redis.hget(redisKey, 'data');
                const existingState = existingStateStr ? JSON.parse(existingStateStr) : null;

                // === Uptime-Derived stateChangedAt ===
                // If router provides uptime, compute the exact time the session went Established:
                //   stateChangedAt = now - uptimeSeconds
                // If not established or no uptime: keep existing or use now.
                const now = Date.now();
                let computedStateChangedAt: string;
                if (isUp && session.uptimeSeconds != null && session.uptimeSeconds > 0) {
                    computedStateChangedAt = new Date(now - session.uptimeSeconds * 1000).toISOString();
                } else if (existingState?.stateChangedAt) {
                    computedStateChangedAt = existingState.stateChangedAt;
                } else {
                    computedStateChangedAt = new Date(now).toISOString();
                }

                // === 120s Drift Protection ===
                // Avoid writing stateChangedAt when difference is within 120s of existing value
                // (SSH/SNMP latency can cause minor timing variations every poll cycle).
                const DRIFT_THRESHOLD_MS = 120 * 1000;
                if (existingState?.stateChangedAt && isUp) {
                    const existingMs = new Date(existingState.stateChangedAt).getTime();
                    const delta = Math.abs(new Date(computedStateChangedAt).getTime() - existingMs);
                    if (delta < DRIFT_THRESHOLD_MS) {
                        // Within drift window: keep existing stateChangedAt to avoid constant DB churn
                        computedStateChangedAt = existingState.stateChangedAt;
                    }
                }

                const currentStateObj = {
                    ...session,
                    stateChangedAt: computedStateChangedAt,
                    lastUpdated: new Date(now).toISOString(),
                };

                if (!existingState) {
                    await redis.hset(redisKey, 'data', JSON.stringify(currentStateObj));
                    continue;
                }

                const wasUp = existingState.bgpState === 'Established';

                if (wasUp && !isUp) {
                    // UP → DOWN: record event and reset stateChangedAt to now
                    await (prisma as any).historicalEvent.create({
                        data: {
                            tenantId,
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
                    const lastDownEvent = await (prisma as any).historicalEvent.findFirst({
                        where: {
                            tenantId,
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
                            tenantId,
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
        const storedKeys = await redis.keys(`BgpSession:${tenantId}:${device.hostname}:*`);
        const activeKeys = new Set(
            activeSessions.map((s) => `BgpSession:${tenantId}:${device.hostname}:${device.id}:${s.peerIp}`)
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
                        tenantId,
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

    console.log(`[${new Date().toISOString()}] [${tenantSlug}] Polling cycle complete.`);
}
