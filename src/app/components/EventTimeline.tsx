'use client';

import Link from 'next/link';
import { useState } from 'react';

type HistoricalEvent = {
  eventId: bigint;
  eventTimestamp: Date;
  peerIp: string;
  asn: bigint;
  organizationName: string;
  eventType: string;
  downtimeDuration: number | null;
  deviceName: string;
  deviceIp: string;
  serverName: string;
  peerDescription?: string | null;
};

type Props = { events: HistoricalEvent[] };

// Group consecutive events belonging to the same ASN into incident groups
function groupEvents(events: HistoricalEvent[]) {
  const groups: { asn: string; org: string; events: HistoricalEvent[] }[] = [];
  for (const ev of events) {
    const asnStr = ev.asn.toString();
    const last = groups[groups.length - 1];
    if (last && last.asn === asnStr) {
      last.events.push(ev);
    } else {
      groups.push({ asn: asnStr, org: ev.organizationName, events: [ev] });
    }
  }
  return groups;
}

const fmtDur = (sec: number | null) => {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  if (m < 1) return `${sec}s`;
  if (m < 60) return `${m}m ${sec % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const fmtRelative = (date: Date) => {
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const isNew = (date: Date) => Date.now() - date.getTime() < 5 * 60 * 1000;

function EventCard({ ev }: { ev: HistoricalEvent }) {
  const isDown = ev.eventType === 'DOWN';
  const isUp = ev.eventType === 'UP';
  const borderColor = isDown ? '#f43f5e' : isUp ? '#13a4ec' : '#f59e0b';
  const bgColor = isDown
    ? 'rgba(244,63,94,0.04)'
    : isUp
      ? 'rgba(19,164,236,0.04)'
      : 'rgba(245,158,11,0.04)';

  const sevLabel = isDown ? 'Critical' : isUp ? 'Recovery' : 'Info';
  const fromState = isDown ? 'Established' : 'Any State';
  const toState = isDown ? 'Down' : isUp ? 'Established' : '—';
  const dur = fmtDur(ev.downtimeDuration);
  const fresh = isNew(ev.eventTimestamp);

  return (
    <div
      className="relative flex gap-4 p-4 rounded-lg transition-all duration-200 group"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        backgroundColor: bgColor,
        border: `1px solid rgba(255,255,255,0.05)`,
        borderLeftWidth: '3px',
        borderLeftColor: borderColor,
      }}
    >
      {/* NOW badge */}
      {fresh && (
        <span
          className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{ backgroundColor: borderColor, color: 'white' }}
        >
          NOW
        </span>
      )}

      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: borderColor, boxShadow: `0 0 8px ${borderColor}60` }}
        />
        <div className="w-px flex-1 mt-2" style={{ backgroundColor: 'rgba(255,255,255,0.07)', minHeight: '20px' }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          {/* Left: timestamp + severity */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ color: borderColor, backgroundColor: `${borderColor}18` }}
            >
              {sevLabel}
            </span>
            <span className="text-xs font-bold text-white">
              {ev.eventTimestamp.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}
            </span>
            <span className="text-[10px]" style={{ color: '#475569' }}>{fmtRelative(ev.eventTimestamp)}</span>
          </div>

          {/* Right: downtime + Investigate */}
          <div className="flex items-center gap-2">
            {dur && (
              <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>
                ⏱ {dur}
              </span>
            )}
            <Link
              href={`/peers/${encodeURIComponent(ev.peerIp)}`}
              className="text-[11px] font-bold px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec', border: '1px solid rgba(19,164,236,0.25)' }}
            >
              Investigate →
            </Link>
          </div>
        </div>

        {/* Peer + state change row */}
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <Link
            href={`/peers/${encodeURIComponent(ev.peerIp)}`}
            className="text-sm font-black hover:opacity-80 transition-opacity"
            style={{ color: '#e2e8f0' }}
          >
            {ev.peerIp}
          </Link>
          {ev.peerDescription && (
            <span className="text-xs" style={{ color: '#64748b' }}>{ev.peerDescription}</span>
          )}
          <span className="text-[10px]" style={{ color: '#334155' }}>·</span>
          <span className="text-xs" style={{ color: '#64748b' }}>AS{ev.asn.toString()}</span>

          {/* State change arrow */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(16,185,129,0.1)',
                color: '#10b981',
              }}
            >
              {fromState}
            </span>
            <span className="material-symbols-outlined text-sm" style={{ color: '#334155' }}>arrow_forward</span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{
                backgroundColor: isDown ? 'rgba(244,63,94,0.1)' : 'rgba(19,164,236,0.1)',
                color: isDown ? '#f43f5e' : '#13a4ec',
              }}
            >
              {toState}
            </span>
          </div>
        </div>

        {/* Device row */}
        <p className="text-[10px] mt-1.5" style={{ color: '#334155' }}>
          via <span style={{ color: '#475569' }}>{ev.deviceName || ev.serverName}</span>
          {ev.deviceIp && <span style={{ color: '#2d3d4f' }}> ({ev.deviceIp})</span>}
        </p>
      </div>
    </div>
  );
}

function IncidentGroup({ asn, org, events }: { asn: string; org: string; events: HistoricalEvent[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const downCount = events.filter(e => e.eventType === 'DOWN').length;
  const hasDown = downCount > 0;

  return (
    <div className="space-y-2">
      {/* Group header */}
      {events.length > 1 && (
        <button
          onClick={() => setCollapsed(p => !p)}
          className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ backgroundColor: hasDown ? 'rgba(244,63,94,0.12)' : 'rgba(19,164,236,0.12)', color: hasDown ? '#f43f5e' : '#13a4ec' }}
          >
            INCIDENT GROUP
          </span>
          <span className="text-xs font-bold text-white">AS{asn}</span>
          <span className="text-xs" style={{ color: '#64748b' }}>{org}</span>
          <span className="text-[10px] ml-2" style={{ color: '#475569' }}>
            {events.length} events {hasDown && `· ${downCount} DOWN`}
          </span>
          <span className="ml-auto material-symbols-outlined text-sm" style={{ color: '#475569' }}>
            {collapsed ? 'expand_more' : 'expand_less'}
          </span>
        </button>
      )}

      {!collapsed && (
        <div className="space-y-2 pl-4">
          {events.map(ev => (
            <EventCard key={ev.eventId.toString()} ev={ev} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="material-symbols-outlined text-5xl" style={{ color: '#1e293b' }}>event_busy</span>
        <p className="text-base font-bold text-white">No events match your filters</p>
        <p className="text-sm" style={{ color: '#475569' }}>Try adjusting the time range or clearing filters.</p>
      </div>
    );
  }

  const groups = groupEvents(events);

  return (
    <div className="space-y-3" id="timeline">
      {/* Count header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
          {events.length} event{events.length !== 1 ? 's' : ''} · {groups.length} group{groups.length !== 1 ? 's' : ''}
        </p>
        <p className="text-[10px]" style={{ color: '#334155' }}>Newest first</p>
      </div>

      {groups.map((g, i) => (
        <IncidentGroup key={`${g.asn}-${i}`} asn={g.asn} org={g.org} events={g.events} />
      ))}
    </div>
  );
}
