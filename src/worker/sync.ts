import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const TELEGRAM_MOCK_LOG = true;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function lookupAsnName(asn: bigint): Promise<string> {
    // Check local dictionary cache first
    const cached = await prisma.asnDictionary.findUnique({ where: { asn } });

    // If we have a real org name (not just the fallback 'AS12345'), use it
    if (cached && !/^AS\d+$/.test(cached.organizationName)) {
        return cached.organizationName;
    }

    let orgName = `AS${asn}`;

    // Try RDAP (ARIN first, then RIPE as fallback)
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

    // Upsert into local cache (handles both new and stale retry)
    await prisma.asnDictionary.upsert({
        where: { asn },
        create: { asn, organizationName: orgName },
        update: { organizationName: orgName, lastUpdatedAt: new Date() },
    });

    return orgName;
}

export function sendTelegramAlert(type: 'DOWN' | 'UP', data: any, organizationName: string, duration?: number) {
    if (!TELEGRAM_MOCK_LOG) return;

    const icon = type === 'DOWN' ? '🚨' : '✅';
    const stateLabel = type === 'DOWN' ? 'DOWN' : 'RECOVERED';
    let message = `${icon} *BGP ${stateLabel}*\n`;
    message += `*Device:* ${data.deviceName} (${data.deviceIp})\n`;
    message += `*Peer IP:* ${data.peerIp}\n`;
    message += `*ASN:* ${data.remoteAsn} - *${organizationName}*\n`;

    const nowStr = new Date().toISOString();
    if (type === 'DOWN') {
        message += `*Time Down:* ${nowStr}\n`;
    } else {
        message += `*Time Up:* ${nowStr}\n`;
        if (duration !== undefined) {
            const mins = Math.floor(duration / 60);
            message += `*Total Downtime:* ${mins > 0 ? `${mins} Menit` : `${duration} Detik`}\n`;
        }
    }

    console.log('\n--- [Mock Telegram Message Scheduled] ---');
    console.log(message);
    console.log('-------------------------------------------\n');
}

export async function fetchLibreNmsDevices(apiUrl: string, apiToken: string) {
    try {
        const url = apiUrl.endsWith('/') ? `${apiUrl}devices` : `${apiUrl}/devices`;
        const res = await fetch(url, {
            headers: { 'X-Auth-Token': apiToken }
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        return data.devices || [];
    } catch (error) {
        console.warn(`\u26a0\ufe0f Could not fetch Devices.`, error);
        throw error;
    }
}

export async function fetchLibreNmsData(apiUrl: string, apiToken: string, serverName: string) {
    try {
        // 1. Fetch Devices mapping because BGP json might only contain device_id
        const devicesList = await fetchLibreNmsDevices(apiUrl, apiToken);
        const deviceMap = new Map();
        for (const d of devicesList) {
        deviceMap.set(d.device_id.toString(), {
                name: d.hostname,
                ip: d.ip || d.hostname,  // fallback: LibreNMS sometimes returns empty ip field
                description: d.sysDescr || d.hardware || d.purpose || null
            });
        }

        // 2. Fetch BGP Sessions
        const url = apiUrl.endsWith('/') ? `${apiUrl}bgp` : `${apiUrl}/bgp`;
        const res = await fetch(url, {
            headers: { 'X-Auth-Token': apiToken }
        });

        if (!res.ok) {
            throw new Error(`HTTP error fetching BGP! status: ${res.status}`);
        }
        const data = await res.json();

        // 3. Map to our internal schema
        const sessions = data.bgp_sessions || [];
        
        return sessions.reduce((acc: any[], b: any) => {
            const devInfo = deviceMap.get(b.device_id?.toString());
            
            // If device exists in `/bgp` but NO LONGER exists in `/devices`,
            // skip it so it is treated as stale and gets removed from the local DB.
            if (!devInfo) {
                return acc;
            }

            acc.push({
                serverName: serverName,
                deviceId: parseInt(b.device_id, 10),
                deviceName: devInfo.name,
                deviceDescription: devInfo.description || null,
                deviceIp: devInfo.ip,
                peerIp: b.bgpPeerIdentifier,
                remoteAsn: b.bgpPeerRemoteAs,
                bgpState: b.bgpPeerState === 'established' ? 'Established' : b.bgpPeerState,
                acceptedPrefixes: parseInt(b.bgpPeerInUpdates || '0', 10),
                advertisedPrefixes: parseInt(b.bgpPeerOutUpdates || '0', 10)
            });
            return acc;
        }, []);

    } catch (error: any) {
        console.warn(`\u26a0\ufe0f Could not complete LibreNMS API requests (${serverName}). Error:`, error.message);
        return null;
    }
}

export async function forceSyncLibreNMS(triggeredBy: string = 'Worker') {
    console.log(`[${new Date().toISOString()}] Starting BGP ${triggeredBy} synchronization via REST API...`);

    // Fetch servers dynamically from database
    let servers: any[] = [];
    try {
        servers = await prisma.librenmsServer.findMany();
    } catch (e) {
        console.error("⚠️ Failed to load servers from database.", e);
    }

    if (servers.length === 0) {
        console.warn("⚠️ No LibreNMS targets configured in the Database. Please add one via the Settings UI.");

        // Developer Fallback (Backward compatibility)
        if (process.env.LIBRENMS_DB_URL) {
            console.log("Using fallback LIBRENMS_DB_URL from .env");
            servers = [{ name: 'Default', dbUrl: process.env.LIBRENMS_DB_URL }];
        } else {
            return; // Exit cycle
        }
    }

    for (const srv of servers) {
        console.log(`\n\ud83d\udd04 Syncing Server via API: ${srv.name}`);
        const activeSessions = await fetchLibreNmsData(srv.apiUrl, srv.apiToken, srv.name);

        if (activeSessions === null) {
            console.log(`\u23ed\ufe0f Skipping sync & cleanup for ${srv.name} due to API error.`);
            continue;
        }

        for (const session of activeSessions) {
            const isUp = session.bgpState === 'Established';
            const orgName = await lookupAsnName(session.remoteAsn);
            const redisKey = `BgpSession:${session.serverName}:${session.deviceId}:${session.peerIp}`;

            try {
                // Check previous known state in Redis cache
                const existingStateStr = await redis.hget(redisKey, 'data');
                const existingState = existingStateStr ? JSON.parse(existingStateStr) : null;

                const currentStateObj = {
                    ...session,
                    stateChangedAt: existingState?.stateChangedAt || new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                };

                if (!existingState) {
                    // First time seeing this session, just store it in Redis
                    await redis.hset(redisKey, 'data', JSON.stringify(currentStateObj));
                    continue;
                }

                // Determine state transition
                const wasUp = existingState.bgpState === 'Established';

                if (wasUp && !isUp) {
                    // TRANSITION: UP -> DOWN
                    await prisma.historicalEvent.create({
                        data: {
                            serverName: session.serverName,
                            eventTimestamp: new Date(),
                            deviceName: session.deviceName,
                            deviceIp: session.deviceIp,
                            peerIp: session.peerIp,
                            asn: session.remoteAsn,
                            organizationName: orgName,
                            eventType: 'DOWN'
                        }
                    });
                    sendTelegramAlert('DOWN', session, orgName);
                    currentStateObj.stateChangedAt = new Date().toISOString();
                }
                else if (!wasUp && isUp) {
                    // TRANSITION: DOWN -> UP
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

                    await prisma.historicalEvent.create({
                        data: {
                            serverName: session.serverName,
                            eventTimestamp: new Date(),
                            deviceName: session.deviceName,
                            deviceIp: session.deviceIp,
                            peerIp: session.peerIp,
                            asn: session.remoteAsn,
                            organizationName: orgName,
                            eventType: 'UP',
                            downEventId,
                            downtimeDuration
                        }
                    });
                    sendTelegramAlert('UP', session, orgName, downtimeDuration ?? undefined);
                     currentStateObj.stateChangedAt = new Date().toISOString();
                }

                // Update Current State Cache in Redis
                await redis.hset(redisKey, 'data', JSON.stringify(currentStateObj));
            } catch (err: any) {
                console.error(`\u274c Redis/DB error while processing session for ${session.deviceName} (${session.peerIp}):`, err.message);
            }
            // Sleep briefly to yield SQLite lock (for history events) to the main web process
            await sleep(20);
        }

        // --- Cleanup: Remove stale sessions from Redis ---
        // Find all stored sessions for this server in Redis
        const storedKeys = await redis.keys(`BgpSession:${srv.name}:*`);

        // Build a Map of active keys from LibreNMS response for quick lookup
        const activeKeys = new Set(
            activeSessions.map((s: any) => `BgpSession:${s.serverName}:${s.deviceId}:${s.peerIp}`)
        );

        // Identify keys in Redis that are no longer reported by LibreNMS
        const staleKeys = storedKeys.filter(key => !activeKeys.has(key));

        if (staleKeys.length > 0) {
            await redis.del(...staleKeys);
            console.log(`\ud83d\uddd1\ufe0f  Removed ${staleKeys.length} stale session(s) from Redis for ${srv.name}.`);
            for (const k of staleKeys) {
                console.log(`   - ${k}`);
            }
        }

        console.log(`\u2705 Completed ${srv.name}: Processed ${activeSessions.length} sessions.`);
    }

    console.log(`[${new Date().toISOString()}] Synchronization ${triggeredBy} cycle complete.`);
}
