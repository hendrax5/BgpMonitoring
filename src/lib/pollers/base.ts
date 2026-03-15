import { RouterDevice, DeviceCredential } from '@prisma/client';

export type RouterWithCreds = RouterDevice & {
    sshCredential?: DeviceCredential | null;
};

export interface BgpPeerState {
    peerIp: string;
    remoteAsn: number;
    bgpState: string; // "Established", "Connect", "Idle", "Active", "Down"
    acceptedPrefixes: number;
    advertisedPrefixes: number;
    uptime?: number;        // In seconds, optional
    description?: string;   // Peer name/description configured on router
}

export interface BgpEventLog {
    timestamp: string;      // ISO string or router-formatted
    peerIp: string;
    eventType: 'UP' | 'DOWN' | 'INFO';
    message: string;
}

export abstract class BasePoller {
    constructor(protected device: RouterWithCreds) {}

    /**
     * Executes the polling sequence (SNMP, SSH, or both) and returns
     * an array of normalized BGP peer states.
     */
    abstract poll(): Promise<BgpPeerState[]>;

    /**
     * Fetch recent BGP state change logs from the device via SSH.
     * Optional — base implementation returns empty array (graceful fallback).
     */
    async fetchBgpLog(): Promise<BgpEventLog[]> {
        return [];
    }
}

/**
 * Parses common BGP uptime strings into total seconds.
 * Handles:
 * - "1d2h3m4s", "01:20:30", "5w3d", "00:05:10", "never"
 */
export function parseBgpUptime(uptimeStr: string | undefined): number {
    if (!uptimeStr) return 0;
    const str = uptimeStr.trim().toLowerCase();
    if (str === 'never' || str.includes('never')) return 0;

    // Format: 01:20:30 (HH:MM:SS)
    if (/^\d{2,}:\d{2}:\d{2}$/.test(str)) {
        const parts = str.split(':').map(Number);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
    }

    // Format: 1w2d3h4m5s
    let totalSeconds = 0;
    const regex = /(\d+)\s*([wdhms])/g;
    let match;
    let matchedSomething = false;

    while ((match = regex.exec(str)) !== null) {
        matchedSomething = true;
        const val = parseInt(match[1], 10);
        const unit = match[2];
        if (unit === 'w') totalSeconds += val * 604800;
        else if (unit === 'd') totalSeconds += val * 86400;
        else if (unit === 'h') totalSeconds += val * 3600;
        else if (unit === 'm') totalSeconds += val * 60;
        else if (unit === 's') totalSeconds += val;
    }

    if (matchedSomething) return totalSeconds;

    return 0; // Unparseable
}
