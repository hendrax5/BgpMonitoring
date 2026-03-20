import { getHistoricalEvents, getTopFlappingPeers, getIncidentStats } from '@/app/actions/reports';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import LiveIncidentBar from '@/app/components/LiveIncidentBar';
import EventDensityChart from '@/app/components/EventDensityChart';
import EventTimeline from '@/app/components/EventTimeline';
import ClientDynamicZone from '@/app/components/ClientDynamicZone';

export default async function ReportsPage(props: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
    const searchParams = await props.searchParams;

    const startDate = searchParams.start || undefined;
    const endDate = searchParams.end || undefined;
    const filterAsn = searchParams.asn || undefined;
    const search = searchParams.search || undefined;
    const severity = searchParams.severity || undefined;
    const range = searchParams.range || undefined;

    // If search looks like a pure ASN number, treat it as ASN filter
    const effectiveAsn = search && /^\d+$/.test(search) ? search : filterAsn;

    const [events, topFlap, allAsns, incidentStats, events24h] = await Promise.all([
        getHistoricalEvents({ startDate, endDate, asn: effectiveAsn, search, severity, range }),
        getTopFlappingPeers(startDate, endDate),
        prisma.asnDictionary.findMany({ orderBy: { organizationName: 'asc' } }),
        getIncidentStats(),
        prisma.historicalEvent.count({ where: { eventTimestamp: { gte: new Date(Date.now() - 86400000) } } }),
    ]);

    const totalSessions = incidentStats.downCount; // re-use to avoid extra Redis call; actual total not needed here

    // Build CSV export URL that includes active filters
    const csvParams = new URLSearchParams();
    if (startDate) csvParams.set('start', startDate);
    if (endDate) csvParams.set('end', endDate);
    if (effectiveAsn) csvParams.set('asn', effectiveAsn);
    if (severity) csvParams.set('severity', severity);
    if (range) csvParams.set('range', range);

    return (
        <div className="min-h-screen">
            {/* ── Sticky header ─────────────────────────────────────── */}
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
                style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div>
                    <h2 className="text-white font-bold text-base">BGP Event Log</h2>
                    <p className="text-xs" style={{ color: '#64748b' }}>
                        Real-time monitoring · {events.length.toLocaleString()} events loaded
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href={`/api/export/csv?${csvParams.toString()}`}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{ backgroundColor: '#13a4ec', color: 'white' }}
                    >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Export Logs
                    </a>
                    <a href="/reports" className="flex items-center p-1.5 rounded-lg"
                        style={{ border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}>
                        <span className="material-symbols-outlined text-sm">refresh</span>
                    </a>
                </div>
            </header>

            <main className="p-6 space-y-4 animate-fade-in">

                {/* ── Live Incident Bar (only when incidents active) ── */}
                <LiveIncidentBar stats={incidentStats} />

                {/* ── KPI Strip ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Active Peers */}
                    <div className="card p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>Active Peers</p>
                            <p className="text-2xl font-bold text-white">{Math.max(0, events.filter((e: { eventType: string }) => e.eventType === 'UP').length)}</p>
                        </div>
                        <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#10b981' }}>check_circle</span>
                        </div>
                    </div>

                    {/* Down Sessions */}
                    <div className="card p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>Down Now</p>
                            <p className="text-2xl font-bold" style={{ color: incidentStats.downCount > 0 ? '#f43f5e' : 'white' }}>
                                {incidentStats.downCount}
                            </p>
                            {incidentStats.downCount > 0 && (
                                <p className="text-[10px] font-bold mt-0.5" style={{ color: '#f43f5e' }}>Action Required</p>
                            )}
                        </div>
                        <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(244,63,94,0.12)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#f43f5e' }}>error</span>
                        </div>
                    </div>

                    {/* Events 24h */}
                    <div className="card p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>Events (24h)</p>
                            <p className="text-2xl font-bold text-white">{events24h.toLocaleString()}</p>
                        </div>
                        <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(19,164,236,0.12)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#13a4ec' }}>bar_chart</span>
                        </div>
                    </div>

                    {/* Top Flapper */}
                    <div className="card p-4 flex items-center justify-between">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>Top Flapper</p>
                            <p className="text-sm font-bold text-white truncate">{topFlap[0]?.peerIp || '—'}</p>
                            {topFlap[0] && (
                                <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>{topFlap[0]._count.eventId}x drops</p>
                            )}
                        </div>
                        <div className="p-2 rounded-lg flex-shrink-0 ml-2" style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>speed</span>
                        </div>
                    </div>
                </div>

                {/* ── Filter Bar + Collapsible Table (client boundary) ── */}
                <ClientDynamicZone
                    allAsns={allAsns}
                    events={events as any}
                    startDate={startDate}
                    endDate={endDate}
                    effectiveAsn={effectiveAsn}
                />

                {/* ── Event Density Chart ────────────────────────────── */}
                <EventDensityChart density={incidentStats.eventDensity} />

                {/* ── Main Timeline View ─────────────────────────────── */}
                <div className="card p-5">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-base" style={{ color: '#13a4ec' }}>timeline</span>
                        Event Timeline
                    </h3>
                    <EventTimeline events={events as any} />
                </div>



                {/* ── Top Flapping Peers ─────────────────────────────── */}
                {topFlap.length > 0 && (
                    <div className="card p-5">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#f43f5e' }} />
                            Top Flapping Peers
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {topFlap.slice(0, 6).map((f: typeof topFlap[0], i: number) => (
                                <Link key={i} href={`/peers/${encodeURIComponent(f.peerIp)}`}
                                    className="flex items-center justify-between p-3 rounded-lg transition-colors"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-white">{f.peerIp}</div>
                                        <div className="text-xs truncate" style={{ color: '#64748b' }}>{f.organizationName}</div>
                                    </div>
                                    <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ml-2"
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
