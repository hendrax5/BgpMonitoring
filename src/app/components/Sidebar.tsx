'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const navItems = [
  { href: '/', label: 'Overview', icon: 'dashboard' },
  { href: '/reports', label: 'BGP Events', icon: 'manage_history' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

const adminItems = [
  { href: '/admin', label: 'Overview', icon: 'admin_panel_settings' },
  { href: '/admin/devices', label: 'Device Assignment', icon: 'device_hub' },
  { href: '/admin/settings', label: 'Platform Settings', icon: 'tune' },
];

interface SidebarProps {
  isSuperAdmin?: boolean;
  appName?: string;
  monitoringName?: string;
  companyName?: string;
}

function SidebarInner({ isSuperAdmin, appName, monitoringName, companyName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Hide sidebar completely on auth pages
  if (pathname === '/login' || pathname === '/register') return null;

  const currentStatus = searchParams.get('status') || 'all';

  const handleStatusFilter = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val === 'all') params.delete('status');
    else params.set('status', val);
    router.push(`/?${params.toString()}`);
  };

  const displayCompany = companyName || 'BGP Monitor';
  const displayMonitoring = monitoringName || 'BGP Monitoring';

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col border-r"
      style={{
        backgroundColor: '#0d1520',
        borderColor: 'rgba(255,255,255,0.07)',
        minHeight: '100vh',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: '#13a4ec' }}>
          <span className="material-symbols-outlined text-white text-lg">hub</span>
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-xs text-white truncate">{displayCompany}</h1>
          <p className="text-[10px] truncate" style={{ color: '#13a4ec' }}>{displayMonitoring}</p>
        </div>
      </div>

      {/* Superadmin Banner */}
      {isSuperAdmin && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg flex items-center gap-2"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <span className="material-symbols-outlined text-sm" style={{ color: '#f59e0b' }}>admin_panel_settings</span>
          <span className="text-[11px] font-bold" style={{ color: '#f59e0b' }}>Superadmin Mode</span>
        </div>
      )}

      {/* Main Nav */}
      <div className="px-3 pt-5">
        <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
          Main View
        </p>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${isActive ? ' active' : ''}`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Admin Section — only for superadmin */}
      {isSuperAdmin && (
        <div className="px-3 pt-5 mt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>
            Platform Admin
          </p>
          <nav className="space-y-0.5">
            {adminItems.map((item) => {
              const isActive = item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link${isActive ? ' active' : ''}`}
                  style={{ color: isActive ? '#f59e0b' : undefined }}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Quick Filter */}
      <div className="px-3 pt-5 mt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
          Quick Filter
        </p>
        <div className="px-2">
          <label className="block text-[11px] mb-1 font-medium" style={{ color: '#94a3b8' }}>Session Status</label>
          <div className="relative">
            <select
              value={currentStatus}
              onChange={(e) => handleStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 2rem 0.5rem 0.875rem',
                backgroundColor: '#131f28',
                border: `1px solid ${currentStatus !== 'all'
                  ? (currentStatus === 'Established' ? 'rgba(16,185,129,0.5)' : 'rgba(244,63,94,0.5)')
                  : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '0.5rem',
                color: '#f1f5f9',
                fontSize: '0.8rem',
                outline: 'none',
                appearance: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all" style={{ backgroundColor: '#131f28', color: '#f1f5f9' }}>● Any Status</option>
              <option value="Established" style={{ backgroundColor: '#131f28', color: '#10b981' }}>● Established</option>
              <option value="down" style={{ backgroundColor: '#131f28', color: '#f43f5e' }}>● Down / Idle</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-sm"
              style={{ color: '#475569' }}>expand_more</span>
          </div>
          {currentStatus !== 'all' && (
            <div className="flex items-center gap-1.5 mt-1.5 px-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: currentStatus === 'Established' ? '#10b981' : '#f43f5e' }} />
              <span className="text-[10px] font-medium"
                style={{ color: currentStatus === 'Established' ? '#10b981' : '#f43f5e' }}>
                Filtering: {currentStatus === 'Established' ? 'Established only' : 'Down / Idle only'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Health Card */}
      <div className="mt-auto px-4 pb-5">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[11px] mb-1.5" style={{ color: '#64748b' }}>System Status</p>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }}></span>
            <span className="text-sm font-semibold text-white">Operational</span>
          </div>
          <p className="text-[10px] mt-1" style={{ color: '#475569' }}>Worker syncing every 1m</p>
        </div>
      </div>
    </aside>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={
      <aside className="w-56 flex-shrink-0 flex flex-col border-r bg-[#0d1520] border-white/10 min-h-screen"></aside>
    }>
      <SidebarInner {...props} />
    </Suspense>
  )
}
