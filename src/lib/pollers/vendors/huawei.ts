import { BasePoller, BgpPeerState, BgpEventLog } from '../base';
import { SshPoller } from '../ssh';

export class HuaweiPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Huawei polling requires SSH credentials for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        const summaryOutput = await ssh.exec('display bgp peer');
        // Get descriptions separately
        const detailOutput = await ssh.exec('display bgp peer verbose').catch(() => '');
        const descMap = parseHuaweiDescriptions(detailOutput);

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
                // Huawei: 10.0.0.2  4  65001  10  10  0  00:10:00  Established  10
                if (parts.length >= 8 && parts[0].match(/^[0-9.]+$/)) {
                    const peerIp = parts[0];
                    const remoteAsn = parseInt(parts[2], 10);
                    const stateStr = parts[parts.length - 2];
                    const prefixesStr = parts[parts.length - 1];
                    const bgpState = stateStr.toLowerCase() === 'established' ? 'Established' : stateStr;
                    const acceptedPrefixes = bgpState === 'Established' ? parseInt(prefixesStr, 10) || 0 : 0;

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
            const output = await ssh.exec('display logbuffer match BGP');
            return parseHuaweiLog(output);
        } catch {
            return [];
        }
    }
}

function parseHuaweiDescriptions(output: string): Map<string, string> {
    const map = new Map<string, string>();
    let currentIp = '';
    for (const line of output.split('\n')) {
        const peerMatch = line.match(/BGP peer is ([\d.a-fA-F:]+)/);
        const descMatch = line.match(/Peer description:\s*(.+)/);
        if (peerMatch) currentIp = peerMatch[1];
        if (descMatch && currentIp) map.set(currentIp, descMatch[1].trim());
    }
    return map;
}

function parseHuaweiLog(output: string): BgpEventLog[] {
    const events: BgpEventLog[] = [];
    for (const line of output.split('\n')) {
        if (!line.trim()) continue;
        const ipMatch = line.match(/([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})/);
        let eventType: 'UP' | 'DOWN' | 'INFO' = 'INFO';
        const lower = line.toLowerCase();
        if (lower.includes('established') || lower.includes('up')) eventType = 'UP';
        if (lower.includes('down') || lower.includes('idle') || lower.includes('reset')) eventType = 'DOWN';
        events.push({ timestamp: new Date().toISOString(), peerIp: ipMatch?.[1] || '', eventType, message: line.trim() });
    }
    return events.slice(-30);
}
