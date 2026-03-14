import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import LiveCheck from '@/app/components/LiveCheck';

export default async function PeerDetailsPage({ params }: { params: Promise<{ peerIp: string }> }) {
    const { peerIp: rawPeerIp } = await params;
    const peerIp = decodeURIComponent(rawPeerIp);

    // Fetch current peer state from Redis
    const allKeys = await redis.keys(`BgpSession:*:${peerIp}`);
    let peer: any = null;
    if (allKeys.length > 0) {
        const raw = await redis.hget(allKeys[0], 'data');
        if (raw) peer = JSON.parse(raw);
    }
    
    if (peer) {
        const asnRec = await prisma.asnDictionary.findUnique({ where: { asn: peer.remoteAsn } });
        peer.asnDictionary = asnRec;
        peer.stateChangedAt = new Date(peer.stateChangedAt);
        peer.lastUpdated = new Date(peer.lastUpdated);
    }

    if (!peer) return notFound();

    // Fetch all historical events for this peer
    const events = await prisma.historicalEvent.findMany({
        where: { peerIp },
        orderBy: { eventTimestamp: 'desc' },
        take: 50,
    });

    const isUp = peer.bgpState === 'Established';
    const asn = peer.remoteAsn.toString();
    const orgName = peer.asnDictionary?.organizationName || `AS${asn}`;

    const fmt = (date: Date) => {
        const s = Math.floor((Date.now() - date.getTime()) / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ${m % 60}m`;
        const d = Math.floor(h / 24);
        return `${d}d ${h % 24}h ${m % 60}m`;
    };

    const fmtDur = (sec: number | null) => {
        if (!sec) return '—';
        const m = Math.floor(sec / 60);
        if (m < 1) return `${sec}s`;
        if (m < 60) return `${m}m ${sec % 60}s`;
        const h = Math.floor(m / 60);
        return `${h}h ${m % 60}m`;
    };

    // Calculate uptime percentage from events (simple view: ratio of time UP vs DOWN in last 30 days)
    const downEvents = events.filter(e => e.eventType === 'DOWN');
    const totalDowntimeSec = downEvents.reduce((acc, e) => acc + (e.downtimeDuration || 0), 0);
    const thirtyDaysSec = 30 * 24 * 3600;
    const uptimePct = Math.max(0, Math.min(100, Math.round(((thirtyDaysSec - totalDowntimeSec) / thirtyDaysSec) * 100)));

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-40 px-6 py-3 border-b"
                style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs mb-1" style={{ color: '#475569' }}>
                    <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
                    <span>/</span>
                    <span className="text-white">{peer.deviceName}</span>
                    <span>/</span>
                    <span style={{ color: '#13a4ec' }}>Peer: AS{asn} ({orgName})</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-white">AS{asn} Peering Details</h2>
                        <span className={isUp ? 'badge-established' : 'badge-down'}>
                            <span className="dot" style={{ backgroundColor: isUp ? '#10b981' : '#f43f5e' }}></span>
                            {isUp ? 'Established' : peer.bgpState}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#64748b' }}>
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        Uptime: <span className="text-white font-semibold">{fmt(peer.stateChangedAt)}</span>
                    </div>
                </div>
            </header>

            <main className="p-6 space-y-5 animate-fade-in">

                {/* Info Cards row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>Remote Peer IP</p>
                        <p className="font-bold text-white font-mono">{peerIp}</p>
                    </div>
                    <div className="card p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>Device / Router</p>
                        <p className="font-bold text-white">{peer.deviceName}</p>
                        <p className="text-xs" style={{ color: '#64748b' }}>{peer.deviceIp}</p>
                    </div>
                    <div className="card p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>Prefixes Rcvd/Sent</p>
                        <p className="font-bold text-white">{peer.acceptedPrefixes.toLocaleString()} / {(peer.advertisedPrefixes ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="card p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>Server Source</p>
                        <p className="font-bold text-white">{peer.serverName}</p>
                    </div>
                </div>

                {/* 30-day Uptime Timeline */}
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg" style={{ color: '#13a4ec' }}>history</span>
                            <h3 className="font-bold text-white">BGP Session State Timeline (Last 30 Days)</h3>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: isUp ? '#10b981' : '#f43f5e' }}>{uptimePct}% Uptime</span>
                    </div>
                    <div className="relative w-full h-5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${uptimePct}%`, backgroundColor: '#10b981' }}></div>
                        {downEvents.length > 0 && (
                            <div className="absolute top-0 h-full w-1 rounded" style={{ left: `${uptimePct}%`, backgroundColor: '#f43f5e', transform: 'translateX(-50%)' }}></div>
                        )}
                    </div>
                    <div className="flex justify-between text-[10px] mt-1.5" style={{ color: '#475569' }}>
                        <span>30 days ago</span>
                        <span>Today</span>
                    </div>
                </div>

                {/* Route Flap / History Table */}
                <div className="card overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <h3 className="font-bold text-white">Route Flap & Event History</h3>
                        <Link href={`/reports?search=${encodeURIComponent(peerIp)}`}
                            className="flex items-center gap-1 text-xs font-bold hover:underline" style={{ color: '#13a4ec' }}>
                            View Full History
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full data-table">
                            <thead>
                                <tr>
                                    <th>Event Type</th>
                                    <th>Timestamp</th>
                                    <th>Device</th>
                                    <th>Downtime Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.length === 0 ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
                                        No historical events found for this peer.
                                    </td></tr>
                                ) : events.map((ev) => {
                                    const isEvUp = ev.eventType === 'UP';
                                    return (
                                        <tr key={ev.eventId.toString()}>
                                            <td>
                                                <span className={isEvUp ? 'badge-established' : 'badge-down'}>
                                                    <span className="dot" style={{ backgroundColor: isEvUp ? '#10b981' : '#f43f5e' }}></span>
                                                    {isEvUp ? 'Recovered' : 'Down'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="text-sm text-white">{ev.eventTimestamp.toLocaleString()}</div>
                                            </td>
                                            <td>
                                                <div className="text-sm text-white">{ev.deviceName}</div>
                                                <div className="text-xs" style={{ color: '#64748b' }}>{ev.deviceIp}</div>
                                            </td>
                                            <td>
                                                <span className="font-mono text-sm" style={{ color: ev.downtimeDuration ? '#f59e0b' : '#475569' }}>
                                                    {fmtDur(ev.downtimeDuration)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Live SSH Check */}
                <LiveCheck deviceIp={peer.deviceIp} peerIp={peerIp} />

            </main>
        </div>
    );
}
