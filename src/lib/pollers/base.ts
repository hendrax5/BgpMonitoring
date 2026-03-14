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
    uptime?: number; // In seconds, optional
}

export abstract class BasePoller {
    constructor(protected device: RouterWithCreds) {}

    /**
     * Executes the polling sequence (SNMP, SSH, or both) and returns
     * an array of normalized BGP peer states.
     */
    abstract poll(): Promise<BgpPeerState[]>;
}
