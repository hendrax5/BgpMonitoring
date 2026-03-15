import { BasePoller, BgpPeerState, BgpEventLog, parseBgpUptime } from '../base';
import { SshPoller } from '../ssh';
import { parseFrrDescriptions, parseFrrPrefixSent, parseFrrLog } from './danos';

// VyOS uses FRRouting — same command structure as DanOS
export class VyosPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`VyOS polling requires SSH credentials for ${this.device.hostname}`);
        }
        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);

        const [summaryOutput, neighborOutput] = await Promise.all([
            ssh.exec('show bgp summary'),
            ssh.exec('show bgp neighbors').catch(() => ''),
        ]);

        const descMap = parseFrrDescriptions(neighborOutput);
        const sentMap = parseFrrPrefixSent(neighborOutput);
        const peers: BgpPeerState[] = [];
        let headerFound = false;

        for (const line of summaryOutput.split('\n')) {
            if (line.includes('Neighbor') && line.includes('State/PfxRcd')) { headerFound = true; continue; }
            if (!headerFound) continue;
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 9 && parts[0].match(/^[0-9.]+$/)) {
                const peerIp = parts[0];
                const remoteAsn = parseInt(parts[2], 10);
                const stateOrPfx = parts[parts.length - 1];
                // FRR: Neighbor V AS MsgRcvd MsgSent TblVer InQ OutQ Up/Down State/PfxRcd
                const upDownStr = parts[8] || '';
                let bgpState = 'Idle', acceptedPrefixes = 0;
                if (/^\d+$/.test(stateOrPfx)) { bgpState = 'Established'; acceptedPrefixes = parseInt(stateOrPfx, 10); }
                else { bgpState = stateOrPfx; }
                const uptime = bgpState === 'Established' ? (parseBgpUptime(upDownStr) || undefined) : undefined;
                peers.push({
                    peerIp, remoteAsn, bgpState, acceptedPrefixes,
                    advertisedPrefixes: sentMap.get(peerIp) ?? 0,
                    description: descMap.get(peerIp),
                    uptime,
                });
            }
        }
        return this.enrichWithSnmp(peers);
    }

    override async fetchBgpLog(): Promise<BgpEventLog[]> {
        if (!this.device.sshCredential) return [];
        try {
            const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
            const output = await ssh.exec('show log | match bgp');
            return parseFrrLog(output);
        } catch { return []; }
    }
}
