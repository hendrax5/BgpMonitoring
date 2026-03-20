'use client';

import type { IncidentStats } from '@/app/actions/reports';

export default function LiveIncidentBar({ stats }: { stats: IncidentStats }) {
  if (stats.downCount === 0) return null;

  return (
    <div
      className="mx-6 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-5 py-4"
      style={{
        background: 'linear-gradient(135deg, rgba(244,63,94,0.12) 0%, rgba(244,63,94,0.05) 100%)',
        border: '1px solid rgba(244,63,94,0.3)',
      }}
    >
      {/* Left — incident count */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-lg animate-pulse">🔥</span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#f43f5e' }}>
            Active Incidents
          </p>
          <p className="text-3xl font-black text-white leading-none">{stats.downCount}</p>
        </div>
      </div>

      <div className="h-px sm:h-10 sm:w-px bg-white/10 flex-shrink-0" />

      {/* Middle — top impact */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>
          Top Impact
        </p>
        {stats.topImpactAsn ? (
          <p className="text-sm font-bold text-white truncate">
            AS{stats.topImpactAsn} →{' '}
            <span style={{ color: '#f43f5e' }}>{stats.topImpactCount} peer{stats.topImpactCount > 1 ? 's' : ''} DOWN</span>
          </p>
        ) : (
          <p className="text-sm text-white/50">No ASN data</p>
        )}
        {stats.topImpactOrg && (
          <p className="text-xs truncate" style={{ color: '#94a3b8' }}>{stats.topImpactOrg}</p>
        )}
      </div>

      <div className="h-px sm:h-10 sm:w-px bg-white/10 flex-shrink-0 hidden sm:block" />

      {/* Right — last event */}
      <div className="flex-shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>
          Last Event
        </p>
        {stats.lastEventTime ? (
          <p className="text-sm font-mono font-bold text-white">
            {stats.lastEventTime}
            {stats.lastEventIp && (
              <span className="font-normal text-xs ml-2" style={{ color: '#94a3b8' }}>
                → {stats.lastEventIp}
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm" style={{ color: '#475569' }}>No recent event</p>
        )}
      </div>

      {/* CTA */}
      <a
        href="#timeline"
        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap"
        style={{ backgroundColor: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}
      >
        View All Incidents
        <span className="material-symbols-outlined text-sm">arrow_downward</span>
      </a>
    </div>
  );
}
