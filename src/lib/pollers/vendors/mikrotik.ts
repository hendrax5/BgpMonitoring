import { BasePoller, BgpPeerState, BgpEventLog } from '../base';
import { SshPoller } from '../ssh';

export class MikrotikPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Mikrotik polling requires SSH credentials for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);

        // Try both v7 and v6 commands, use whichever returns data
        let output = '';
        let isV7 = false;
        try {
            const v7out = await ssh.exec('/routing/bgp/session/print detail without-paging');
            // v7 output contains "remote.address" or "remote.as"
            if (v7out.includes('remote.address') || v7out.includes('remote.as')) {
                output = v7out;
                isV7 = true;
            }
        } catch { /* v7 not available */ }

        if (!isV7) {
            try {
                output = await ssh.exec('/routing bgp peer print detail without-paging');
            } catch {
                output = await ssh.exec('/routing bgp peer print detail');
            }
        }

        const peers = isV7 ? this.parseV7(output) : this.parseV6(output);
        return this.enrichWithSnmp(peers);
    }

    /**
     * Parse RouterOS v7 /routing/bgp/session/print detail
     * Format example:
     *   Flags: E - established
     *    0 E name="to-isp" remote.address=1.2.3.4 remote.as=65001
     *        local.role=ebgp state=established uptime=1d2h
     *        prefix-count=100 sent-prefix-count=50
     */
    private parseV7(output: string): BgpPeerState[] {
        const peers: BgpPeerState[] = [];

        // RouterOS v7 uses continuation lines with dot-prefix: ".as=", ".id="
        // Split blocks on lines that start with digit(s) (entry number)
        // Example:
        //    0   name="peer-name"
        //        remote.address=10.0.0.1
        //    .as=65001 .id=10.0.0.1
        //        state=established
        const blocks = output.split(/\n(?=\s*\d+\s+)/);

        for (const block of blocks) {
            if (!block.trim()) continue;

            // Flatten block: join all lines (remove leading whitespace/dots from continuation)
            const flat = block.replace(/\n\s*/g, ' ');

            const nameMatch = flat.match(/name="([^"]+)"/);
            // peer IP: remote.address=X or .address=X
            const ipMatch = flat.match(/(?:remote\.address|\.address)=([\da-fA-F:.\[\]]+)/);
            // ASN: remote.as=X or .as=X
            const asnMatch = flat.match(/(?:remote\.as|(?<![a-z])\.as)=(\d+)/);
            // state: state=established or .state=
            const stateMatch = flat.match(/(?:^|[\s.])state=([a-zA-Z-]+)/i);
            // prefix-count for received, sent-prefix-count for sent
            const rxMatch = flat.match(/(?<![a-z-])prefix-count=(\d+)/);
            const txMatch = flat.match(/sent-prefix-count=(\d+)/);

            if (!ipMatch || !asnMatch) continue;

            const rawIp = ipMatch[1].replace(/[\[\]]/g, ''); // strip IPv6 brackets if any
            const rawAsn = parseInt(asnMatch[1], 10);
            let bgpState = 'unknown';
            if (stateMatch) {
                const s = stateMatch[1].toLowerCase();
                bgpState = s === 'established' ? 'Established' : s;
            }

            // uptime: "1d2h30m" or "2h10m" or "45m30s"
            const uptimeMatch = flat.match(/uptime=([\w]+)/);
            const uptimeSec = uptimeMatch ? parseMikrotikUptime(uptimeMatch[1]) : undefined;

            // Skip if ASN parse failed
            if (isNaN(rawAsn)) continue;

            peers.push({
                peerIp: rawIp,
                remoteAsn: rawAsn,
                bgpState,
                acceptedPrefixes: rxMatch ? parseInt(rxMatch[1], 10) : 0,
                advertisedPrefixes: txMatch ? parseInt(txMatch[1], 10) : 0,
                description: nameMatch?.[1]?.trim() || undefined,
                uptime: uptimeSec,
            });
        }
        return peers;
    }

    /**
     * Parse RouterOS v6 /routing bgp peer print detail
     * Format example:
     *   0 name="ISP1" remote-address=1.2.3.4 remote-as=65001
     *     state=established prefix-count=100
     */
    private parseV6(output: string): BgpPeerState[] {
        const peers: BgpPeerState[] = [];
        const blocks = output.split(/\n(?=\s*\d+\s)/);

        for (const block of blocks) {
            if (!block.trim()) continue;

            const ipMatch = block.match(/remote-address=([\da-fA-F:.]+)/);
            const asnMatch = block.match(/remote-as=(\d+)/);
            const stateMatch = block.match(/state=([a-zA-Z-]+)/i);
            const nameMatch = block.match(/name="?([^"\n\s]+)"?/);
            const prefixMatch = block.match(/prefix-count=(\d+)/);
            const uptimeMatch = block.match(/uptime=([\w]+)/);

            if (!ipMatch || !asnMatch || !stateMatch) continue;

            const state = stateMatch[1].toLowerCase();
            peers.push({
                peerIp: ipMatch[1],
                remoteAsn: parseInt(asnMatch[1], 10),
                bgpState: state === 'established' ? 'Established' : state,
                acceptedPrefixes: prefixMatch ? parseInt(prefixMatch[1], 10) : 0,
                advertisedPrefixes: 0,
                description: nameMatch?.[1]?.trim() || undefined,
                uptime: uptimeMatch ? parseMikrotikUptime(uptimeMatch[1]) : undefined,
            });
        }
        return peers;
    }

    override async fetchBgpLog(): Promise<BgpEventLog[]> {
        if (!this.device.sshCredential) return [];
        try {
            const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
            const output = await ssh.exec('/log print where topics~"bgp" without-paging');
            return parseMikrotikLog(output);
        } catch {
            return [];
        }
    }
}

/** Convert MikroTik uptime string (e.g. "1d2h30m10s", "2h5m", "45m") to seconds */
function parseMikrotikUptime(uptime: string): number {
    let seconds = 0;
    const weeks = uptime.match(/(\d+)w/);
    const days = uptime.match(/(\d+)d/);
    const hours = uptime.match(/(\d+)h/);
    const mins = uptime.match(/(\d+)m/);
    const secs = uptime.match(/(\d+)s/);
    if (weeks) seconds += parseInt(weeks[1]) * 604800;
    if (days) seconds += parseInt(days[1]) * 86400;
    if (hours) seconds += parseInt(hours[1]) * 3600;
    if (mins) seconds += parseInt(mins[1]) * 60;
    if (secs) seconds += parseInt(secs[1]);
    return seconds;
}

function parseMikrotikLog(output: string): BgpEventLog[] {
    const events: BgpEventLog[] = [];
    const ipRegex = /([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})/;

    for (const line of output.split('\n')) {
        if (!line.trim()) continue;
        const ipMatch = line.match(ipRegex);
        let eventType: 'UP' | 'DOWN' | 'INFO' = 'INFO';
        const lower = line.toLowerCase();
        if (lower.includes('established') || lower.includes('up')) eventType = 'UP';
        if (lower.includes('down') || lower.includes('idle') || lower.includes('reset') ||
            lower.includes('ceased') || lower.includes('timeout')) eventType = 'DOWN';

        events.push({
            timestamp: new Date().toISOString(),
            peerIp: ipMatch?.[1] || '',
            eventType,
            message: line.trim(),
        });
    }
    return events.slice(-30);
}
