"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SortableHeader from './SortableHeader';
import DeleteSessionButton from './DeleteSessionButton';
import { fmtUptime, fmtDate } from '@/lib/fmt';

export default function BgpSessionsTable({ allSessions }: { allSessions: any[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const searchParams = useSearchParams();
  const ITEMS_PER_PAGE = 50;

  const totalPages = Math.ceil(allSessions.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSessions = allSessions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Build export URL that mirrors current active filters
  const exportParams = new URLSearchParams();
  ['device', 'status', 'search'].forEach(key => {
    const val = searchParams.get(key);
    if (val) exportParams.set(key, val);
  });
  const exportUrl = `/api/export/csv?${exportParams.toString()}`;

  return (
    <div className="card overflow-hidden">
      {/* ── Table Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <h2 className="font-bold text-white text-base">BGP Peer Status</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#475569' }}>
            {allSessions.length} session{allSessions.length !== 1 ? 's' : ''}
          </span>
          <a href={exportUrl} className="btn-primary" aria-label="Export filtered sessions as CSV">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">download</span>
            Export CSV
          </a>
        </div>
      </div>

      {/* ── Data Table ── */}
      <div className="overflow-x-auto" role="region" aria-label="BGP sessions table" tabIndex={0}>
        <table className="w-full data-table" aria-label="BGP Peer Sessions">
          <thead>
            <tr>
              <th scope="col">Peer Address / Device</th>
              <th scope="col">Remote AS</th>
              <SortableHeader label="Status" sortKey="status" />
              <SortableHeader label="Uptime / Downtime" sortKey="uptime" />
              <SortableHeader label="Pfx Rcvd / Sent" sortKey="prefix" />
              <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSessions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                  <span className="material-symbols-outlined text-3xl block mb-2" style={{ color: '#334155' }}>search_off</span>
                  <span style={{ color: '#475569', fontSize: '0.875rem' }}>No BGP sessions match the current filters.</span>
                </td>
              </tr>
            ) : paginatedSessions.map((s) => {
              const isUp = s.bgpState === 'Established';
              return (
                <tr key={`${s.serverName}-${s.deviceId}-${s.peerIp}`}>

                  {/* Peer Address + Device */}
                  <td>
                    <Link
                      href={`/peers/${encodeURIComponent(s.peerIp)}`}
                      className="flex flex-col gap-0.5 hover:opacity-75 transition-opacity group focus-ring rounded"
                    >
                      <span className="font-bold text-white text-sm group-hover:text-[#13a4ec] transition-colors">
                        {s.peerIp}
                      </span>
                      {s.peerDescription && (
                        <span className="text-xs font-semibold" style={{ color: '#e2e8f0' }}>
                          {s.peerDescription}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: '#94a3b8' }}>{s.deviceName}</span>
                    </Link>
                  </td>

                  {/* Remote AS */}
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                        AS {s.remoteAsn.toString()}
                      </span>
                      <span className="text-xs" style={{ color: '#cbd5e1' }}>
                        {s.asnDictionary?.organizationName || '—'}
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td>
                    <span
                      className={isUp ? 'badge-established' : 'badge-down'}
                      role="status"
                      aria-label={isUp ? 'Session established' : 'Session down'}
                    >
                      <span className="dot" style={{ backgroundColor: isUp ? '#10b981' : '#f43f5e' }} aria-hidden="true" />
                      {isUp ? 'Established' : 'Down'}
                    </span>
                  </td>

                  {/* Uptime */}
                  <td title={`Since: ${new Date(s.stateChangedAt).toLocaleString()}`}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: isUp ? '#94a3b8' : '#f87171' }}>
                      {fmtUptime(s.stateChangedAt)}
                    </span>
                    <div className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
                      {fmtDate(s.stateChangedAt)}
                    </div>
                  </td>

                  {/* Prefixes */}
                  <td style={{ fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {s.acceptedPrefixes.toLocaleString()} / {(s.advertisedPrefixes ?? 0).toLocaleString()}
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/peers/${encodeURIComponent(s.peerIp)}`}
                        className="btn-ghost text-xs"
                        aria-label={`View details for ${s.peerIp}`}>
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">open_in_new</span>
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

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
          role="navigation"
          aria-label="Table pagination"
        >
          <span className="text-xs" style={{ color: '#64748b' }}>
            Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, allSessions.length)} of {allSessions.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              ← Previous
            </button>
            <span className="text-xs font-bold" style={{ color: '#94a3b8' }} aria-live="polite">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
