import { BasePoller, BgpPeerState } from '../base';
import { SshPoller } from '../ssh';

export class HuaweiPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Huawei polling requires SSH credentials but none linked for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        // Huawei typical command
        const output = await ssh.exec('display bgp peer');
        
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
                // Basic validation: IP, V, AS...
                if (parts.length >= 8 && parts[0].match(/^[0-9\.]+$/)) {
                    const peerIp = parts[0];
                    const remoteAsn = parseInt(parts[2], 10);
                    // Huawei output:
                    // 10.0.0.2        4       65001       10       10     0 00:10:00 Established       10
                    // The state is usually the second to last part, and PrefRcv is the last.
                    const stateStr = parts[parts.length - 2];
                    const prefixesStr = parts[parts.length - 1];

                    let bgpState = stateStr;
                    let acceptedPrefixes = 0;

                    if (stateStr.toLowerCase() === 'established') {
                        bgpState = 'Established';
                        acceptedPrefixes = parseInt(prefixesStr, 10);
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
