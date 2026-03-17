"use client";

import { useState } from 'react';
import Link from 'next/link';
import SortableHeader from './SortableHeader';
import DeleteSessionButton from './DeleteSessionButton';

export default function BgpSessionsTable({ allSessions }: { allSessions: any[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const totalPages = Math.ceil(allSessions.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSessions = allSessions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const fmt = (dateStr: string) => {
    const date = new Date(dateStr);
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

  const fmtDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
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
            {paginatedSessions.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
                No BGP sessions found for current filters.
              </td></tr>
            ) : paginatedSessions.map((s) => {
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
                      {isUp ? 'Established' : 'Down'}
                    </span>
                  </td>
                  <td title={`Since: ${new Date(s.stateChangedAt).toLocaleString()}`}>
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
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/peers/${encodeURIComponent(s.peerIp)}`}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                        style={{ color: '#13a4ec', border: '1px solid rgba(19,164,236,0.3)' }}>
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Details
                      </Link>
                      {!isUp && (
                        <DeleteSessionButton
                          serverName={s.serverName}
                          deviceId={s.deviceId}
                          peerIp={s.peerIp}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs" style={{ color: '#64748b' }}>
            Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, allSessions.length)} of {allSessions.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
              Previous
            </button>
            <span className="text-xs font-bold" style={{ color: '#94a3b8' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
