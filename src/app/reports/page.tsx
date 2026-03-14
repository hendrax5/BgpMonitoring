import { getHistoricalEvents, getTopFlappingPeers } from '@/app/actions/reports';
import { fetchLibreNmsBgpEvents } from '@/app/actions/librenms-events';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import Link from 'next/link';

export default async function ReportsPage(props: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
    const searchParams = await props.searchParams;

    const startDate = searchParams.start || undefined;
    const endDate = searchParams.end || undefined;
    const filterAsn = searchParams.asn || undefined;
    const search = searchParams.search || undefined;

    // Apply search to ASN filter if provided from dashboard deep-link
    const effectiveAsn = search && /^\d+$/.test(search) ? search : filterAsn;

    const events = await getHistoricalEvents({ startDate, endDate, asn: effectiveAsn, search });
    const topFlap = await getTopFlappingPeers(startDate, endDate);
    const allAsns = await prisma.asnDictionary.findMany({ orderBy: { organizationName: 'asc' } });
    const liveEvents = await fetchLibreNmsBgpEvents({ limit: 20, search, asn: effectiveAsn });

    // Summary counts
    const last24h = new Date(Date.now() - 86400000);
    
    // Instead of SQLite we count keys via Redis
    const allKeys = await redis.keys('BgpSession:*');
    let downSessions = 0;
    
    if (allKeys.length > 0) {
        const pipeline = redis.pipeline();
        allKeys.forEach(k => pipeline.hget(k, 'data'));
        const results = await pipeline.exec();
        results?.forEach(([err, res]) => {
            if (res) {
                const s = JSON.parse(res as string);
                if (s.bgpState !== 'Established') downSessions++;
            }
        });
    }
    const totalSessions = allKeys.length;
    const events24h = await prisma.historicalEvent.count({ where: { eventTimestamp: { gte: last24h } } });

    const fmtDur = (sec: number | null) => {
        if (!sec) return '—';
        const m = Math.floor(sec / 60);
        if (m < 1) return `${sec}s`;
        if (m < 60) return `${m}m ${sec % 60}s`;
        const h = Math.floor(m / 60);
        return `${h}h ${m % 60}m`;
    };

    const fmtRelative = (date: Date) => {
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return 'just now';
        if (diff < 60) return `${diff} minutes ago`;
        const h = Math.floor(diff / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    };

    return (
        <div className="min-h-screen">
            {/* Top Header */}
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
                style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div>
                    <h2 className="text-white font-bold text-base">BGP Event Log</h2>
                    <p className="text-xs" style={{ color: '#64748b' }}>Real-time monitoring and historical analysis of BGP state changes.</p>
                </div>
                <div className="flex items-center gap-2">
                    <a href={`/api/export/csv?start=${startDate || ''}&end=${endDate || ''}&asn=${effectiveAsn || ''}`}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{ backgroundColor: '#13a4ec', color: 'white' }}>
                        <span className="material-symbols-outlined text-sm">download</span>
                        Export Logs
                    </a>
                    <a href="/reports" className="flex items-center p-1.5 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}>
                        <span className="material-symbols-outlined text-sm">refresh</span>
                    </a>
                </div>
            </header>

            <main className="p-6 space-y-5 animate-fade-in">

                {/* Bottom stat cards — shown at top for quick context */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Active Peers</p>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-white">{totalSessions - downSessions}</span>
                            <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                <span className="material-symbols-outlined text-xl">check_circle</span>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Down Sessions</p>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-white">{downSessions}</span>
                            <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(244,63,94,0.12)', color: '#f43f5e' }}>
                                <span className="material-symbols-outlined text-xl">error</span>
                            </div>
                        </div>
                        {downSessions > 0 && <p className="mt-1 text-[10px] font-medium" style={{ color: '#f43f5e' }}>Action Required</p>}
                    </div>
                    <div className="card p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Events (24h)</p>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-white">{events24h.toLocaleString()}</span>
                            <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
                                <span className="material-symbols-outlined text-xl">bar_chart</span>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Top Flapper</p>
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-white truncate">{topFlap[0]?.peerIp || '—'}</span>
                            <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                <span className="material-symbols-outlined text-xl">speed</span>
                            </div>
                        </div>
                        {topFlap[0] && <p className="mt-1 text-[10px]" style={{ color: '#64748b' }}>{topFlap[0]._count.eventId}x drops</p>}
                    </div>
                </div>

                {/* LibreNMS Live BGP Events */}
                <div className="card overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg" style={{ color: '#13a4ec' }}>wifi</span>
                            <h3 className="font-bold text-white">Live BGP Events — LibreNMS</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981' }}>LIVE</span>
                        </div>
                        <span className="text-xs" style={{ color: '#475569' }}>Last 20 BGP-related entries from LibreNMS syslog</span>
                    </div>
                    {liveEvents.length === 0 ? (
                        <div className="p-8 text-center">
                            <span className="material-symbols-outlined text-3xl block mb-2" style={{ color: '#334155' }}>cloud_off</span>
                            <p className="text-sm text-white mb-1">No live events</p>
                            <p className="text-xs" style={{ color: '#475569' }}>Ensure LibreNMS API is configured in Settings and the server is reachable.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '100px' }}>Severity</th>
                                        <th>Timestamp</th>
                                        <th>Device</th>
                                        <th>Event Message</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {liveEvents.map((ev, i) => {
                                        const isDown = /down|notestabl|idle|active/i.test(ev.message) || /down/i.test(ev.type);
                                        const isUp = /up|established/i.test(ev.message);
                                        const color = isDown ? '#f43f5e' : isUp ? '#10b981' : '#f59e0b';
                                        const label = isDown ? 'Down' : isUp ? 'Up' : 'Info';
                                        return (
                                            <tr key={i}>
                                                <td>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                                                        style={{ backgroundColor: `${color}18`, color }}>
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                                        {label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="text-sm text-white">{new Date(ev.datetime).toLocaleString()}</div>
                                                    <div className="text-[10px]" style={{ color: '#64748b' }}>{fmtRelative(new Date(ev.datetime))}</div>
                                                </td>
                                                <td>
                                                    <span className="text-sm font-bold" style={{ color: '#94a3b8' }}>{ev.hostname}</span>
                                                </td>
                                                <td>
                                                    <span className="text-sm" style={{ color: '#cbd5e1' }}>{ev.message}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Filter Bar */}
                <div className="card p-4">
                    <form className="flex flex-wrap gap-3 items-center">
                        <div className="flex-1 min-w-[250px] relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#475569' }}>filter_alt</span>
                            <input
                                type="text"
                                name="search"
                                defaultValue={search}
                                placeholder="Filter by Peer IP, AS Number..."
                                className="form-input pl-9"
                            />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <select name="asn" defaultValue={effectiveAsn || ''} className="form-select" style={{ width: 'auto', minWidth: '160px' }}>
                                <option value="">All ASNs</option>
                                {allAsns.map(a => (
                                    <option key={a.asn.toString()} value={a.asn.toString()}>
                                        AS{a.asn.toString()} – {a.organizationName}
                                    </option>
                                ))}
                            </select>
                            <input type="date" name="start" defaultValue={startDate} className="form-input" style={{ width: 'auto' }} />
                            <input type="date" name="end" defaultValue={endDate} className="form-input" style={{ width: 'auto' }} />
                            <button type="submit" className="px-4 py-2 text-xs font-bold rounded-lg text-white"
                                style={{ backgroundColor: '#13a4ec' }}>Apply</button>
                            <Link href="/reports" className="px-4 py-2 text-xs font-bold rounded-lg"
                                style={{ border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}>Clear</Link>
                        </div>
                    </form>
                    {(search || effectiveAsn) && (
                        <div className="flex gap-2 mt-3 flex-wrap items-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Active:</span>
                            {search && (
                                <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
                                    Search: {search}
                                </span>
                            )}
                            {effectiveAsn && (
                                <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
                                    AS: {effectiveAsn}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Event Log Table */}
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full data-table">
                            <thead>
                                <tr>
                                    <th>Severity</th>
                                    <th>Timestamp</th>
                                    <th>Peer Info</th>
                                    <th>Event / Change</th>
                                    <th>Downtime</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
                                        No events match the current filters.
                                    </td></tr>
                                ) : events.map((ev) => {
                                    const isUp = ev.eventType === 'UP';
                                    const isDown = ev.eventType === 'DOWN';
                                    const sevColor = isDown ? '#f43f5e' : isUp ? '#13a4ec' : '#f59e0b';
                                    const sevLabel = isDown ? 'Critical' : isUp ? 'Recovery' : 'Info';

                                    return (
                                        <tr key={ev.eventId.toString()}>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: sevColor }}></span>
                                                    <span className="text-xs font-bold uppercase" style={{ color: sevColor }}>{sevLabel}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="text-sm font-medium text-white">{ev.eventTimestamp.toLocaleString()}</div>
                                                <div className="text-xs" style={{ color: '#64748b' }}>{fmtRelative(ev.eventTimestamp)}</div>
                                            </td>
                                            <td>
                                                <Link href={`/peers/${encodeURIComponent(ev.peerIp)}`} className="text-sm font-bold hover:opacity-75" style={{ color: '#13a4ec' }}>
                                                    {ev.peerIp}
                                                </Link>
                                                <div className="text-xs" style={{ color: '#64748b' }}>AS{ev.asn.toString()} · {ev.organizationName}</div>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                                                        style={{ backgroundColor: isDown ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)', color: isDown ? '#10b981' : '#f43f5e' }}>
                                                        {isDown ? 'Established' : isUp ? 'Any State' : '—'}
                                                    </span>
                                                    {(isDown || isUp) && <span className="material-symbols-outlined text-sm" style={{ color: '#475569' }}>arrow_forward</span>}
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                                                        style={{ backgroundColor: isDown ? 'rgba(244,63,94,0.12)' : isUp ? 'rgba(19,164,236,0.12)' : 'rgba(255,255,255,0.06)', color: isDown ? '#f43f5e' : isUp ? '#13a4ec' : '#64748b' }}>
                                                        {isDown ? 'Down' : isUp ? 'Recovered' : '—'}
                                                    </span>
                                                </div>
                                                <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{ev.deviceName} ({ev.deviceIp})</div>
                                            </td>
                                            <td>
                                                <span className="font-medium text-sm" style={{ color: ev.downtimeDuration ? '#f59e0b' : '#475569' }}>
                                                    {fmtDur(ev.downtimeDuration)}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <Link href={`/peers/${encodeURIComponent(ev.peerIp)}`}
                                                    className="inline-flex items-center text-xs px-2 py-1 rounded"
                                                    style={{ color: '#13a4ec', border: '1px solid rgba(19,164,236,0.25)' }}>
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-5 py-3 flex items-center justify-between border-t" style={{ borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <span className="text-xs" style={{ color: '#475569' }}>
                            Showing <span className="font-bold text-white">{events.length}</span> events
                        </span>
                        <div className="flex gap-2">
                            <a href={`/api/export/pdf?start=${startDate || ''}&end=${endDate || ''}&asn=${effectiveAsn || ''}`}
                                target="_blank"
                                className="text-xs px-3 py-1 rounded"
                                style={{ border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}>
                                Print PDF
                            </a>
                        </div>
                    </div>
                </div>

                {/* Top Flapping Section */}
                {topFlap.length > 0 && (
                    <div className="card p-5">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#f43f5e' }}></span>
                            Top Flapping Peers
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {topFlap.slice(0, 6).map((f, i) => (
                                <Link key={i} href={`/peers/${encodeURIComponent(f.peerIp)}`}
                                    className="flex items-center justify-between p-3 rounded-lg transition-colors"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                    <div>
                                        <div className="text-sm font-bold text-white">{f.peerIp}</div>
                                        <div className="text-xs" style={{ color: '#64748b' }}>{f.organizationName}</div>
                                    </div>
                                    <span className="text-xs font-bold px-2 py-1 rounded-full"
                                        style={{ backgroundColor: 'rgba(244,63,94,0.12)', color: '#f43f5e' }}>
                                        {f._count.eventId}x
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
