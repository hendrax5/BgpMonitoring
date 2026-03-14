import { BasePoller, BgpPeerState, BgpEventLog } from '../base';
import { SshPoller } from '../ssh';

export class JuniperPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Juniper polling requires SSH credentials for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        const summaryOutput = await ssh.exec('show bgp summary');
        const neighborsOutput = await ssh.exec('show bgp neighbor | match "(Peer:|Description:)"').catch(() => '');
        const descMap = parseJuniperDescriptions(neighborsOutput);

        const peers: BgpPeerState[] = [];
        const lines = summaryOutput.split('\n');
        let headerFound = false;

        for (const line of lines) {
            if (line.includes('Peer') && line.includes('AS') && line.includes('State')) {
                headerFound = true;
                continue;
            }
            if (headerFound) {
                const parts = line.trim().split(/\s+/);
                // JunOS: 192.168.1.1  65001  10  10  0  0  10:00  Establ
                if (parts.length >= 8 && parts[0].match(/^[0-9a-fA-F:.]+$/)) {
                    const peerIp = parts[0];
                    const remoteAsn = parseInt(parts[1], 10);
                    const stateStr = parts[parts.length - 1];
                    const bgpState = stateStr.startsWith('Establ') ? 'Established' : stateStr;

                    peers.push({
                        peerIp, remoteAsn, bgpState,
                        acceptedPrefixes: 0, advertisedPrefixes: 0,
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
            const output = await ssh.exec('show log messages | match BGP | last 30');
            return parseJuniperLog(output);
        } catch {
            return [];
        }
    }
}

function parseJuniperDescriptions(output: string): Map<string, string> {
    const map = new Map<string, string>();
    let currentIp = '';
    for (const line of output.split('\n')) {
        const peerMatch = line.match(/Peer:\s+([\d.a-fA-F:]+)/);
        const descMatch = line.match(/Description:\s*(.+)/);
        if (peerMatch) currentIp = peerMatch[1];
        if (descMatch && currentIp) map.set(currentIp, descMatch[1].trim());
    }
    return map;
}

function parseJuniperLog(output: string): BgpEventLog[] {
    const events: BgpEventLog[] = [];
    for (const line of output.split('\n')) {
        if (!line.trim()) continue;
        const ipMatch = line.match(/([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})/);
        let eventType: 'UP' | 'DOWN' | 'INFO' = 'INFO';
        const lower = line.toLowerCase();
        if (lower.includes('established') || lower.includes('up')) eventType = 'UP';
        if (lower.includes('down') || lower.includes('ceased') || lower.includes('idle')) eventType = 'DOWN';
        events.push({ timestamp: new Date().toISOString(), peerIp: ipMatch?.[1] || '', eventType, message: line.trim() });
    }
    return events.slice(-30);
}
