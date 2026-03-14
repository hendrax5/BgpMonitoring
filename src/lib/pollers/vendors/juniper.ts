import { BasePoller, BgpPeerState } from '../base';
import { SshPoller } from '../ssh';

export class JuniperPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Juniper polling requires SSH credentials but none linked for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        // Juniper command: show bgp summary
        const output = await ssh.exec('show bgp summary');
        
        const peers: BgpPeerState[] = [];
        const lines = output.split('\n');
        let headerFound = false;

        for (const line of lines) {
            if (line.includes('Peer') && line.includes('AS') && line.includes('State')) {
                headerFound = true;
                continue;
            }

            if (headerFound) {
                const parts = line.trim().split(/\s+/);
                // Basic validation: IP, AS...
                // JunOS output is like:
                // 192.168.1.1           65001         10         10       0       0       10:00 Establ
                if (parts.length >= 8 && parts[0].match(/^[0-9a-fA-F:\.]+$/)) {
                    const peerIp = parts[0];
                    const remoteAsn = parseInt(parts[1], 10);
                    const stateStr = parts[parts.length - 1]; // State is usually the last part on the main line

                    let bgpState = stateStr;
                    let acceptedPrefixes = 0;

                    // Juniper state is like "Establ" or "Active" or "Idle"
                    if (stateStr.startsWith('Establ')) {
                        bgpState = 'Established';
                    }
                    
                    peers.push({
                        peerIp,
                        remoteAsn,
                        bgpState,
                        acceptedPrefixes,
                        advertisedPrefixes: 0,
                    });
                }
            }
        }
        
        return peers;
    }
}
