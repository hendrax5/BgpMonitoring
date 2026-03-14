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
