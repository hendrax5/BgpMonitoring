import { BasePoller, BgpPeerState } from '../base';
import { SshPoller } from '../ssh';

export class CiscoPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Cisco polling currently requires SSH credentials but none linked for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        const output = await ssh.exec('show ip bgp summary');
        
        const peers: BgpPeerState[] = [];
        
        // Cisco 'show ip bgp summary' typically looks like:
        // Neighbor        V           AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
        // 10.0.0.2        4        65000 123456  123455 1111111    0    0 1w2d          5000
        // 192.168.1.1     4        65001      0       0       0    0    0 00:00:00 Idle

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
