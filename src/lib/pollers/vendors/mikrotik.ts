import { BasePoller, BgpPeerState } from '../base';
import { SshPoller } from '../ssh';

export class MikrotikPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Mikrotik polling currently requires SSH credentials but none linked for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        // Supports RouterOS v6. v7 might use `/routing/bgp/connection/print detail`
        const output = await ssh.exec('/routing bgp peer print detail');
        
        const peers: BgpPeerState[] = [];
        
        // This is a simplified regex parser for MikroTik BGP peer output
        // Production regex would handle v6 and v7 differences gracefully
        const blocks = output.split(/^\s*\d+\s+/m).filter(b => b.trim().length > 0);

        for (const block of blocks) {
            const peerIpMatch = block.match(/remote-address=([a-fA-F0-9\.:]+)/);
            const remoteAsnMatch = block.match(/remote-as=(\d+)/);
            const stateMatch = block.match(/state=([\w-]+)/);
            const prefixCountMatch = block.match(/prefix-count=(\d+)/);

            if (peerIpMatch && remoteAsnMatch && stateMatch) {
                peers.push({
                    peerIp: peerIpMatch[1],
                    remoteAsn: parseInt(remoteAsnMatch[1], 10),
                    bgpState: stateMatch[1].toLowerCase() === 'established' ? 'Established' : stateMatch[1],
                    acceptedPrefixes: prefixCountMatch ? parseInt(prefixCountMatch[1], 10) : 0,
                    advertisedPrefixes: 0, // MikroTik CLI doesn't easily expose this here without another command
                    uptime: 0
                });
            }
        }
        
        return peers;
    }
}
