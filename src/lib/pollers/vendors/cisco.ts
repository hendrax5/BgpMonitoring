import { BasePoller, BgpPeerState, BgpEventLog } from '../base';
import { SshPoller } from '../ssh';

export class CiscoPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`Cisco polling requires SSH credentials for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        // Get summary for state/prefixes
        const summaryOutput = await ssh.exec('show bgp ipv4 unicast summary | include ^[0-9]');
        // Get neighbors detail for descriptions
        const neighborsOutput = await ssh.exec('show bgp neighbors | include (BGP neighbor|Description)');

        const descMap = parseCiscoDescriptions(neighborsOutput);
        const peers: BgpPeerState[] = [];

        const lines = summaryOutput.split('\n');
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 9 && /^[\d.]+$/.test(parts[0])) {
                const peerIp = parts[0];
                const remoteAsn = parseInt(parts[2], 10);
                const stateOrPfx = parts[parts.length - 1];
                let bgpState = 'Idle';
                let acceptedPrefixes = 0;

                if (/^\d+$/.test(stateOrPfx)) {
                    bgpState = 'Established';
                    acceptedPrefixes = parseInt(stateOrPfx, 10);
                } else {
                    bgpState = stateOrPfx;
                }

                peers.push({
                    peerIp,
                    remoteAsn,
                    bgpState,
                    acceptedPrefixes,
                    advertisedPrefixes: 0,
                    description: descMap.get(peerIp),
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
            return parseSyslogBgp(output, 'cisco');
        } catch {
            return [];
        }
    }
}

function parseCiscoDescriptions(output: string): Map<string, string> {
    const map = new Map<string, string>();
    let currentIp = '';
    for (const line of output.split('\n')) {
        const neighborMatch = line.match(/BGP neighbor is ([\d.]+)/);
        const descMatch = line.match(/Description:\s*(.+)/);
        if (neighborMatch) currentIp = neighborMatch[1];
        if (descMatch && currentIp) map.set(currentIp, descMatch[1].trim());
    }
    return map;
}

function parseSyslogBgp(output: string, _vendor: string): BgpEventLog[] {
    const events: BgpEventLog[] = [];
    const ipRegex = /([\d.]+)/g;
    for (const line of output.split('\n')) {
        if (!line.trim()) continue;
        const ips = line.match(ipRegex) || [];
        const peerIp = ips.find(ip => ip.split('.').length === 4 && !ip.startsWith('255')) || '';
        let eventType: 'UP' | 'DOWN' | 'INFO' = 'INFO';
        const lower = line.toLowerCase();
        if (lower.includes('established') || lower.includes('up')) eventType = 'UP';
        if (lower.includes('down') || lower.includes('reset') || lower.includes('idle')) eventType = 'DOWN';
        events.push({ timestamp: new Date().toISOString(), peerIp, eventType, message: line.trim() });
    }
    return events.slice(-30);
}
