import dgram from 'dgram';
import { prisma } from '../lib/prisma';
import { RouterDevice } from '@prisma/client';

const SYSLOG_PORT = 514;

// 1. Fast-Path Regex (O(1) string check before allocating heavy objects)
const BGP_KEYWORDS = ['BGP', 'BGP_PEER_UP', 'BGP-5-ADJCHANGE', 'BGP-4-MESSAGE'];
function isBgpMsg(msg: string) {
    for (const kw of BGP_KEYWORDS) {
        if (msg.includes(kw)) return true;
    }
    return false;
}

// Memory Buffer for Bulk Insert
interface BufferEvent {
    tenantId: number;
    deviceId: number;
    deviceName: string;
    peerIp: string;
    eventType: 'UP' | 'DOWN' | 'INFO';
    message: string;
    eventTimestamp: Date;
}
let eventBuffer: BufferEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// Flush buffer to Database (Bulk Insert)
async function flushEvents() {
    if (eventBuffer.length === 0) return;
    
    // Swap buffer to allow concurrent receiving while inserting
    const toInsert = eventBuffer;
    eventBuffer = [];
    
    try {
        await (prisma as any).historicalEvent.createMany({
            data: toInsert,
            skipDuplicates: true // Avoid exact duplicate spam within the same second
        });
        console.log(`[Syslog] Bulk inserted ${toInsert.length} BGP events to database.`);
    } catch (err) {
        console.error('[Syslog] Failed to bulk insert events:', err);
    }
}

function queueEvent(event: BufferEvent) {
    eventBuffer.push(event);
    if (!flushTimer) {
        // Debounce window: wait 2 seconds to gather as many logs as possible before hitting DB
        flushTimer = setTimeout(() => {
            flushTimer = null;
            flushEvents();
        }, 2000);
    }
}

// IP caching to avoid querying DB for every single UDP packet
let ipToDeviceCache: Map<string, RouterDevice> = new Map();
let lastCacheUpdate = 0;

async function getDeviceByIp(ip: string): Promise<any | undefined> {
    const now = Date.now();
    if (now - lastCacheUpdate > 60000 || ipToDeviceCache.size === 0) {
        const routers = await (prisma as any).routerDevice.findMany();
        ipToDeviceCache.clear();
        routers.forEach((r: any) => ipToDeviceCache.set(r.ipAddress, r));
        lastCacheUpdate = now;
    }
    return ipToDeviceCache.get(ip);
}

/** Parses raw syslog string to extract BGP Event information */
function parseBgpSyslog(msg: string): { peerIp: string, eventType: 'UP' | 'DOWN' | 'INFO' } | null {
    // MikroTik / Standard Syslog Match: "BGP peer 103.134.186.76 state changed to Established"
    const peerMatch = msg.match(/[P|p]eer\s+([0-9\.]+)/) || msg.match(/neighbor\s+([0-9\.]+)/);
    const peerIp = peerMatch ? peerMatch[1] : 'Unknown';
    
    let eventType: 'UP' | 'DOWN' | 'INFO' = 'INFO';
    const lowerMsg = msg.toLowerCase();
    
    if (lowerMsg.includes('up') || lowerMsg.includes('established')) eventType = 'UP';
    else if (lowerMsg.includes('down') || lowerMsg.includes('idle') || lowerMsg.includes('active') || lowerMsg.includes('closed')) eventType = 'DOWN';
    
    return { peerIp, eventType };
}

export function startSyslogServer() {
    const server = dgram.createSocket('udp4');

    server.on('error', (err) => {
        console.error(`[Syslog] Server error:\n${err.stack}`);
        server.close();
    });

    server.on('message', async (msgBuffer, rinfo) => {
        const msgStr = msgBuffer.toString('utf8');

        // OPTIMIZATION 1: Fast-path kill switch for non-BGP logs
        if (!isBgpMsg(msgStr)) return;

        // Origin IP of the router sending the syslog
        const senderIp = rinfo.address;
        
        // Find router in DB Cache
        const device = await getDeviceByIp(senderIp);
        if (!device) return; // Ignore logs from unregistered IPs

        const parsed = parseBgpSyslog(msgStr);
        if (!parsed) return;

        // Remove syslog headers (like <190>date hostname) to clean up message for UI
        const cleanMsg = msgStr.replace(/^<[0-9]+>.*?(bgp|BGP)/i, 'BGP').trim();

        // OPTIMIZATION 3: Queue to memory array, don't hit DB immediately
        queueEvent({
            tenantId: device.tenantId,
            deviceId: device.id,
            deviceName: device.hostname,
            peerIp: parsed.peerIp,
            eventType: parsed.eventType,
            message: cleanMsg.substring(0, 255), // safety limit
            eventTimestamp: new Date()
        });
    });

    server.on('listening', () => {
        const address = server.address();
        console.log(`📡 [Syslog] Background Listener started on UDP ${address.address}:${address.port}`);
    });

    server.bind(SYSLOG_PORT);
}
