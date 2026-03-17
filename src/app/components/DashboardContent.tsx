import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import Link from 'next/link';
import BgpSessionsTable from './BgpSessionsTable';
import { unstable_cache } from 'next/cache';

const getCachedAsnDictionary = unstable_cache(
  async () => {
    return await prisma.asnDictionary.findMany();
  },
  ['asn-dictionary-cache'],
  { revalidate: 3600 }
);

interface Props {
  session: any;
  searchParams: { device?: string; sort?: string; status?: string; search?: string };
}

export default async function DashboardContent({ session, searchParams }: Props) {
  const { device, sort, status, search } = searchParams;
  const isSuperAdmin = session.role === 'superadmin';

  // Superadmin: see ALL tenants' sessions; regular user: only their tenant
  const redisPattern = isSuperAdmin ? 'BgpSession:*' : `BgpSession:${session.tenantId}:*`;
  const allRedisKeys = await redis.keys(redisPattern).catch(() => [] as string[]);
  let allSessionsRaw: any[] = [];
  
  if (allRedisKeys.length > 0) {
      try {
        const pipeline = redis.pipeline();
        allRedisKeys.forEach(k => pipeline.hget(k, 'data'));
        const results = await pipeline.exec();
        allSessionsRaw = results?.map(([err, res]) => res ? JSON.parse(res as string) : null).filter(Boolean) || [];
      } catch { /* Redis unavailable */ }
  }

  const deviceFilter = device && device !== 'all' ? device : null;
  const filteredSessionsByDevice = deviceFilter ? allSessionsRaw.filter(s => s.deviceName === deviceFilter) : allSessionsRaw;
  
  const totalSessions = filteredSessionsByDevice.length;
  const upSessions = filteredSessionsByDevice.filter(s => s.bgpState === 'Established').length;
  const downSessions = totalSessions - upSessions;

  // Latest BGP events
  const latestDbEvents = await (prisma as any).historicalEvent.findMany({
    where: {
      ...(isSuperAdmin ? {} : { tenantId: session.tenantId }),
      ...(deviceFilter ? { deviceName: deviceFilter } : {}),
    },
    orderBy: { eventTimestamp: 'desc' },
    take: 5,
    include: isSuperAdmin ? { tenant: { select: { slug: true, name: true } } } : undefined,
  });

  let allSessions = [...filteredSessionsByDevice];

  if (status && status !== 'all') {
    if (status === 'down') allSessions = allSessions.filter(s => s.bgpState !== 'Established');
    else allSessions = allSessions.filter(s => s.bgpState === status);
  }

  // To map ASN Organization Name using cached dictionary
  const asnDictionaryRecords = await getCachedAsnDictionary();
  const asnMap = new Map();
  // Using unstable_cache saves us from rapid repetitive DB hits
  asnDictionaryRecords.forEach((record: any) => asnMap.set(record.asn.toString(), record.organizationName));

  allSessions = allSessions.map(s => ({
      ...s,
      stateChangedAt: new Date(s.stateChangedAt).toISOString(),
      lastUpdated: new Date(s.lastUpdated).toISOString(),
      asnDictionary: { organizationName: asnMap.get(s.remoteAsn.toString()) || 'Unknown AS' }
  }));

  if (search) {
    const lowerSearch = search.toLowerCase();
    allSessions = allSessions.filter(s => 
      s.peerIp.toLowerCase().includes(lowerSearch) || 
      s.remoteAsn.toString().includes(lowerSearch) ||
      (s.asnDictionary?.organizationName || '').toLowerCase().includes(lowerSearch) ||
      s.deviceName.toLowerCase().includes(lowerSearch)
    );
  }

  if (sort === 'uptime') allSessions.sort((a,b) => new Date(a.stateChangedAt).getTime() - new Date(b.stateChangedAt).getTime());
  else if (sort === 'uptime-asc') allSessions.sort((a,b) => new Date(b.stateChangedAt).getTime() - new Date(a.stateChangedAt).getTime());
  else if (sort === 'prefix') allSessions.sort((a,b) => (b.acceptedPrefixes || 0) - (a.acceptedPrefixes || 0));
  else if (sort === 'prefix-asc') allSessions.sort((a,b) => (a.acceptedPrefixes || 0) - (b.acceptedPrefixes || 0));
  else if (sort === 'status') {
      allSessions.sort((a,b) => {
          if (a.bgpState === b.bgpState) return new Date(a.stateChangedAt).getTime() - new Date(b.stateChangedAt).getTime();
          return a.bgpState < b.bgpState ? 1 : -1;
      });
  }
  else if (sort === 'status-asc') {
      allSessions.sort((a,b) => {
          if (a.bgpState === b.bgpState) return new Date(a.stateChangedAt).getTime() - new Date(b.stateChangedAt).getTime();
          return a.bgpState > b.bgpState ? 1 : -1;
      });
  } else {
      allSessions.sort((a,b) => {
          if (a.bgpState === b.bgpState) return new Date(a.stateChangedAt).getTime() - new Date(b.stateChangedAt).getTime();
          return a.bgpState > b.bgpState ? 1 : -1; // Default status asc
      });
  }

  const uptimePct = totalSessions > 0 ? Math.round((upSessions / totalSessions) * 100) : 100;

  return (
    <>
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

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <h3 className="font-bold text-white">Latest BGP Events</h3>
          <Link href="/reports" className="text-xs font-bold hover:underline" style={{ color: '#13a4ec' }}>View All →</Link>
        </div>
        {latestDbEvents.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-3xl block mb-2" style={{ color: '#334155' }}>history</span>
            <p className="text-sm text-white mb-1">No BGP events yet</p>
            <p className="text-xs" style={{ color: '#475569' }}>Events are recorded when BGP session state changes (UP↔DOWN).</p>
          </div>
        ) : (
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
                {latestDbEvents.map((ev: any) => {
                  const isDown = ev.eventType === 'DOWN';
                  const sevColor = isDown ? '#f43f5e' : '#13a4ec';
                  const sevLabel = isDown ? 'Critical' : 'Recovery';
                  const fmtRelative = (date: Date) => {
                    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
                    if (diff < 1) return 'just now';
                    if (diff < 60) return `${diff}m ago`;
                    const h = Math.floor(diff / 60);
                    if (h < 24) return `${h}h ago`;
                    return `${Math.floor(h / 24)}d ago`;
                  };
                  const fmtDur = (sec: number | null) => {
                    if (!sec) return '—';
                    const m = Math.floor(sec / 60);
                    if (m < 1) return `${sec}s`;
                    if (m < 60) return `${m}m ${sec % 60}s`;
                    const h = Math.floor(m / 60);
                    return `${h}h ${m % 60}m`;
                  };
                  return (
                    <tr key={ev.eventId}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: sevColor }} />
                          <span className="text-xs font-bold uppercase" style={{ color: sevColor }}>{sevLabel}</span>
                        </div>
                      </td>
                      <td>
                        <div className="text-sm font-medium text-white">{new Date(ev.eventTimestamp).toLocaleString('id-ID')}</div>
                        <div className="text-xs" style={{ color: '#64748b' }}>{fmtRelative(new Date(ev.eventTimestamp))}</div>
                      </td>
                      <td>
                        <Link href={`/peers/${encodeURIComponent(ev.peerIp)}`} className="text-sm font-bold hover:opacity-75" style={{ color: '#13a4ec' }}>
                          {ev.peerIp}
                        </Link>
                        {ev.peerDescription && (
                          <div className="text-xs font-medium" style={{ color: '#94a3b8' }}>{ev.peerDescription}</div>
                        )}
                        <div className="text-xs" style={{ color: '#64748b' }}>AS{ev.asn?.toString()} · {ev.organizationName}</div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{ backgroundColor: isDown ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)', color: isDown ? '#10b981' : '#f43f5e' }}>
                            {isDown ? 'Established' : 'Any State'}
                          </span>
                          <span className="material-symbols-outlined text-sm" style={{ color: '#475569' }}>arrow_forward</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{ backgroundColor: isDown ? 'rgba(244,63,94,0.12)' : 'rgba(19,164,236,0.12)', color: isDown ? '#f43f5e' : '#13a4ec' }}>
                            {isDown ? 'Down' : 'Recovered'}
                          </span>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{ev.deviceName}</div>
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
        )}
      </div>

      <BgpSessionsTable allSessions={allSessions} />
    </>
  );
}
