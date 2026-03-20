'use client';

import Link from 'next/link';
import { useState } from 'react';

type Ev = {
    eventId: bigint;
    eventTimestamp: Date;
    peerIp: string;
    asn: bigint;
    organizationName: string;
    eventType: string;
    downtimeDuration: number | null;
    deviceName: string;
    deviceIp: string;
    peerDescription?: string | null;
};

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
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

export default function CollapsibleTable({ events, startDate, endDate, effectiveAsn }: {
    events: Ev[];
    startDate?: string;
    endDate?: string;
    effectiveAsn?: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="card overflow-hidden">
            {/* Collapse header */}
            <button
                onClick={() => setOpen(p => !p)}
                className="w-full flex items-center justify-between px-5 py-3 transition-colors hover:bg-white/5"
                style={{ borderBottom: open ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
            >
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base" style={{ color: '#64748b' }}>table_rows</span>
                    <span className="text-sm font-bold text-white">Raw Data Table</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
                        {events.length} rows
                    </span>
                </div>
                <span className="material-symbols-outlined text-sm" style={{ color: '#475569' }}>
                    {open ? 'expand_less' : 'expand_more'}
                </span>
            </button>

            {open && (
                <>
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
                                                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: sevColor }} />
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
                                                {ev.peerDescription && (
                                                    <div className="text-xs font-medium" style={{ color: '#94a3b8' }}>{ev.peerDescription}</div>
                                                )}
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
                        <a href={`/api/export/pdf?start=${startDate || ''}&end=${endDate || ''}&asn=${effectiveAsn || ''}`}
                            target="_blank"
                            className="text-xs px-3 py-1 rounded"
                            style={{ border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}>
                            Print PDF
                        </a>
                    </div>
                </>
            )}
        </div>
    );
}
