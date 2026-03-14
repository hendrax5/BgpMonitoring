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

        return isV7 ? this.parseV7(output) : this.parseV6(output);
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
        // Split on lines starting with digit (entry separator)
        const blocks = output.split(/\n(?=\s*\d+\s)/);

        for (const block of blocks) {
            if (!block.trim()) continue;

            // Extract fields — v7 uses dot notation (remote.address, remote.as)
            const ipMatch = block.match(/remote\.address=([\da-fA-F:.]+)/);
            const asnMatch = block.match(/remote\.as=(\d+)/);
            const stateMatch = block.match(/state=([a-zA-Z-]+)/i);
            const nameMatch = block.match(/name="?([^"\n\s]+)"?/);
            // v7: prefix-count (received), sent-prefix-count (sent)
            const rxMatch = block.match(/prefix-count=(\d+)/);
            const txMatch = block.match(/sent-prefix-count=(\d+)/);

            if (!ipMatch || !asnMatch || !stateMatch) continue;

            const state = stateMatch[1].toLowerCase();
            peers.push({
                peerIp: ipMatch[1],
                remoteAsn: parseInt(asnMatch[1], 10),
                bgpState: state === 'established' ? 'Established' : state,
                acceptedPrefixes: rxMatch ? parseInt(rxMatch[1], 10) : 0,
                advertisedPrefixes: txMatch ? parseInt(txMatch[1], 10) : 0,
                description: nameMatch?.[1]?.trim() || undefined,
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

            if (!ipMatch || !asnMatch || !stateMatch) continue;

            const state = stateMatch[1].toLowerCase();
            peers.push({
                peerIp: ipMatch[1],
                remoteAsn: parseInt(asnMatch[1], 10),
                bgpState: state === 'established' ? 'Established' : state,
                acceptedPrefixes: prefixMatch ? parseInt(prefixMatch[1], 10) : 0,
                advertisedPrefixes: 0,
                description: nameMatch?.[1]?.trim() || undefined,
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
