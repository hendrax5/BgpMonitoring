/**
 * BGP config generator — turns a stored BgpPeer record into vendor-specific
 * CLI configuration. Used for the "Push To Router" feature (preview + SSH apply).
 */

export interface BgpPeerConfig {
    peerIp: string;
    peerName?: string | null;
    remoteAsn: string;              // BigInt serialized as string
    localAsn?: string | null;
    addressFamily: string;          // ipv4-unicast | ipv6-unicast | vpnv4 | vpnv6 | l2vpn-evpn
    prefixLimit?: number | null;
    prefixList?: string | null;
    routePolicyIn?: string | null;
    routePolicyOut?: string | null;
    password?: string | null;
    description?: string | null;
    adminStatus: string;            // enabled | disabled | shutdown
}

function isV6(af: string) { return af.startsWith('ipv6') || af === 'vpnv6'; }
function desc(p: BgpPeerConfig) { return (p.description || p.peerName || '').trim(); }
function shut(p: BgpPeerConfig) { return p.adminStatus === 'shutdown' || p.adminStatus === 'disabled'; }

function ciscoConfig(p: BgpPeerConfig): string[] {
    const asn = p.localAsn || '<LOCAL_ASN>';
    const afLine = isV6(p.addressFamily) ? 'address-family ipv6 unicast' : 'address-family ipv4 unicast';
    const lines: string[] = [`router bgp ${asn}`];
    lines.push(` neighbor ${p.peerIp} remote-as ${p.remoteAsn}`);
    if (desc(p)) lines.push(` neighbor ${p.peerIp} description ${desc(p)}`);
    if (p.password) lines.push(` neighbor ${p.peerIp} password ${p.password}`);
    if (shut(p)) lines.push(` neighbor ${p.peerIp} shutdown`);
    lines.push(` ${afLine}`);
    lines.push(`  neighbor ${p.peerIp} activate`);
    if (p.prefixLimit) lines.push(`  neighbor ${p.peerIp} maximum-prefix ${p.prefixLimit}`);
    if (p.routePolicyIn) lines.push(`  neighbor ${p.peerIp} route-map ${p.routePolicyIn} in`);
    if (p.routePolicyOut) lines.push(`  neighbor ${p.peerIp} route-map ${p.routePolicyOut} out`);
    lines.push(' exit-address-family');
    return lines;
}

function huaweiConfig(p: BgpPeerConfig): string[] {
    const asn = p.localAsn || '<LOCAL_ASN>';
    const af = isV6(p.addressFamily) ? 'ipv6-family unicast' : 'ipv4-family unicast';
    const lines: string[] = [`bgp ${asn}`];
    lines.push(` peer ${p.peerIp} as-number ${p.remoteAsn}`);
    if (desc(p)) lines.push(` peer ${p.peerIp} description ${desc(p)}`);
    if (p.password) lines.push(` peer ${p.peerIp} password cipher ${p.password}`);
    lines.push(` ${af}`);
    lines.push(`  peer ${p.peerIp} enable`);
    if (shut(p)) lines.push(`  shutdown peer ${p.peerIp}`);
    if (p.prefixLimit) lines.push(`  peer ${p.peerIp} route-limit ${p.prefixLimit}`);
    if (p.routePolicyIn) lines.push(`  peer ${p.peerIp} route-policy ${p.routePolicyIn} import`);
    if (p.routePolicyOut) lines.push(`  peer ${p.peerIp} route-policy ${p.routePolicyOut} export`);
    return lines;
}

function juniperConfig(p: BgpPeerConfig): string[] {
    const group = 'EXTERNAL';
    const base = `set protocols bgp group ${group} neighbor ${p.peerIp}`;
    const fam = isV6(p.addressFamily) ? 'family inet6 unicast' : 'family inet unicast';
    const lines: string[] = [];
    lines.push(`${base} peer-as ${p.remoteAsn}`);
    if (p.localAsn) lines.push(`${base} local-as ${p.localAsn}`);
    if (desc(p)) lines.push(`${base} description "${desc(p)}"`);
    if (p.password) lines.push(`${base} authentication-key "${p.password}"`);
    if (p.routePolicyIn) lines.push(`${base} import ${p.routePolicyIn}`);
    if (p.routePolicyOut) lines.push(`${base} export ${p.routePolicyOut}`);
    if (p.prefixLimit) lines.push(`${base} ${fam} prefix-limit maximum ${p.prefixLimit}`);
    if (shut(p)) lines.push(`${base} shutdown`);
    return lines;
}

function mikrotikConfig(p: BgpPeerConfig): string[] {
    // RouterOS v7
    const name = (p.peerName || `peer-${p.peerIp}`).replace(/\s+/g, '-');
    const parts = [
        `/routing/bgp/connection/add`,
        `name=${name}`,
        `remote.address=${p.peerIp}`,
        `remote.as=${p.remoteAsn}`,
        `local.role=ebgp`,
    ];
    if (p.localAsn) parts.push(`as=${p.localAsn}`);
    if (p.routePolicyIn) parts.push(`input.filter=${p.routePolicyIn}`);
    if (p.routePolicyOut) parts.push(`output.filter=${p.routePolicyOut}`);
    if (p.prefixLimit) parts.push(`input.limit-process-routes-ipv4=${p.prefixLimit}`);
    if (p.password) parts.push(`tcp-md5-key=${p.password}`);
    if (desc(p)) parts.push(`comment="${desc(p)}"`);
    if (shut(p)) parts.push(`disabled=yes`);
    return [parts.join(' ')];
}

function vyosConfig(p: BgpPeerConfig): string[] {
    const asn = p.localAsn || '<LOCAL_ASN>';
    const base = `set protocols bgp ${asn} neighbor ${p.peerIp}`;
    const fam = isV6(p.addressFamily) ? 'address-family ipv6-unicast' : 'address-family ipv4-unicast';
    const lines: string[] = [];
    lines.push(`${base} remote-as ${p.remoteAsn}`);
    if (desc(p)) lines.push(`${base} description "${desc(p)}"`);
    if (p.password) lines.push(`${base} password "${p.password}"`);
    if (p.prefixLimit) lines.push(`${base} ${fam} maximum-prefix ${p.prefixLimit}`);
    if (p.routePolicyIn) lines.push(`${base} ${fam} route-map import ${p.routePolicyIn}`);
    if (p.routePolicyOut) lines.push(`${base} ${fam} route-map export ${p.routePolicyOut}`);
    if (shut(p)) lines.push(`${base} shutdown`);
    return lines;
}

const GENERATORS: Record<string, (p: BgpPeerConfig) => string[]> = {
    cisco: ciscoConfig,
    huawei: huaweiConfig,
    juniper: juniperConfig,
    mikrotik: mikrotikConfig,
    vyos: vyosConfig,
    danos: vyosConfig,
    arista: ciscoConfig,
};

export function generateBgpConfig(vendor: string, p: BgpPeerConfig): { lines: string[]; text: string; vendor: string } {
    const key = (vendor || 'cisco').toLowerCase();
    const gen = GENERATORS[key] || ciscoConfig;
    const lines = gen(p);
    return { lines, text: lines.join('\n'), vendor: key };
}
