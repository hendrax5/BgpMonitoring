'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

const navItems = [
  { href: '/', label: 'Overview', icon: 'dashboard' },
  { href: '/reports', label: 'BGP Event Log', icon: 'manage_history' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
  { href: '/config-management', label: 'Config Management', icon: 'settings_backup_restore' }
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

function SidebarInner({ isSuperAdmin, monitoringName, companyName }: SidebarProps) {
  const pathname = usePathname();

  // Hide sidebar completely on auth pages
  if (pathname === '/login' || pathname === '/register') return null;

  const displayCompany = companyName || 'BGP Monitor';
  const displayMonitoring = monitoringName || 'BGP Monitoring';

  return (
    <>
      {/* Mobile overlay — clicking outside closes sidebar */}
      <div
        id="sidebar-overlay"
        className="sidebar-overlay"
        aria-hidden="true"
        onClick={() => {
          document.getElementById('sidebar-panel')?.classList.remove('open');
          document.getElementById('sidebar-overlay')?.classList.remove('open');
        }}
      />

      <aside
        id="sidebar-panel"
        className="sidebar-mobile w-56 flex-shrink-0 flex flex-col border-r"
        aria-label="Main navigation"
        style={{
          backgroundColor: '#0d1520',
          borderColor: 'rgba(255,255,255,0.07)',
          minHeight: '100vh',
        }}
      >
        {/* Logo + mobile close button */}
        <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: '#13a4ec' }}>
            <span className="material-symbols-outlined text-white text-lg">hub</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-xs text-white truncate">{displayCompany}</h1>
            <p className="text-[10px] truncate" style={{ color: '#13a4ec' }}>{displayMonitoring}</p>
          </div>
          {/* Mobile close (×) button — only visible on small screens */}
          <button
            className="md:hidden btn-ghost p-1 text-[#64748b]"
            aria-label="Close navigation"
            onClick={() => {
              document.getElementById('sidebar-panel')?.classList.remove('open');
              document.getElementById('sidebar-overlay')?.classList.remove('open');
            }}
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
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
          <nav className="space-y-0.5" aria-label="Main menu">
            {navItems.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link${isActive ? ' active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
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
            <nav className="space-y-0.5" aria-label="Admin menu">
              {adminItems.map((item) => {
                const isActive = item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link${isActive ? ' active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
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

        {/* Bottom System Status Card */}
        <div className="mt-auto px-4 pb-5">
          <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[11px] mb-1.5" style={{ color: '#64748b' }}>System Status</p>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full alert-pulse" style={{ backgroundColor: '#10b981' }}></span>
              <span className="text-sm font-semibold text-white">Operational</span>
            </div>
            <p className="text-[10px] mt-1" style={{ color: '#475569' }}>Worker syncing every 1m</p>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={
      <aside className="w-56 flex-shrink-0 flex flex-col border-r bg-[#0d1520] border-white/10 min-h-screen" />
    }>
      <SidebarInner {...props} />
    </Suspense>
  )
}

/** Call from the mobile hamburger button in the page header */
export function openMobileSidebar() {
  document.getElementById('sidebar-panel')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('open');
}
