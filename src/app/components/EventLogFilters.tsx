'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

type Asn = { asn: bigint; organizationName: string };

export default function EventLogFilters({ allAsns }: { allAsns: Asn[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [liveMode, setLiveMode] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentSearch = searchParams.get('search') || '';
  const currentAsn = searchParams.get('asn') || '';
  const currentSeverity = searchParams.get('severity') || '';
  const currentRange = searchParams.get('range') || '';
  const currentStart = searchParams.get('start') || '';
  const currentEnd = searchParams.get('end') || '';

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    return `${pathname}?${params.toString()}`;
  }

  function applyRange(range: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', range);
    params.delete('start');
    params.delete('end');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  // Live Mode — auto-refresh every 30s
  useEffect(() => {
    if (liveMode) {
      timerRef.current = setInterval(() => {
        startTransition(() => router.refresh());
      }, 30000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [liveMode, router]);

  const ranges = [
    { label: '1h', value: '1h' },
    { label: '6h', value: '6h' },
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
  ];

  const severities = [
    { label: 'All', value: '' },
    { label: '🔴 Critical', value: 'critical' },
    { label: '🔵 Recovery', value: 'recovery' },
    { label: '🟡 Flap', value: 'flap' },
  ];

  return (
    <div className="card px-5 py-4 space-y-3">
      {/* Row 1: Search + Live Mode */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#475569' }}>search</span>
          <form action={pathname}>
            {/* Preserve other params */}
            {currentAsn && <input type="hidden" name="asn" value={currentAsn} />}
            {currentSeverity && <input type="hidden" name="severity" value={currentSeverity} />}
            {currentRange && <input type="hidden" name="range" value={currentRange} />}
            <input
              type="text"
              name="search"
              defaultValue={currentSearch}
              placeholder="Search IP / ASN / Org..."
              className="form-input pl-9 w-full"
            />
          </form>
        </div>

        {/* Live Mode Toggle */}
        <button
          onClick={() => setLiveMode(p => !p)}
          className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg transition-all"
          style={{
            backgroundColor: liveMode ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
            color: liveMode ? '#10b981' : '#64748b',
            border: `1px solid ${liveMode ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: liveMode ? '#10b981' : '#475569', boxShadow: liveMode ? '0 0 6px #10b981' : 'none' }}
          />
          {liveMode ? 'LIVE ●' : 'Live Mode'}
        </button>

        {isPending && (
          <span className="text-[10px] animate-pulse" style={{ color: '#13a4ec' }}>Refreshing…</span>
        )}
      </div>

      {/* Row 2: Severity + ASN + Range + Custom dates */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Severity */}
        <select
          value={currentSeverity}
          onChange={e => startTransition(() => router.push(buildUrl({ severity: e.target.value })))}
          className="form-select"
          style={{ width: 'auto', minWidth: '140px' }}
        >
          {severities.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* ASN */}
        <select
          value={currentAsn}
          onChange={e => startTransition(() => router.push(buildUrl({ asn: e.target.value })))}
          className="form-select"
          style={{ width: 'auto', minWidth: '170px' }}
        >
          <option value="">All ASNs</option>
          {allAsns.map(a => (
            <option key={a.asn.toString()} value={a.asn.toString()}>
              AS{a.asn.toString()} – {a.organizationName}
            </option>
          ))}
        </select>

        {/* Quick time ranges */}
        <div className="flex items-center gap-1">
          {ranges.map(r => (
            <button
              key={r.value}
              onClick={() => applyRange(r.value)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{
                backgroundColor: currentRange === r.value ? 'rgba(19,164,236,0.15)' : 'rgba(255,255,255,0.04)',
                color: currentRange === r.value ? '#13a4ec' : '#64748b',
                border: `1px solid ${currentRange === r.value ? 'rgba(19,164,236,0.35)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Custom dates */}
        <form action={pathname} className="flex items-center gap-1">
          {currentAsn && <input type="hidden" name="asn" value={currentAsn} />}
          {currentSearch && <input type="hidden" name="search" value={currentSearch} />}
          {currentSeverity && <input type="hidden" name="severity" value={currentSeverity} />}
          <input type="date" name="start" defaultValue={currentStart} className="form-input" style={{ width: 'auto' }} />
          <span className="text-xs" style={{ color: '#475569' }}>–</span>
          <input type="date" name="end" defaultValue={currentEnd} className="form-input" style={{ width: 'auto' }} />
          <button type="submit" className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#13a4ec' }}>
            Apply
          </button>
        </form>

        {/* Clear all */}
        {(currentSearch || currentAsn || currentSeverity || currentRange || currentStart) && (
          <a
            href={pathname}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}
          >
            Clear
          </a>
        )}
      </div>

      {/* Active filter pills */}
      {(currentSearch || currentAsn || currentSeverity || currentRange) && (
        <div className="flex gap-2 flex-wrap items-center pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Active:</span>
          {[
            currentSearch && { label: `Search: ${currentSearch}`, key: 'search' },
            currentAsn && { label: `AS${currentAsn}`, key: 'asn' },
            currentSeverity && { label: currentSeverity, key: 'severity' },
            currentRange && { label: currentRange, key: 'range' },
          ].filter(Boolean).map((f: any) => (
            <button
              key={f.key}
              onClick={() => startTransition(() => router.push(buildUrl({ [f.key]: '' })))}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}
            >
              {f.label}
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
