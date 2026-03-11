'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Overview', icon: 'dashboard' },
  { href: '/reports', label: 'BGP Events', icon: 'manage_history' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  if (pathname === '/login') return null;

  const currentStatus = searchParams.get('status') || 'all';

  const handleStatusFilter = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val === 'all') params.delete('status');
    else params.set('status', val);
    router.push(`/?${params.toString()}`);
  };

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
        <h1 className="font-bold text-sm tracking-tight text-white">
          ION <span style={{ color: '#13a4ec' }}>BGP Monitoring</span>
        </h1>
      </div>

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

      {/* Quick Filter — dropdown with visible colors */}
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
            {/* Custom chevron */}
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-sm"
              style={{ color: '#475569' }}>expand_more</span>
          </div>
          {/* Active indicator dot */}
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
