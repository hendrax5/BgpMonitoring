import { BasePoller, BgpPeerState, BgpEventLog } from '../base';
import { SshPoller } from '../ssh';
import { parseFrrDescriptions, parseFrrLog } from './danos';

// VyOS uses FRRouting — same command structure as DanOS
export class VyosPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`VyOS polling requires SSH credentials for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        const summaryOutput = await ssh.exec('show bgp summary');
        const neighborsOutput = await ssh.exec('show bgp neighbors').catch(() => '');
        const descMap = parseFrrDescriptions(neighborsOutput);

        const peers: BgpPeerState[] = [];
        const lines = summaryOutput.split('\n');
        let headerFound = false;

        for (const line of lines) {
            if (line.includes('Neighbor') && line.includes('State/PfxRcd')) {
                headerFound = true;
                continue;
            }
            if (headerFound) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 9 && parts[0].match(/^[0-9.]+$/)) {
                    const peerIp = parts[0];
                    const remoteAsn = parseInt(parts[2], 10);
                    const stateOrPfx = parts[parts.length - 1];
                    let bgpState = 'Idle';
                    let acceptedPrefixes = 0;

                    if (/^\d+$/.test(stateOrPfx)) {
                        bgpState = 'Established';
                        acceptedPrefixes = parseInt(stateOrPfx, 10);
                    } else {
                        bgpState = stateOrPfx;
                    }

                    peers.push({
                        peerIp, remoteAsn, bgpState, acceptedPrefixes, advertisedPrefixes: 0,
                        description: descMap.get(peerIp),
                    });
                }
            }
        }
        return peers;
    }

    override async fetchBgpLog(): Promise<BgpEventLog[]> {
        if (!this.device.sshCredential) return [];
        try {
            const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
            const output = await ssh.exec('show log | match bgp');
            return parseFrrLog(output);
        } catch {
            return [];
        }
    }
}
