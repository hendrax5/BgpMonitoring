import snmp from 'net-snmp';

/**
 * BGP4-MIB OIDs (RFC 1657)
 *   bgpPeerState              .1.3.6.1.2.1.15.3.1.2.{peerIp}  — FSM state (1-6)
 *   bgpPeerRemoteAs           .1.3.6.1.2.1.15.3.1.9.{peerIp}  — remote ASN
 *   bgpPeerFsmEstablishedTime .1.3.6.1.2.1.15.3.1.16.{peerIp} — seconds in Established
 *   bgpPeerInUpdates          .1.3.6.1.2.1.15.3.1.10.{peerIp} — UPDATE msgs received
 *   bgpPeerOutUpdates         .1.3.6.1.2.1.15.3.1.11.{peerIp} — UPDATE msgs sent
 */
const BGP4_PEER_STATE      = '1.3.6.1.2.1.15.3.1.2';
const BGP4_REMOTE_AS       = '1.3.6.1.2.1.15.3.1.9';
const BGP4_ESTABLISHED_TIME = '1.3.6.1.2.1.15.3.1.16';
const BGP4_IN_UPDATES       = '1.3.6.1.2.1.15.3.1.10';
const BGP4_OUT_UPDATES      = '1.3.6.1.2.1.15.3.1.11';

/** BGP FSM state number → string name (RFC 1657 §4.3) */
const BGP_STATE_MAP: Record<number, string> = {
    1: 'Idle', 2: 'Connect', 3: 'Active',
    4: 'OpenSent', 5: 'OpenConfirm', 6: 'Established',
};

export interface BgpSnmpStats {
    uptime?: number;           // seconds in Established state (bgpPeerFsmEstablishedTime)
    acceptedPrefixes?: number; // UPDATE msgs received (proxy; set to undefined if not useful)
    advertisedPrefixes?: number; // UPDATE msgs sent
}

export interface BgpPeerFull extends BgpSnmpStats {
    bgpState: string;  // human-readable FSM state
    remoteAsn: number;
}

export class SnmpPoller {
    private session: any;

    constructor(
        private ip: string,
        private community: string = 'public',
        private version: string = 'v2c',
        private port: number = 161
    ) {
        const snmpVersion = version === 'v3' ? snmp.Version3 : snmp.Version2c;
        this.session = snmp.createSession(this.ip, this.community, {
            port: this.port,
            version: snmpVersion,
            timeouts: [2000, 4000],
            retries: 2,
        });
    }

    /** Walk an OID table and return { 'peerIp' → numeric value } map */
    async walkTable(baseOid: string): Promise<Map<string, number>> {
        const map = new Map<string, number>();
        return new Promise((resolve) => {
            const feedCb = (varbinds: any[]) => {
                for (const vb of varbinds) {
                    if (snmp.isVarbindError(vb)) continue;
                    const oidStr: string = vb.oid.toString();
                    // Extract the IP suffix after the base OID
                    const suffix = oidStr.startsWith(baseOid + '.') ? oidStr.slice(baseOid.length + 1) : oidStr;
                    const val = typeof vb.value === 'number' ? vb.value : parseInt(String(vb.value), 10);
                    if (!isNaN(val)) map.set(suffix, val);
                }
            };
            this.session.walk(baseOid, 20, feedCb, (_error: any) => resolve(map));
        });
    }

    /**
     * Fetch BGP4-MIB stats for all peers via SNMP.
     * Returns a Map: peerIp (dot-notation) → BgpSnmpStats
     * Falls back gracefully to empty map if SNMP not reachable.
     */
    async getBgpPeerStats(): Promise<Map<string, BgpSnmpStats>> {
        const result = new Map<string, BgpSnmpStats>();
        try {
            const [uptimeMap, inUpdMap, outUpdMap] = await Promise.all([
                this.walkTable(BGP4_ESTABLISHED_TIME),
                this.walkTable(BGP4_IN_UPDATES),
                this.walkTable(BGP4_OUT_UPDATES),
            ]);
            const allPeers = new Set([...uptimeMap.keys(), ...inUpdMap.keys(), ...outUpdMap.keys()]);
            for (const ip of allPeers) {
                result.set(ip, {
                    uptime: uptimeMap.get(ip),
                    // Only override prefix counts when SSH reports 0 and SNMP has data
                    acceptedPrefixes: inUpdMap.get(ip),
                    advertisedPrefixes: outUpdMap.get(ip),
                });
            }
        } catch { /* SNMP not available, return empty */ }
        return result;
    }

    /**
     * Get FULL BGP peer list from BGP4-MIB (for SNMP-only mode).
     * Walks bgpPeerState + bgpPeerRemoteAs + stats OIDs.
     * Returns Map: peerIp → BgpPeerFull (state, ASN, uptime, prefix counts)
     */
    async getBgpPeersFromMib(): Promise<Map<string, BgpPeerFull>> {
        const result = new Map<string, BgpPeerFull>();
        const [stateMap, asnMap, uptimeMap, inUpdMap, outUpdMap] = await Promise.all([
            this.walkTable(BGP4_PEER_STATE),
            this.walkTable(BGP4_REMOTE_AS),
            this.walkTable(BGP4_ESTABLISHED_TIME),
            this.walkTable(BGP4_IN_UPDATES),
            this.walkTable(BGP4_OUT_UPDATES),
        ]);

        // bgpPeerState is authoritative — only include peers that have a state entry
        for (const [ip, stateNum] of stateMap.entries()) {
            result.set(ip, {
                bgpState:           BGP_STATE_MAP[stateNum] || 'Unknown',
                remoteAsn:          asnMap.get(ip) ?? 0,
                uptime:             uptimeMap.get(ip),
                acceptedPrefixes:   inUpdMap.get(ip),
                advertisedPrefixes: outUpdMap.get(ip),
            });
        }
        return result;
    }

    /**
     * Walks an OID tree, returns array of { oid, value, type }
     * (kept for backward compatibility with existing callers)
     */
    async walk(oid: string): Promise<Array<{ oid: string; value: string | number | Buffer; type: number }>> {
        return new Promise((resolve, reject) => {
            const results: Array<{ oid: string; value: string | number | Buffer; type: number }> = [];
            const feedCb = (varbinds: any[]) => {
                for (const vb of varbinds) {
                    if (!snmp.isVarbindError(vb)) {
                        results.push({ oid: vb.oid.toString(), value: vb.value, type: vb.type });
                    }
                }
            };
            this.session.walk(oid, 20, feedCb, (error: any) => {
                if (error?.message?.includes('Timeout')) return reject(error);
                resolve(results);
            });
        });
    }

    close() {
        if (this.session) this.session.close();
    }
}
