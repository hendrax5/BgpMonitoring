import { BasePoller, BgpPeerState, BgpEventLog, parseBgpUptime } from '../base';
import { SshPoller } from '../ssh';

export class HuaweiPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Huawei polling requires SSH credentials for ${this.device.hostname}`);
        }
        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);

        // '| no-more' disables VRP pager so full output is returned in one shot.
        // Timeout 60s — NE8K with hundreds of peers has large output.
        // Sequential: verbose is optional (descriptions + sent pfx), skip if slow.
        const summaryOutput = await ssh.exec('display bgp peer | no-more', 60000);
        const verboseOutput = await ssh.exec('display bgp peer verbose | no-more', 45000).catch(() => '');

        const descMap = parseHuaweiDescriptions(verboseOutput);
        const sentMap = parseHuaweiPrefixSent(verboseOutput);

        const peers: BgpPeerState[] = [];
        let headerFound = false;
        for (const line of summaryOutput.split('\n')) {
            if (line.includes('Peer') && line.includes('AS') && line.includes('State')) { headerFound = true; continue; }
            if (!headerFound) continue;
            const parts = line.trim().split(/\s+/);
            // Huawei: IP  V  AS  MsgRcvd  MsgSent  OutQ  Up/Down  State  PrefRcv
            if (parts.length >= 8 && /^[\d.]+$/.test(parts[0])) {
                const peerIp = parts[0];
                const remoteAsn = parseInt(parts[2], 10);
                // Huawei: IP  V  AS  MsgRcvd  MsgSent  OutQ  Up/Down  State  PrefRcv
                //          0  1   2       3         4    5        6       7       8
                const upDownStr = parts[6] || '';
                const stateStr = parts[parts.length - 2];
                const prefixesStr = parts[parts.length - 1];
                const bgpState = stateStr.toLowerCase() === 'established' ? 'Established' : stateStr;
                const acceptedPrefixes = bgpState === 'Established' ? (parseInt(prefixesStr, 10) || 0) : 0;
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
            const output = await ssh.exec('display logbuffer match BGP');
            return parseHuaweiLog(output);
        } catch { return []; }
    }

    override async fetchLiveSessions(): Promise<string> {
        if (!this.device.sshCredential) return 'Error: No SSH Credentials';
        try {
            const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
            return await ssh.exec('display bgp peer');
        } catch (err: any) {
            return `Error fetching live sessions: ${err.message}`;
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

function parseHuaweiPrefixSent(output: string): Map<string, number> {
    const map = new Map<string, number>();
    let currentIp = '';
    for (const line of output.split('\n')) {
        const peerMatch = line.match(/BGP peer is ([\d.a-fA-F:]+)/);
        if (peerMatch) currentIp = peerMatch[1];
        // "Prefixes advertised X, suppressed Y" or "Prefixes sent: X"
        const sentMatch = line.match(/[Pp]refixes\s+(?:advertised|sent)[:\s]+(\d+)/);
        if (sentMatch && currentIp) map.set(currentIp, parseInt(sentMatch[1], 10));
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
        if (lower.includes('established') || lower.includes(' up')) eventType = 'UP';
        if (lower.includes('down') || lower.includes('idle') || lower.includes('reset')) eventType = 'DOWN';
        events.push({ timestamp: new Date().toISOString(), peerIp: ipMatch?.[1] || '', eventType, message: line.trim() });
    }
    return events.slice(-30);
}
