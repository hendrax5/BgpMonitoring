import { BasePoller, BgpPeerState, BgpEventLog } from '../base';
import { SshPoller } from '../ssh';

// DanOS uses FRRouting-style commands
export class DanosPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`DanOS polling requires SSH credentials for ${this.device.hostname}`);
        }

        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
        const summaryOutput = await ssh.exec('show bgp summary');
        const neighborsOutput = await ssh.exec('show bgp neighbors').catch(() => '');

        const descMap = parseFrrDescriptions(neighborsOutput);
        const peers: BgpPeerState[] = [];
        const lines = summaryOutput.split('\n');
        let headerFound = false;

        for (const line of lines) {
            if (line.includes('Neighbor') && line.includes('State/PfxRcd')) {
                headerFound = true;
                continue;
            }
            if (headerFound) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 9 && parts[0].match(/^[0-9a-fA-F:.]+$/)) {
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
            const output = await ssh.exec('show log | match bgp');
            return parseFrrLog(output);
        } catch {
            return [];
        }
    }
}

export function parseFrrDescriptions(output: string): Map<string, string> {
    const map = new Map<string, string>();
    let currentIp = '';
    for (const line of output.split('\n')) {
        const neighborMatch = line.match(/BGP neighbor is ([\d.a-fA-F:]+)/);
        const descMatch = line.match(/Description:\s*(.+)/);
        if (neighborMatch) currentIp = neighborMatch[1];
        if (descMatch && currentIp) map.set(currentIp, descMatch[1].trim());
    }
    return map;
}

export function parseFrrLog(output: string): BgpEventLog[] {
    const events: BgpEventLog[] = [];
    for (const line of output.split('\n')) {
        if (!line.trim()) continue;
        const ipMatch = line.match(/([\d.]+(?:\.[\d.]+){3})/);
        let eventType: 'UP' | 'DOWN' | 'INFO' = 'INFO';
        const lower = line.toLowerCase();
        if (lower.includes('established') || lower.includes('up')) eventType = 'UP';
        if (lower.includes('down') || lower.includes('reset') || lower.includes('idle')) eventType = 'DOWN';
        events.push({ timestamp: new Date().toISOString(), peerIp: ipMatch?.[1] || '', eventType, message: line.trim() });
    }
    return events.slice(-30);
}
