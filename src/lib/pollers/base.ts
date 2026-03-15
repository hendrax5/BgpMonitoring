import { RouterDevice, DeviceCredential } from '@prisma/client';
import { SnmpPoller } from './snmp';

export type RouterWithCreds = RouterDevice & {
    sshCredential?: DeviceCredential | null;
};

export interface BgpPeerState {
    peerIp: string;
    remoteAsn: number;
    bgpState: string;
    acceptedPrefixes: number;
    advertisedPrefixes: number;
    uptime?: number;       // total seconds the BGP session has been Established
    description?: string;
}

export interface BgpEventLog {
    timestamp: string;
    peerIp: string;
    eventType: 'UP' | 'DOWN' | 'INFO';
    message: string;
}

/**
 * Unified BGP uptime string → total seconds converter.
 * Handles all vendor formats:
 *   hh:mm:ss              → "01:20:30"      (Cisco, Huawei, Juniper)
 *   Xw Xd Xh Xm Xs       → "1w2d3h4m5s"   (MikroTik RouterOS)
 *   Xd Xh Xm Xs           → "1d2h3m"        (MikroTik RouterOS v6)
 *   Xm Xs                 → "5m10s"
 *   ISO-like (never/idle) → returns 0
 */
export function parseBgpUptime(uptimeStr: string): number {
    if (!uptimeStr || uptimeStr === 'never' || uptimeStr === 'idle') return 0;

    // Format hh:mm:ss or h:mm:ss (Cisco/Huawei/Juniper)
    const hms = uptimeStr.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (hms) {
        return parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3]);
    }

    // Format Xd Xh Xm Xs with optional weeks (MikroTik, DanOS)
    let secs = 0;
    const w = uptimeStr.match(/(\d+)w/); if (w) secs += parseInt(w[1]) * 604800;
    const d = uptimeStr.match(/(\d+)d/); if (d) secs += parseInt(d[1]) * 86400;
    const h = uptimeStr.match(/(\d+)h/); if (h) secs += parseInt(h[1]) * 3600;
    const m = uptimeStr.match(/(\d+)m/); if (m) secs += parseInt(m[1]) * 60;
    const s = uptimeStr.match(/(\d+)s/); if (s) secs += parseInt(s[1]);

    return secs;
}

export abstract class BasePoller {
    constructor(protected device: RouterWithCreds) {}

    abstract poll(): Promise<BgpPeerState[]>;

    async fetchBgpLog(): Promise<BgpEventLog[]> {
        return [];
    }

    /**
     * Enrich SSH-parsed peer states with SNMP BGP4-MIB data.
     * - Uptime: SNMP bgpPeerFsmEstablishedTime overrides SSH only if SSH uptime is missing.
     *   (SSH uptime is now extracted directly — use it as primary, SNMP as fallback)
     * - Prefix counts: SNMP only as fallback when SSH = 0
     */
    protected async enrichWithSnmp(peers: BgpPeerState[]): Promise<BgpPeerState[]> {
        if (!this.device.snmpCommunity || !peers.length) return peers;
        const snmpPoller = new SnmpPoller(
            this.device.ipAddress,
            this.device.snmpCommunity,
            this.device.snmpVersion ?? 'v2c',
            this.device.snmpPort ?? 161
        );
        try {
            const stats = await snmpPoller.getBgpPeerStats();
            for (const peer of peers) {
                const s = stats.get(peer.peerIp);
                if (!s) continue;
                // Use SNMP uptime only when SSH did not provide one
                if (peer.uptime === undefined && s.uptime !== undefined) peer.uptime = s.uptime;
                if (peer.acceptedPrefixes === 0 && s.acceptedPrefixes !== undefined)
                    peer.acceptedPrefixes = s.acceptedPrefixes;
                if (peer.advertisedPrefixes === 0 && s.advertisedPrefixes !== undefined)
                    peer.advertisedPrefixes = s.advertisedPrefixes;
            }
        } catch { /* SNMP unreachable — keep SSH values */ }
        finally { snmpPoller.close(); }
        return peers;
    }
}
