import { BasePoller, BgpPeerState } from '../base';
import { SshPoller } from '../ssh';

export class DanosPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`DanOS polling requires SSH credentials but none linked for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        // DanOS typically uses FRRouting/Quagga style commands
        const output = await ssh.exec('show bgp summary');
        
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
                if (parts.length >= 10 && parts[0].match(/^[0-9a-fA-F:\.]+$/)) {
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
