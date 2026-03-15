import { BasePoller, BgpPeerState, BgpEventLog, parseBgpUptime } from '../base';
import { SshPoller } from '../ssh';

export class JuniperPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Juniper polling requires SSH credentials for ${this.device.hostname}`);
        }
        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);

        // Run both commands in parallel
        const [summaryOutput, neighborOutput] = await Promise.all([
            ssh.exec('show bgp summary'),
            ssh.exec('show bgp neighbor | match "(Peer:|Description:|Prefixes)"').catch(() => ''),
        ]);

        const descMap = parseJuniperDescriptions(neighborOutput);
        const sentMap = parseJuniperPrefixSent(neighborOutput);

        const peers: BgpPeerState[] = [];
        let headerFound = false;

        for (const line of summaryOutput.split('\n')) {
            if (line.includes('Peer') && line.includes('AS') && line.includes('State')) { headerFound = true; continue; }
            if (!headerFound) continue;
            const parts = line.trim().split(/\s+/);
            // JunOS summary: IP  AS  InPkt  OutPkt  OutQ  Flaps Last    State|#Active/Received/Accepted/Damped...
            if (parts.length >= 8 && parts[0].match(/^[0-9a-fA-F:.]+$/)) {
                const peerIp = parts[0];
                const remoteAsn = parseInt(parts[1], 10);
                const stateStr = parts[parts.length - 1];
                const bgpState = stateStr.startsWith('Establ') ? 'Established' : stateStr;

                // Juniper summary "Active/Received/Accepted/Damped" in last col when Established
                // Format: 1/100/100/0 — Active/Received/Accepted/Damped
                let acceptedPrefixes = 0;
                const pfxMatch = stateStr.match(/\d+\/(\d+)\/(\d+)\//);
                if (pfxMatch) acceptedPrefixes = parseInt(pfxMatch[2], 10); // Accepted col

                // JunOS summary columns: Peer AS InPkt OutPkt OutQ Flaps Last State|#Pfx
                // 'Last' (up/down duration) is at parts.length - 2 when Established, else parts.length - 2
                const lastStr = parts[parts.length - 2] || '';
                const uptime = bgpState === 'Established' ? (parseBgpUptime(lastStr) || undefined) : undefined;

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
            const output = await ssh.exec('show log messages | match BGP | last 30');
            return parseJuniperLog(output);
        } catch { return []; }
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

function parseJuniperPrefixSent(output: string): Map<string, number> {
    const map = new Map<string, number>();
    let currentIp = '';
    for (const line of output.split('\n')) {
        const peerMatch = line.match(/Peer:\s+([\d.a-fA-F:]+)/);
        if (peerMatch) currentIp = peerMatch[1];
        // "  Prefixes: 100 (advertised 50)"  or  "Exported: 50"
        const advMatch = line.match(/advertised\s+(\d+)/i) || line.match(/Exported:\s+(\d+)/i);
        if (advMatch && currentIp) map.set(currentIp, parseInt(advMatch[1], 10));
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
        if (lower.includes('established') || lower.includes(' up')) eventType = 'UP';
        if (lower.includes('down') || lower.includes('ceased') || lower.includes('idle')) eventType = 'DOWN';
        events.push({ timestamp: new Date().toISOString(), peerIp: ipMatch?.[1] || '', eventType, message: line.trim() });
    }
    return events.slice(-30);
}
