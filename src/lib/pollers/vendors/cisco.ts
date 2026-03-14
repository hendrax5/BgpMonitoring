import { BasePoller, BgpPeerState, BgpEventLog } from '../base';
import { SshPoller } from '../ssh';

export class CiscoPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Cisco polling requires SSH credentials for ${this.device.hostname}`);
        }
        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);

        // Run summary + neighbor detail in parallel
        const [summaryOutput, neighborOutput] = await Promise.all([
            ssh.exec('show bgp ipv4 unicast summary'),
            ssh.exec('show bgp ipv4 unicast neighbors | include (Neighbor|Prefixes Current|advertis)').catch(() => ''),
        ]);

        const descMap = parseCiscoNeighborField(neighborOutput, 'Description');
        const sentMap = parseCiscoPrefixSent(neighborOutput);

        const peers: BgpPeerState[] = [];
        let headerFound = false;
        for (const line of summaryOutput.split('\n')) {
            if (line.includes('Neighbor') && line.includes('State/PfxRcd')) { headerFound = true; continue; }
            if (!headerFound) continue;
            const parts = line.trim().split(/\s+/);
            // Cisco summary columns: Neighbor V AS MsgRcvd MsgSent TblVer InQ OutQ Up/Down State/PfxRcd
            // Up/Down is at index 8 (0-based), State/PfxRcd is last
            if (parts.length >= 9 && /^[\d.]+$/.test(parts[0])) {
                const peerIp = parts[0];
                const remoteAsn = parseInt(parts[2], 10);
                const stateOrPfx = parts[parts.length - 1];
                const upDownStr = parts[8] || '';
                let bgpState = 'Idle', acceptedPrefixes = 0;
                if (/^\d+$/.test(stateOrPfx)) { bgpState = 'Established'; acceptedPrefixes = parseInt(stateOrPfx, 10); }
                else { bgpState = stateOrPfx; }
                peers.push({
                    peerIp, remoteAsn, bgpState, acceptedPrefixes,
                    advertisedPrefixes: sentMap.get(peerIp) ?? 0,
                    description: descMap.get(peerIp),
                    uptime: parseCiscoUpdown(upDownStr),
                });
            }
        }
        return peers;
    }


    override async fetchBgpLog(): Promise<BgpEventLog[]> {
        if (!this.device.sshCredential) return [];
        try {
            const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
            const output = await ssh.exec('show logging | include BGP');
            return parseSyslogBgp(output);
        } catch { return []; }
    }
}

/** Parse `BGP neighbor is X.X.X.X ... Description: FOO` blocks */
function parseCiscoNeighborField(output: string, field: string): Map<string, string> {
    const map = new Map<string, string>();
    let currentIp = '';
    for (const line of output.split('\n')) {
        const neighborMatch = line.match(/BGP neighbor is ([\d.]+)/);
        const fieldMatch = line.match(new RegExp(`${field}:\\s*(.+)`));
        if (neighborMatch) currentIp = neighborMatch[1];
        if (fieldMatch && currentIp) map.set(currentIp, fieldMatch[1].trim());
    }
    return map;
}

/** Parse sent prefix count from Cisco neighbor output */
function parseCiscoPrefixSent(output: string): Map<string, number> {
    const map = new Map<string, number>();
    let currentIp = '';
    for (const line of output.split('\n')) {
        const neighborMatch = line.match(/BGP neighbor is ([\d.]+)/);
        if (neighborMatch) currentIp = neighborMatch[1];
        // "  Prefixes Current: 100 sent, 50 received" or "Prefix advertised X, suppressed Y"
        const sentMatch = line.match(/(\d+)\s+sent/i) || line.match(/advertised\s+(\d+)/i);
        if (sentMatch && currentIp) map.set(currentIp, parseInt(sentMatch[1], 10));
    }
    return map;
}

/** Parse Cisco Up/Down column (e.g. "00:10:30", "2d10h", "1w2d", "never") to seconds */
function parseCiscoUpdown(s: string): number | undefined {
    if (!s || s === 'never') return undefined;
    // hh:mm:ss or h:mm:ss
    const hms = s.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (hms) return parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3]);
    // Xwk Xd or Xd Xh
    let secs = 0;
    const w = s.match(/(\d+)w/); if (w) secs += parseInt(w[1]) * 604800;
    const d = s.match(/(\d+)d/); if (d) secs += parseInt(d[1]) * 86400;
    const h = s.match(/(\d+)h/); if (h) secs += parseInt(h[1]) * 3600;
    const m = s.match(/(\d+)m/); if (m) secs += parseInt(m[1]) * 60;
    return secs > 0 ? secs : undefined;
}

export function parseSyslogBgp(output: string): BgpEventLog[] {
    const events: BgpEventLog[] = [];
    for (const line of output.split('\n')) {
        if (!line.trim()) continue;
        const ipMatch = line.match(/([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})/);
        let eventType: 'UP' | 'DOWN' | 'INFO' = 'INFO';
        const lower = line.toLowerCase();
        if (lower.includes('established') || lower.includes(' up')) eventType = 'UP';
        if (lower.includes('down') || lower.includes('reset') || lower.includes('idle')) eventType = 'DOWN';
        events.push({ timestamp: new Date().toISOString(), peerIp: ipMatch?.[1] || '', eventType, message: line.trim() });
    }
    return events.slice(-30);
}
