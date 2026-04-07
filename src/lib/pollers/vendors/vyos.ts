import { BasePoller, BgpPeerState, BgpEventLog, parseBgpUptime } from '../base';
import { createCliPoller as SshPoller } from '../cli';
import { parseFrrDescriptions, parseFrrPrefixSent, parseFrrLog } from './danos';

// VyOS uses FRRouting — same command structure as DanOS
export class VyosPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`VyOS polling requires SSH credentials for ${this.device.hostname}`);
        }
        const ssh = SshPoller(this.device.ipAddress, this.device.sshCredential, this.device.pollMethod);

        const [summaryOutput, neighborOutput] = await Promise.all([
            ssh.exec('vtysh -c "show bgp summary"').catch(() => ssh.exec('vtysh -c "show ip bgp summary"')),
            ssh.exec('vtysh -c "show bgp neighbors"').catch(() => ssh.exec('vtysh -c "show ip bgp neighbors"')).catch(() => ''),
        ]);

        const descMap = parseFrrDescriptions(neighborOutput);
        const sentMap = parseFrrPrefixSent(neighborOutput);
        const peers: BgpPeerState[] = [];
        let headerFound = false;

        for (const line of summaryOutput.split('\n')) {
            if (line.includes('Neighbor') && line.includes('State/PfxRcd')) { headerFound = true; continue; }
            if (!headerFound) continue;
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 10 && parts[0].match(/^[0-9.]+$/)) {
                const peerIp = parts[0];
                const remoteAsn = parseInt(parts[2], 10);
                
                const upDownStr = parts[8] || '';
                const stateOrPfx = parts[9] || '';

                let bgpState = 'Idle', acceptedPrefixes = 0;
                if (/^\d+$/.test(stateOrPfx)) { 
                    bgpState = 'Established'; 
                    acceptedPrefixes = parseInt(stateOrPfx, 10); 
                } else { 
                    bgpState = stateOrPfx.replace(/[^a-zA-Z]/g, ''); 
                }
                const uptime = bgpState === 'Established' ? (parseBgpUptime(upDownStr) || undefined) : undefined;
                peers.push({
                    peerIp, remoteAsn, bgpState, acceptedPrefixes,
                    advertisedPrefixes: sentMap.get(peerIp) ?? 0,
                    description: descMap.get(peerIp),
                    uptime,
                });
            }
        }
        return peers;
    }

    override async fetchBgpLog(): Promise<BgpEventLog[]> {
        if (!this.device.sshCredential) return [];
        try {
            const ssh = SshPoller(this.device.ipAddress, this.device.sshCredential, this.device.pollMethod);
            let output = await ssh.exec('vtysh -c "show log | match bgp"').catch(() => '');
            if (!output) output = await ssh.exec('cat /var/log/messages | grep bgp').catch(() => '');
            return parseFrrLog(output);
        } catch { return []; }
    }

    override async fetchLiveSessions(): Promise<string> {
        if (!this.device.sshCredential) return 'Error: No SSH Credentials';
        try {
            const ssh = SshPoller(this.device.ipAddress, this.device.sshCredential, this.device.pollMethod);
            return await ssh.exec('vtysh -c "show bgp summary"').catch(() => ssh.exec('vtysh -c "show ip bgp summary"'));
        } catch (err: any) {
            return `Error fetching live sessions: ${err.message}`;
        }
    }
}
