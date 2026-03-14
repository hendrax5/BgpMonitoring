import { BasePoller, BgpPeerState } from '../base';
import { SshPoller } from '../ssh';

export class VyosPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`VyOS polling requires SSH credentials but none linked for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        // VyOS uses FRR 
        // A common command is `show ip bgp summary` or `show bgp summary`
        const output = await ssh.exec('show ip bgp summary');
        
        const peers: BgpPeerState[] = [];
        const lines = output.split('\n');
        let headerFound = false;

        for (const line of lines) {
            if (line.includes('Neighbor') && line.includes('State/PfxRcd')) {
                headerFound = true;
                continue;
            }

            if (headerFound) {
                const parts = line.trim().split(/\s+/);
                // Basic validation: IP, V, AS...
                if (parts.length >= 10 && parts[0].match(/^[0-9\.]+$/)) {
                    const peerIp = parts[0];
                    const remoteAsn = parseInt(parts[2], 10);
                    const stateOrPfx = parts[9];

                    let bgpState = 'Idle';
                    let acceptedPrefixes = 0;

                    if (/^\d+$/.test(stateOrPfx)) {
                        bgpState = 'Established';
                        acceptedPrefixes = parseInt(stateOrPfx, 10);
                    } else {
                        bgpState = stateOrPfx;
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
