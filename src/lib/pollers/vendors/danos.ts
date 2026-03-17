import { BasePoller, BgpPeerState, BgpEventLog, parseBgpUptime } from '../base';
import { SshPoller } from '../ssh';

// DanOS uses FRRouting-style commands
export class DanosPoller extends BasePoller {
    async poll(): Promise<BgpPeerState[]> {
        if (!this.device.sshCredential) {
            throw new Error(`DanOS polling requires SSH credentials for ${this.device.hostname}`);
        }
        const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);

        const [summaryOutput, neighborOutput] = await Promise.all([
            ssh.exec('/bin/vbash -ic "show protocols bgp ipv4 unicast summary"').catch(() => ''),
            ssh.exec('/bin/vbash -ic "show protocols bgp ipv4 unicast neighbors"').catch(() => ''),
        ]);

        const descMap = parseFrrDescriptions(neighborOutput);
        const sentMap = parseFrrPrefixSent(neighborOutput);
        const peers: BgpPeerState[] = [];
        let headerFound = false;

        for (const line of summaryOutput.split('\n')) {
            if (line.includes('Neighbor') && line.includes('State/PfxRcd')) { headerFound = true; continue; }
            if (!headerFound) continue;
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 10 && parts[0].match(/^[0-9a-fA-F:.]+$/)) {
                const peerIp = parts[0];
                const remoteAsn = parseInt(parts[2], 10);
                
                const upDownStr = parts[8] || '';
                const stateOrPfx = parts[9] || '';

                let bgpState = 'Idle', acceptedPrefixes = 0;
                if (/^\d+$/.test(stateOrPfx)) { 
                    bgpState = 'Established'; 
                    acceptedPrefixes = parseInt(stateOrPfx, 10); 
                } else { 
                    bgpState = stateOrPfx.replace(/[^a-zA-Z]/g, ''); 
                }
                const uptime = bgpState === 'Established' ? (parseBgpUptime(upDownStr) || undefined) : undefined;
                peers.push({
                    peerIp, remoteAsn, bgpState, acceptedPrefixes,
                    advertisedPrefixes: sentMap.get(peerIp) ?? 0,
                    description: descMap.get(peerIp),
                    uptime,
                });
            }
        }
        return peers;
    }

    override async fetchBgpLog(): Promise<BgpEventLog[]> {
        if (!this.device.sshCredential) return [];
        try {
            const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
            let output = await ssh.exec('/bin/vbash -ic "show log | match bgp"').catch(() => '');
            if (!output) output = await ssh.exec('/bin/vbash -ic "show log bgp"').catch(() => '');
            return parseFrrLog(output);
        } catch { return []; }
    }

    override async fetchLiveSessions(): Promise<string> {
        if (!this.device.sshCredential) return 'Error: No SSH Credentials';
        try {
            const ssh = new SshPoller(this.device.ipAddress, this.device.sshCredential);
            return await ssh.exec('/bin/vbash -ic "show protocols bgp ipv4 unicast summary"').catch(() => '');
        } catch (err: any) {
            return `Error fetching live sessions: ${err.message}`;
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

export function parseFrrPrefixSent(output: string): Map<string, number> {
    const map = new Map<string, number>();
    let currentIp = '';
    for (const line of output.split('\n')) {
        const neighborMatch = line.match(/BGP neighbor is ([\d.a-fA-F:]+)/);
        if (neighborMatch) currentIp = neighborMatch[1];
        // FRR: "  Prefixes Current: X sent, Y received"  OR  "Local Policy Denied Prefixes: ..."
        const sentMatch = line.match(/(\d+)\s+sent/i);
        if (sentMatch && currentIp) map.set(currentIp, parseInt(sentMatch[1], 10));
    }
    return map;
}

export function parseFrrLog(output: string): BgpEventLog[] {
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
