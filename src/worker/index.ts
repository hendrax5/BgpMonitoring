import cron from 'node-cron';
import { prisma } from '../lib/prisma';

// Configuration
const CRON_SCHEDULE = '*/1 * * * *'; // Every minute for development (change to */5 for production)
const TELEGRAM_MOCK_LOG = true;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));



async function lookupAsnName(asn: bigint): Promise<string> {
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

function sendTelegramAlert(type: 'DOWN' | 'UP', data: any, organizationName: string, duration?: number) {
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

async function fetchLibreNmsDevices(apiUrl: string, apiToken: string) {
    try {
        const url = apiUrl.endsWith('/') ? `${apiUrl}devices` : `${apiUrl}/devices`;
        const res = await fetch(url, {
            headers: { 'X-Auth-Token': apiToken }
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        return data.devices || [];
    } catch (error) {
        console.warn(`⚠️ Could not fetch Devices.`, error);
        return [];
    }
}

async function fetchLibreNmsData(apiUrl: string, apiToken: string, serverName: string) {
    try {
        // 1. Fetch Devices mapping because BGP json might only contain device_id
        const devicesList = await fetchLibreNmsDevices(apiUrl, apiToken);
        const deviceMap = new Map();
        for (const d of devicesList) {
            deviceMap.set(d.device_id.toString(), {
                name: d.hostname,
                ip: d.ip,
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
        return sessions.map((b: any) => {
            const devInfo = deviceMap.get(b.device_id?.toString()) || { name: 'Unknown Device', ip: '0.0.0.0' };

            return {
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
            };
        });

    } catch (error: any) {
        console.warn(`⚠️ Could not complete LibreNMS API requests (${serverName}). Error:`, error.message);
        return [];
    }
}

async function runWorker() {
    console.log(`[${new Date().toISOString()}] Starting BGP Worker synchronization via REST API...`);

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
        console.log(`\n🔄 Syncing Server via API: ${srv.name}`);
        const activeSessions = await fetchLibreNmsData(srv.apiUrl, srv.apiToken, srv.name);

        for (const session of activeSessions) {
            const isUp = session.bgpState === 'Established';
            const orgName = await lookupAsnName(session.remoteAsn);

            try {
                // Check previous known state in cache
                const existingState = await prisma.bgpCurrentState.findUnique({
                    where: {
                        serverName_deviceId_peerIp: {
                            serverName: session.serverName,
                            deviceId: session.deviceId,
                            peerIp: session.peerIp
                        }
                    }
                });

            if (!existingState) {
                // First time seeing this session, just store it
                await prisma.bgpCurrentState.create({
                    data: {
                        ...session,
                        stateChangedAt: new Date(),
                        lastUpdated: new Date()
                    }
                });
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
            }
            else if (!wasUp && isUp) {
                // TRANSITION: DOWN -> UP
                // Find the last DOWN event to calc duration
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
            }

                // Update Current State Cache
                await prisma.bgpCurrentState.update({
                    where: { id: existingState.id },
                    data: {
                        bgpState: session.bgpState,
                        acceptedPrefixes: session.acceptedPrefixes,
                        advertisedPrefixes: session.advertisedPrefixes,
                        stateChangedAt: existingState.bgpState !== session.bgpState ? new Date() : existingState.stateChangedAt,
                        lastUpdated: new Date()
                    }
                });
            } catch (err: any) {
                if (err.code === 'P2002') {
                    console.warn(`⚠️ Skipped duplicate BGP session in API payload for ${session.deviceName} (${session.peerIp})`);
                } else {
                    console.error(`❌ DB error while processing session for ${session.deviceName} (${session.peerIp}):`, err.message);
                }
            }
            // Sleep briefly to yield SQLite lock to the main web process
            await sleep(20);
        }
        console.log(`✅ Completed ${srv.name}: Processed ${activeSessions.length} sessions.`);
    }

    console.log(`[${new Date().toISOString()}] Synchronization master cycle complete.`);
}

// Start Cron
console.log(`BGP Worker started with schedule: ${CRON_SCHEDULE}`);
cron.schedule(CRON_SCHEDULE, runWorker);

// Run immediately on boot
runWorker();
