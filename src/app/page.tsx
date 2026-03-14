import { logout } from '@/app/actions/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import Link from 'next/link';
import DashboardFilters from '@/app/components/DashboardFilters';
import SortableHeader from '@/app/components/SortableHeader';

export default async function Home({ searchParams }: { searchParams: Promise<{ device?: string; sort?: string; status?: string; search?: string }> }) {
  const { device, sort, status, search } = await searchParams;

  // Aggregate counts — scoped to selected device if filter is active
  // Since we use Redis now, we first grab all sessions:
  const allRedisKeys = await redis.keys('BgpSession:*');
  let allSessionsRaw: any[] = [];
  
  if (allRedisKeys.length > 0) {
      const pipeline = redis.pipeline();
      allRedisKeys.forEach(k => pipeline.hget(k, 'data'));
      const results = await pipeline.exec();
      allSessionsRaw = results?.map(([err, res]) => res ? JSON.parse(res as string) : null).filter(Boolean) || [];
  }

  const deviceFilter = device && device !== 'all' ? device : null;
  const filteredSessionsByDevice = deviceFilter ? allSessionsRaw.filter(s => s.deviceName === deviceFilter) : allSessionsRaw;
  
  const totalSessions = filteredSessionsByDevice.length;
  const upSessions = filteredSessionsByDevice.filter(s => s.bgpState === 'Established').length;
  const downSessions = totalSessions - upSessions;

  // Latest 10 BGP events from DB (state changes recorded by worker)
  const latestDbEvents = await (prisma as any).historicalEvent.findMany({
    orderBy: { eventTimestamp: 'desc' },
    take: 10
  });

  // Configured devices for LiveEventsPanel (SSH log viewer)
  const configuredDevices = await prisma.routerDevice.findMany({
    select: { id: true, hostname: true, ipAddress: true, vendor: true },
    orderBy: { hostname: 'asc' }
  });

  // Where clause (in-memory filtering)
  let allSessions = [...filteredSessionsByDevice];

  if (status && status !== 'all') {
    if (status === 'down') allSessions = allSessions.filter(s => s.bgpState !== 'Established');
    else allSessions = allSessions.filter(s => s.bgpState === status);
  }

  // To map ASN Organization Name, we fetch the relevant ASNs from SQLite
  const uniqueAsns = Array.from(new Set(allSessions.map(s => BigInt(s.remoteAsn))));
  const asnDictionaryRecords = await prisma.asnDictionary.findMany({
    where: { asn: { in: uniqueAsns } }
  });
  
  const asnMap = new Map();
  asnDictionaryRecords.forEach(record => asnMap.set(record.asn.toString(), record.organizationName));

  // Map the organization name into the objects and parse dates properly
  allSessions = allSessions.map(s => ({
      ...s,
      stateChangedAt: new Date(s.stateChangedAt),
      lastUpdated: new Date(s.lastUpdated),
      asnDictionary: { organizationName: asnMap.get(s.remoteAsn.toString()) || 'Unknown AS' }
  }));

  // Filtering by search
  if (search) {
    const lowerSearch = search.toLowerCase();
    allSessions = allSessions.filter(s => 
      s.peerIp.toLowerCase().includes(lowerSearch) || 
      s.remoteAsn.toString().includes(lowerSearch) ||
      (s.asnDictionary?.organizationName || '').toLowerCase().includes(lowerSearch) ||
      s.deviceName.toLowerCase().includes(lowerSearch)
    );
  }

  // Sort mapping (in-memory)
  if (sort === 'uptime') allSessions.sort((a,b) => a.stateChangedAt.getTime() - b.stateChangedAt.getTime());
  else if (sort === 'uptime-asc') allSessions.sort((a,b) => b.stateChangedAt.getTime() - a.stateChangedAt.getTime());
  else if (sort === 'prefix') allSessions.sort((a,b) => (b.acceptedPrefixes || 0) - (a.acceptedPrefixes || 0));
  else if (sort === 'prefix-asc') allSessions.sort((a,b) => (a.acceptedPrefixes || 0) - (b.acceptedPrefixes || 0));
  else if (sort === 'status') {
      allSessions.sort((a,b) => {
          if (a.bgpState === b.bgpState) return a.stateChangedAt.getTime() - b.stateChangedAt.getTime();
          return a.bgpState < b.bgpState ? 1 : -1;
      });
  }
  else if (sort === 'status-asc') {
      allSessions.sort((a,b) => {
          if (a.bgpState === b.bgpState) return a.stateChangedAt.getTime() - b.stateChangedAt.getTime();
          return a.bgpState > b.bgpState ? 1 : -1;
      });
  } else {
      allSessions.sort((a,b) => {
          if (a.bgpState === b.bgpState) return a.stateChangedAt.getTime() - b.stateChangedAt.getTime();
          return a.bgpState > b.bgpState ? 1 : -1; // Default status asc
      });
  }

  // Distinct devices for filter
  const devices = Array.from(new Set(allSessionsRaw.map(s => s.deviceName))).sort();

  const fmt = (date: Date) => {
    const totalSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (totalSec < 60)    return `${totalSec}s`;
    const m = Math.floor(totalSec / 60);
    if (m < 60)           return `${m}m ${totalSec % 60}s`;
    const h = Math.floor(m / 60);
    if (h < 24)           return `${h}h ${m % 60}m`;
    const d = Math.floor(h / 24);
    if (d < 7)            return `${d}d ${h % 24}h`;
    const w = Math.floor(d / 7);
    if (d < 30)           return `${w}w ${d % 7}d`;
    const mo = Math.floor(d / 30);
    const remW = Math.floor((d % 30) / 7);
    if (d < 365)          return remW > 0 ? `${mo}mo ${remW}w` : `${mo}mo`;
    const yr = Math.floor(d / 365);
    const remMo = Math.floor((d % 365) / 30);
    return remMo > 0 ? `${yr}y ${remMo}mo` : `${yr}y`;
  };

  const fmtDate = (date: Date) => date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  const fmtTime = (date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff} min ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  const uptimePct = totalSessions > 0 ? Math.round((upSessions / totalSessions) * 100) : 100;

  return (
    <div className="min-h-screen">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
        style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <h2 className="text-white font-bold text-base">BGP Overview Dashboard</h2>
            <p className="text-xs" style={{ color: '#64748b' }}>Live monitoring ION Network</p>
          </div>
          <DashboardFilters devices={devices} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href="/settings" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
            style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="material-symbols-outlined text-sm">settings</span>
            Settings
          </a>
          <form action={logout}>
            <button type="submit" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="material-symbols-outlined text-sm">logout</span>
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <main className="p-6 space-y-5 animate-fade-in">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
                <span className="material-symbols-outlined text-xl">cable</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#64748b' }}>TOTAL</span>
            </div>
            <p className="text-sm mb-1" style={{ color: '#64748b' }}>Total Sessions</p>
            <p className="text-3xl font-bold text-white">{totalSessions}</p>
          </div>

          <Link href="/?status=Established" className="card p-5 block transition-all hover:border-[#10b981]/40"
            style={{ borderColor: status === 'Established' ? 'rgba(16,185,129,0.4)' : undefined }}>
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                <span className="material-symbols-outlined text-xl">check_circle</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>ACTIVE</span>
            </div>
            <p className="text-sm mb-1" style={{ color: '#64748b' }}>Established</p>
            <p className="text-3xl font-bold text-white">{upSessions}</p>
            <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: '#10b981' }}>
              <span className="material-symbols-outlined text-sm">filter_alt</span>
              Click to filter
            </p>
          </Link>

          <Link href={downSessions > 0 ? '/?status=down' : '/'} className="card p-5 block transition-all"
            style={{ borderColor: status === 'down' ? 'rgba(244,63,94,0.4)' : undefined }}>
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(244,63,94,0.12)', color: '#f43f5e' }}>
                <span className="material-symbols-outlined text-xl">error</span>
              </div>
              {downSessions > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded animate-pulse" style={{ backgroundColor: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}>ALERT</span>
              )}
            </div>
            <p className="text-sm mb-1" style={{ color: '#64748b' }}>Sessions Down</p>
            <p className="text-3xl font-bold text-white">{downSessions}</p>
            {downSessions > 0 ? (
              <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: '#f43f5e' }}>
                <span className="material-symbols-outlined text-sm">filter_alt</span>
                Click to see affected peers
              </p>
            ) : (
              <p className="text-[10px] mt-2" style={{ color: '#10b981' }}>All sessions healthy ✓</p>
            )}
          </Link>

          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
                <span className="material-symbols-outlined text-xl">monitoring</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#64748b' }}>HEALTH</span>
            </div>
            <p className="text-sm mb-1" style={{ color: '#64748b' }}>Session Health</p>
            <p className="text-3xl font-bold text-white">{uptimePct}%</p>
            <div className="w-full h-1.5 rounded-full mt-3 overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${uptimePct}%`, backgroundColor: '#13a4ec' }}></div>
            </div>
          </div>
        </div>

        {/* Latest BGP Events — from DB (state changes) */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div>
              <h3 className="font-bold text-white">Latest BGP Events</h3>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>State changes recorded by worker — last 10</p>
            </div>
            <Link href="/reports" className="text-xs font-bold hover:underline" style={{ color: '#13a4ec' }}>View All →</Link>
          </div>
          {latestDbEvents.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-3xl block mb-2" style={{ color: '#334155' }}>history</span>
              <p className="text-sm text-white mb-1">No BGP events yet</p>
              <p className="text-xs" style={{ color: '#475569' }}>Events are recorded when BGP session state changes (UP↔DOWN).</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {latestDbEvents.map((ev: any) => (
                <div key={ev.eventId} className="px-4 py-3 flex items-start gap-3 hover:bg-white/[0.02]">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{ backgroundColor: ev.eventType === 'UP' ? '#10b981' : '#f43f5e' }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <code className="text-xs font-mono font-bold text-white">{ev.peerIp}</code>
                      {ev.peerDescription && (
                        <span className="text-xs" style={{ color: '#94a3b8' }}>{ev.peerDescription}</span>
                      )}
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                        style={{
                          backgroundColor: ev.eventType === 'UP' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                          color: ev.eventType === 'UP' ? '#10b981' : '#f43f5e'
                        }}>{ev.eventType}</span>
                    </div>
                    <p className="text-[11px]" style={{ color: '#64748b' }}>
                      {ev.deviceName} — AS{ev.asn?.toString()} {ev.organizationName}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
                      {new Date(ev.eventTimestamp).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BGP Peer Status Table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <h3 className="font-bold text-white">BGP Peer Status</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#475569' }}>{allSessions.length} session{allSessions.length !== 1 ? 's' : ''}</span>
              <a href="/api/export/csv" className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: '#13a4ec', color: 'white' }}>
                <span className="material-symbols-outlined text-sm">download</span>
                Export CSV
              </a>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Peer Address / Device</th>
                  <th>Remote AS</th>
                  <SortableHeader label="Status" sortKey="status" />
                  <SortableHeader label="Uptime" sortKey="uptime" />
                  <SortableHeader label="Pfx Rcvd/Sent" sortKey="prefix" />
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allSessions.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
                    No BGP sessions found. Is the worker running?
                  </td></tr>
                ) : allSessions.map((s) => {
                  const isUp = s.bgpState === 'Established';
                  return (
                    <tr key={`${s.serverName}-${s.deviceId}-${s.peerIp}`}>
                      <td>
                        <Link href={`/peers/${encodeURIComponent(s.peerIp)}`} className="flex flex-col hover:opacity-75 transition-opacity group">
                          <span className="font-bold text-white text-sm group-hover:text-[#13a4ec] transition-colors">{s.peerIp}</span>
                          {s.peerDescription && (
                            <span className="text-xs font-semibold" style={{ color: '#e2e8f0' }}>{s.peerDescription}</span>
                          )}
                          <span className="text-xs" style={{ color: '#94a3b8' }}>{s.deviceName}</span>
                        </Link>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                            AS {s.remoteAsn.toString()}
                          </span>
                          <span className="text-sm" style={{ color: '#cbd5e1' }}>
                            {s.asnDictionary?.organizationName || '—'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={isUp ? 'badge-established' : 'badge-down'}>
                          <span className="dot" style={{ backgroundColor: isUp ? '#10b981' : '#f43f5e' }}></span>
                          {isUp ? 'Established' : s.bgpState}
                        </span>
                      </td>
                      <td title={`Since: ${s.stateChangedAt.toLocaleString()}`}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: isUp ? '#94a3b8' : '#f87171' }}>
                          {fmt(s.stateChangedAt)}
                        </span>
                        <div className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
                          {fmtDate(s.stateChangedAt)}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {s.acceptedPrefixes.toLocaleString()} / {(s.advertisedPrefixes ?? 0).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/peers/${encodeURIComponent(s.peerIp)}`}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                          style={{ color: '#13a4ec', border: '1px solid rgba(19,164,236,0.3)' }}>
                          <span className="material-symbols-outlined text-sm">open_in_new</span>
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
