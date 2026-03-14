import { RouterDevice, DeviceCredential } from '@prisma/client';
import { SnmpPoller } from './snmp';

export type RouterWithCreds = RouterDevice & {
    sshCredential?: DeviceCredential | null;
};

export interface BgpPeerState {
    peerIp: string;
    remoteAsn: number;
    bgpState: string;         // "Established", "Connect", "Idle", "Active", "Down"
    acceptedPrefixes: number;
    advertisedPrefixes: number;
    uptime?: number;          // Seconds from SNMP bgpPeerFsmEstablishedTime (preferred) or SSH
    description?: string;     // Peer name/description configured on router
}

export interface BgpEventLog {
    timestamp: string;
    peerIp: string;
    eventType: 'UP' | 'DOWN' | 'INFO';
    message: string;
}

export abstract class BasePoller {
    constructor(protected device: RouterWithCreds) {}

    abstract poll(): Promise<BgpPeerState[]>;

    async fetchBgpLog(): Promise<BgpEventLog[]> {
        return [];
    }

    /**
     * Enrich SSH-parsed peer states with SNMP BGP4-MIB data.
     * - Uptime: always overridden by SNMP bgpPeerFsmEstablishedTime (exact established time)
     * - Prefix counts: SNMP bgpPeerInUpdates/OutUpdates used only as fallback when SSH = 0
     *   (SSH parsing is more accurate for prefix counts on most vendors)
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
                if (s.uptime !== undefined) peer.uptime = s.uptime;
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
