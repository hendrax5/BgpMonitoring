import { BasePoller, BgpPeerState, BgpEventLog, parseBgpUptime } from '../base';
import { SshPoller } from '../ssh';

export class JuniperPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Juniper polling requires SSH credentials for ${this.device.hostname}`);
        }
        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);

        // Run summary + full neighbor data (for Active prefixes + Advertised prefixes) in parallel
        const [summaryOutput, neighborOutput] = await Promise.all([
            ssh.exec('show bgp summary'),
            ssh.exec('show bgp neighbor | match "(Peer:|Active prefixes:|Advertised prefixes:|Description:)"').catch(() => ''),
        ]);

        const descMap = parseJuniperDescriptions(neighborOutput);
        const { activePfxMap, advPfxMap } = parseJuniperPrefixes(neighborOutput);

        const peers: BgpPeerState[] = [];
        let headerFound = false;

        for (const line of summaryOutput.split('\n')) {
            if (line.includes('Peer') && line.includes('AS') && line.includes('State')) { headerFound = true; continue; }
            if (!headerFound) continue;
            const parts = line.trim().split(/\s+/);
            // JunOS summary: Peer AS InPkt OutPkt OutQ Flaps [Last multiword] State|#Active/Received/Accepted/Damped
            // Parts count varies because 'Last' can be "3d 4h" (2 tokens) or "00:10:30" (1 token)
            if (parts.length >= 8 && parts[0].match(/^[0-9a-fA-F:.]+$/)) {
                const peerIp = parts[0];
                const remoteAsn = parseInt(parts[1], 10);
                // State column is always last
                const stateStr = parts[parts.length - 1];
                const bgpState = (stateStr.startsWith('Establ') || stateStr.match(/^\d+\/\d+/))
                    ? 'Established'
                    : stateStr;

                // Single token hh:mm:ss (Juniper standard) or MikroTik-style "3d 4h" (two tokens).
                // ONLY combine two tokens if prevToken looks like a time component (has w/d/h/m/s),
                // NOT a plain integer like the Flaps column (e.g. "129" + "8:02:46" = wrong).
                let uptime: number | undefined;
                if (bgpState === 'Established') {
                    const lastSingle = parts[parts.length - 2] || '';
                    const t1 = parseBgpUptime(lastSingle);
                    const prevToken = parts[parts.length - 3] ?? '';
                    const isTimeComponent = (s: string) => /[wdhms]/.test(s) && !/^\d+$/.test(s);
                    if (isTimeComponent(prevToken) && isTimeComponent(lastSingle)) {
                        const t2 = parseBgpUptime(prevToken + lastSingle);
                        uptime = Math.max(t1, t2) || undefined;
                    } else {
                        uptime = t1 || undefined;
                    }
                }

                // Accepted prefix count: from show bgp summary last col when Established (format: Active/Received/Accepted/Damped)
                let acceptedPrefixes = activePfxMap.get(peerIp) ?? 0;
                const pfxFractionMatch = stateStr.match(/(\d+)\/(\d+)\/(\d+)\//);
                if (pfxFractionMatch && acceptedPrefixes === 0) {
                    // Accepted is col[2] in Active/Received/Accepted/Damped
                    acceptedPrefixes = parseInt(pfxFractionMatch[3], 10);
                }

                peers.push({
                    peerIp, remoteAsn, bgpState,
                    acceptedPrefixes,
                    advertisedPrefixes: advPfxMap.get(peerIp) ?? 0,
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

/**
 * Extract peer descriptions from filtered 'show bgp neighbor' output.
 * Lines captured: "Peer: x.x.x.x", "Description: ...", "Active prefixes:", "Advertised prefixes:"
 */
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

/**
 * Extract active (received) and advertised prefix counts from
 * 'show bgp neighbor | match "(Peer:|Active prefixes:|Advertised prefixes:)"' output.
 *
 * JunOS output lines look like:
 *   Peer: 10.0.0.1         AS 65001   ...
 *   Active prefixes:              100
 *   Advertised prefixes:           50
 */
function parseJuniperPrefixes(output: string): {
    activePfxMap: Map<string, number>;
    advPfxMap: Map<string, number>;
} {
    const activePfxMap = new Map<string, number>();
    const advPfxMap = new Map<string, number>();
    let currentIp = '';
    for (const line of output.split('\n')) {
        const peerMatch = line.match(/Peer:\s+([\d.a-fA-F:]+)/);
        if (peerMatch) { currentIp = peerMatch[1]; continue; }
        if (!currentIp) continue;
        // "  Active prefixes:              100"
        const activeMatch = line.match(/Active prefixes:\s+(\d+)/i);
        if (activeMatch) activePfxMap.set(currentIp, parseInt(activeMatch[1], 10));
        // "  Advertised prefixes:           50"
        const advMatch = line.match(/Advertised prefixes:\s+(\d+)/i);
        if (advMatch) advPfxMap.set(currentIp, parseInt(advMatch[1], 10));
    }
    return { activePfxMap, advPfxMap };
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
