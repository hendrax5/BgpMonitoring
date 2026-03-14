import { BasePoller, BgpPeerState, BgpEventLog } from '../base';
import { SshPoller } from '../ssh';

export class MikrotikPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Mikrotik polling requires SSH credentials for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        
        // Try RouterOS v7 first, fall back to v6
        let output = '';
        try {
            output = await ssh.exec('/routing/bgp/session/print detail');
            if (!output.includes('remote.address') && !output.includes('remote-address')) {
                output = await ssh.exec('/routing bgp peer print detail');
            }
        } catch {
            output = await ssh.exec('/routing bgp peer print detail');
        }

        const peers: BgpPeerState[] = [];
        const blocks = output.split(/^\s*\d+\s+/m).filter(b => b.trim().length > 0);

        for (const block of blocks) {
            // Support both v6 (remote-address) and v7 (remote.address)
            const peerIpMatch = block.match(/remote[\.-]address=([a-fA-F0-9:.]+)/);
            const remoteAsnMatch = block.match(/remote[\.-]as=(\d+)/);
            const stateMatch = block.match(/state[=:]([a-zA-Z-]+)/i);
            const prefixCountMatch = block.match(/prefix-count=(\d+)/);
            const nameMatch = block.match(/name="?([^"\n]+)"?/);
            const commentMatch = block.match(/comment="?([^"\n]+)"?/);

            if (peerIpMatch && remoteAsnMatch && stateMatch) {
                const state = stateMatch[1].toLowerCase();
                peers.push({
                    peerIp: peerIpMatch[1],
                    remoteAsn: parseInt(remoteAsnMatch[1], 10),
                    bgpState: state === 'established' ? 'Established' : state,
                    acceptedPrefixes: prefixCountMatch ? parseInt(prefixCountMatch[1], 10) : 0,
                    advertisedPrefixes: 0,
                    description: nameMatch?.[1]?.trim() || commentMatch?.[1]?.trim() || undefined,
                });
            }
        }

        return peers;
    }

    override async fetchBgpLog(): Promise<BgpEventLog[]> {
        if (!this.device.sshCredential) return [];
        try {
            const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
            const output = await ssh.exec('/log print where topics~"bgp"');
            return parseMikrotikLog(output);
        } catch {
            return [];
        }
    }
}

function parseMikrotikLog(output: string): BgpEventLog[] {
    const events: BgpEventLog[] = [];
    const lines = output.split('\n');
    const ipRegex = /(\d+\.\d+\.\d+\.\d+)/;

    for (const line of lines) {
        if (!line.includes('bgp') && !line.includes('BGP')) continue;
        const ipMatch = line.match(ipRegex);
        let eventType: 'UP' | 'DOWN' | 'INFO' = 'INFO';
        if (line.toLowerCase().includes('established') || line.toLowerCase().includes('up')) eventType = 'UP';
        if (line.toLowerCase().includes('down') || line.toLowerCase().includes('idle') || line.toLowerCase().includes('reset')) eventType = 'DOWN';

        events.push({
            timestamp: new Date().toISOString(), // MikroTik log doesn't always have full date
            peerIp: ipMatch?.[1] || '',
            eventType,
            message: line.trim(),
        });
    }
    return events.slice(-30); // last 30
}
