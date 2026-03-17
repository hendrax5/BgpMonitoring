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
     * Executes vendor-specific commands to fetch live BGP summary
     * Returns raw string output formatted for the frontend LiveEventPanel.
     */
    async fetchLiveSessions(): Promise<string> {
        return 'Live diagnostics not implemented for this vendor.';
    }

    /**
     * SNMP-only poll: builds full BgpPeerState[] from BGP4-MIB.
     * Use when SSH is unavailable or pollMethod = 'snmp'.
     * Requires snmpCommunity to be set on the device.
     */
    async pollSnmpOnly(): Promise<BgpPeerState[]> {
        if (!this.device.snmpCommunity) return [];
        const snmpPoller = new SnmpPoller(
            this.device.ipAddress,
            this.device.snmpCommunity,
            this.device.snmpVersion ?? 'v2c',
            this.device.snmpPort ?? 161
        );
        try {
            const peerMap = await snmpPoller.getBgpPeersFromMib();
            const peers: BgpPeerState[] = [];
            for (const [peerIp, s] of peerMap.entries()) {
                if (!s.remoteAsn) continue; // skip entries with no ASN (usually local router)
                peers.push({
                    peerIp,
                    remoteAsn:          s.remoteAsn,
                    bgpState:           s.bgpState,
                    acceptedPrefixes:   s.acceptedPrefixes  ?? 0,
                    advertisedPrefixes: s.advertisedPrefixes ?? 0,
                    uptime: s.bgpState === 'Established' ? s.uptime : undefined,
                });
            }
            return peers;
        } catch { return []; }
        finally { snmpPoller.close(); }
    }

    /**
     * HYBRID POLLING (SNMP + SSH)
     * SNMP for absolute true state and instant uptime (status cepat).
     * SSH for rich details like description, prefix limits, routing instances (detail).
     */
    async pollHybrid(): Promise<BgpPeerState[]> {
        if (this.device.pollMethod === 'snmp') {
            return await this.pollSnmpOnly();
        }
        if (this.device.pollMethod === 'ssh') {
            return await this.poll();
        }

        // --- Hybrid Execution (Parallel) ---
        const [snmpResult, sshResult] = await Promise.allSettled([
            this.device.snmpCommunity ? this.pollSnmpOnly() : Promise.resolve([]),
            this.poll()
        ]);

        let snmpPeers: BgpPeerState[] = snmpResult.status === 'fulfilled' ? snmpResult.value : [];
        let sshPeers: BgpPeerState[] = sshResult.status === 'fulfilled' ? sshResult.value : [];

        // If SNMP completely failed or MIB missing (0 peers), fallback purely to SSH
        if (snmpPeers.length === 0) {
            console.log(`⚠️ [${this.device.hostname}] SNMP returned 0 peers or failed. Falling back purely to SSH.`);
            if (sshResult.status === 'rejected') throw sshResult.reason;
            return sshPeers;
        }

        // If SSH completely failed, return whatever SNMP got
        if (sshPeers.length === 0) {
            console.log(`⚠️ [${this.device.hostname}] SSH failed or returned 0 peers. Using pure SNMP data.`);
            return snmpPeers;
        }

        // --- Merge SNMP and SSH ---
        // Create an O(1) map for SSH peers
        const sshMap = new Map<string, BgpPeerState>();
        for (const p of sshPeers) {
            sshMap.set(p.peerIp, p);
        }

        const merged: BgpPeerState[] = [];

        // Base peers array driven by SNMP truth
        for (const s of snmpPeers) {
            const sshPeer = sshMap.get(s.peerIp);
            
            // Merge logic: SNMP wins state and uptime, SSH wins descriptions and prefixes (if snmp lacks them)
            merged.push({
                peerIp: s.peerIp,
                remoteAsn: s.remoteAsn,
                bgpState: s.bgpState,
                uptime: s.bgpState === 'Established' ? s.uptime : undefined,
                
                // Inherit prefix counting from SNMP first, fallback to SSH detail
                acceptedPrefixes: s.acceptedPrefixes && s.acceptedPrefixes > 0 
                    ? s.acceptedPrefixes 
                    : (sshPeer?.acceptedPrefixes ?? 0),
                advertisedPrefixes: s.advertisedPrefixes && s.advertisedPrefixes > 0 
                    ? s.advertisedPrefixes 
                    : (sshPeer?.advertisedPrefixes ?? 0),
                    
                // Inherit text description from SSH
                description: sshPeer?.description,
            });

            // Remove from SSH map to keep track of any un-merged peers
            sshMap.delete(s.peerIp);
        }

        // If there are leftover SSH peers (hidden in VRF not seen by SNMP Default Community), add them too
        for (const leftover of sshMap.values()) {
            merged.push(leftover);
        }

        return merged;
    }
}
