import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import Link from 'next/link';
import BgpSessionsTable from './BgpSessionsTable';
import { unstable_cache } from 'next/cache';
import { fmtRelative, fmtDur } from '@/lib/fmt';

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

/** Build a URL that preserves all current searchParams but overrides specific keys */
function buildFilterUrl(base: Record<string, string | undefined>, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v && v !== 'all') params.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null || v === '' || v === 'all') params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
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
  const filteredSessionsByDevice = deviceFilter
    ? allSessionsRaw.filter(s => s.deviceName === deviceFilter)
    : allSessionsRaw;

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

  // Map ASN → Organization Name using cached dictionary
  const asnDictionaryRecords = await getCachedAsnDictionary();
  const asnMap = new Map<string, string>();
  asnDictionaryRecords.forEach((record: any) => asnMap.set(record.asn.toString(), record.organizationName));

  allSessions = allSessions.map(s => ({
    ...s,
    stateChangedAt: new Date(s.stateChangedAt).toISOString(),
    lastUpdated: new Date(s.lastUpdated).toISOString(),
    asnDictionary: { organizationName: asnMap.get(s.remoteAsn.toString()) || 'Unknown AS' }
  }));

  if (search) {
    const q = search.toLowerCase();
    allSessions = allSessions.filter(s =>
      s.peerIp.toLowerCase().includes(q) ||
      s.remoteAsn.toString().includes(q) ||
      (s.asnDictionary?.organizationName || '').toLowerCase().includes(q) ||
      s.deviceName.toLowerCase().includes(q)
    );
  }

  // Sorting
  if (sort === 'uptime') allSessions.sort((a, b) => new Date(a.stateChangedAt).getTime() - new Date(b.stateChangedAt).getTime());
  else if (sort === 'uptime-asc') allSessions.sort((a, b) => new Date(b.stateChangedAt).getTime() - new Date(a.stateChangedAt).getTime());
  else if (sort === 'prefix') allSessions.sort((a, b) => (b.acceptedPrefixes || 0) - (a.acceptedPrefixes || 0));
  else if (sort === 'prefix-asc') allSessions.sort((a, b) => (a.acceptedPrefixes || 0) - (b.acceptedPrefixes || 0));
  else if (sort === 'status') {
    allSessions.sort((a, b) => {
      if (a.bgpState === b.bgpState) return new Date(a.stateChangedAt).getTime() - new Date(b.stateChangedAt).getTime();
      return a.bgpState < b.bgpState ? 1 : -1;
    });
  } else if (sort === 'status-asc') {
    allSessions.sort((a, b) => {
      if (a.bgpState === b.bgpState) return new Date(a.stateChangedAt).getTime() - new Date(b.stateChangedAt).getTime();
      return a.bgpState > b.bgpState ? 1 : -1;
    });
  } else {
    // Default: Established first
    allSessions.sort((a, b) => {
      if (a.bgpState === b.bgpState) return new Date(a.stateChangedAt).getTime() - new Date(b.stateChangedAt).getTime();
      return a.bgpState > b.bgpState ? 1 : -1;
    });
  }

  const uptimePct = totalSessions > 0 ? Math.round((upSessions / totalSessions) * 100) : 100;

  // Device-preserving filter hrefs for stat cards
  const baseParams = { device, sort, search, status };
  const hrefEstablished = buildFilterUrl(baseParams, { status: 'Established', sort: null });
  const hrefDown = downSessions > 0 ? buildFilterUrl(baseParams, { status: 'down', sort: null }) : buildFilterUrl(baseParams, { status: null, sort: null });

  return (
    <>
      {/* ── Summary Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Total Sessions */}
        <div className="card p-5" role="region" aria-label="Total BGP sessions">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
              <span className="material-symbols-outlined text-xl" aria-hidden="true">cable</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#64748b' }}>TOTAL</span>
          </div>
          <p className="text-sm mb-1" style={{ color: '#64748b' }}>Total Sessions</p>
          <p className="text-3xl font-bold text-white">{totalSessions}</p>
        </div>

        {/* Established */}
        <Link
          href={hrefEstablished}
          className="card p-5 block transition-all hover:border-[#10b981]/40 focus-ring"
          style={{ borderColor: status === 'Established' ? 'rgba(16,185,129,0.4)' : undefined }}
          aria-label={`${upSessions} established sessions — click to filter`}
          aria-pressed={status === 'Established'}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
              <span className="material-symbols-outlined text-xl" aria-hidden="true">check_circle</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>ACTIVE</span>
          </div>
          <p className="text-sm mb-1" style={{ color: '#64748b' }}>Established</p>
          <p className="text-3xl font-bold text-white">{upSessions}</p>
          <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: '#10b981' }}>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">filter_alt</span>
            Click to filter
          </p>
        </Link>

        {/* Sessions Down */}
        <Link
          href={hrefDown}
          className="card p-5 block transition-all focus-ring"
          style={{ borderColor: status === 'down' ? 'rgba(244,63,94,0.4)' : undefined }}
          aria-label={`${downSessions} sessions down${downSessions > 0 ? ' — click to filter' : ''}`}
          aria-pressed={status === 'down'}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(244,63,94,0.12)', color: '#f43f5e' }}>
              <span className="material-symbols-outlined text-xl" aria-hidden="true">error</span>
            </div>
            {downSessions > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded animate-pulse"
                style={{ backgroundColor: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}
                role="status" aria-live="polite">ALERT</span>
            )}
          </div>
          <p className="text-sm mb-1" style={{ color: '#64748b' }}>Sessions Down</p>
          <p className="text-3xl font-bold text-white">{downSessions}</p>
          {downSessions > 0 ? (
            <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: '#f43f5e' }}>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">filter_alt</span>
              Click to see affected peers
            </p>
          ) : (
            <p className="text-[10px] mt-2" style={{ color: '#10b981' }}>All sessions healthy ✓</p>
          )}
        </Link>

        {/* Session Health */}
        <div className="card p-5" role="region" aria-label={`Session health: ${uptimePct}%`}>
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
              <span className="material-symbols-outlined text-xl" aria-hidden="true">monitoring</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#64748b' }}>HEALTH</span>
          </div>
          <p className="text-sm mb-1" style={{ color: '#64748b' }}>Session Health</p>
          <p className="text-3xl font-bold text-white">{uptimePct}%</p>
          <div
            className="w-full h-1.5 rounded-full mt-3 overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            role="progressbar"
            aria-valuenow={uptimePct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Session health percentage"
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${uptimePct}%`,
                backgroundColor: uptimePct >= 80 ? '#13a4ec' : uptimePct >= 60 ? '#f59e0b' : '#f43f5e',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Latest BGP Events ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <h2 className="font-bold text-white text-base">Latest BGP Events</h2>
          <Link href="/reports" className="text-xs font-bold hover:underline" style={{ color: '#13a4ec' }}>
            View All →
          </Link>
        </div>

        {latestDbEvents.length === 0 ? (
          <div className="p-8 text-center" role="status">
            <span className="material-symbols-outlined text-3xl block mb-2" style={{ color: '#334155' }} aria-hidden="true">history</span>
            <p className="text-sm text-white mb-1">No BGP events yet</p>
            <p className="text-xs" style={{ color: '#475569' }}>Events are recorded when a BGP session state changes (UP ↔ DOWN).</p>
          </div>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Latest BGP events" tabIndex={0}>
            <table className="w-full data-table" aria-label="Recent BGP state-change events">
              <thead>
                <tr>
                  <th scope="col">Severity</th>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Peer</th>
                  <th scope="col">State Change</th>
                  <th scope="col">Duration</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {latestDbEvents.map((ev: any) => {
                  const isDown = ev.eventType === 'DOWN';
                  const sevColor = isDown ? '#f43f5e' : '#13a4ec';
                  const sevLabel = isDown ? 'Critical' : 'Recovery';

                  return (
                    <tr key={ev.eventId}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: sevColor }} aria-hidden="true" />
                          <span className="text-xs font-bold uppercase" style={{ color: sevColor }}>
                            {sevLabel}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="text-sm font-medium text-white">
                          {new Date(ev.eventTimestamp).toLocaleString('en-GB')}
                        </div>
                        <div className="text-xs" style={{ color: '#64748b' }}>
                          {fmtRelative(new Date(ev.eventTimestamp))}
                        </div>
                      </td>

                      <td>
                        <Link href={`/peers/${encodeURIComponent(ev.peerIp)}`}
                          className="text-sm font-bold hover:opacity-75 focus-ring rounded"
                          style={{ color: '#13a4ec' }}>
                          {ev.peerIp}
                        </Link>
                        {ev.peerDescription && (
                          <div className="text-xs font-medium" style={{ color: '#94a3b8' }}>{ev.peerDescription}</div>
                        )}
                        <div className="text-xs" style={{ color: '#64748b' }}>
                          AS{ev.asn?.toString()} · {ev.organizationName}
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              backgroundColor: isDown ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
                              color: isDown ? '#10b981' : '#f43f5e',
                            }}>
                            {isDown ? 'Established' : 'Any State'}
                          </span>
                          <span className="material-symbols-outlined text-sm" style={{ color: '#475569' }} aria-label="changed to">arrow_forward</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              backgroundColor: isDown ? 'rgba(244,63,94,0.12)' : 'rgba(19,164,236,0.12)',
                              color: isDown ? '#f43f5e' : '#13a4ec',
                            }}>
                            {isDown ? 'Down' : 'Recovered'}
                          </span>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{ev.deviceName}</div>
                      </td>

                      <td>
                        <span className="font-medium text-sm"
                          style={{ color: ev.downtimeDuration ? '#f59e0b' : '#475569' }}>
                          {fmtDur(ev.downtimeDuration)}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/peers/${encodeURIComponent(ev.peerIp)}`}
                          className="btn-ghost text-xs"
                          aria-label={`View peer ${ev.peerIp}`}>
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
