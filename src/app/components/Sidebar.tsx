'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';

// Definitions for the actual existing routes
const MENU_STRUCTURE = [
  {
    group: 'MAIN',
    items: [
      { id: 'bgp', href: '/', label: 'BGP Monitor', icon: 'monitoring' },
      { id: 'logs', href: '/reports', label: 'Event Logs', icon: 'manage_history' },
    ]
  },
  {
    group: 'OPERATIONS',
    items: [
      { id: 'routers', href: '/config-management', label: 'Routers', icon: 'router', quickAction: { icon: 'add', href: '/config-management' } },
    ]
  },
  {
    group: 'ADMINISTRATION',
    items: [
      { id: 'users', href: '/settings?tab=users', label: 'Users & Roles', icon: 'group' },
    ]
  },
  {
    group: 'SYSTEM',
    items: [
      { id: 'settings', href: '/settings', label: 'Settings', icon: 'settings' },
    ]
  }
];

interface SidebarProps {
  isSuperAdmin?: boolean;
  appName?: string;
  monitoringName?: string;
  companyName?: string;
}

function SidebarInner({ isSuperAdmin, monitoringName, companyName }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isHovering, setIsHovering] = useState(false);

  // Hide sidebar completely on auth pages
  if (pathname === '/login' || pathname === '/register') return null;

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bgpmon_favorites');
      if (saved) setFavorites(JSON.parse(saved));
    } catch { }
  }, []);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    let newFavs;
    if (favorites.includes(id)) {
      newFavs = favorites.filter(x => x !== id);
    } else {
      newFavs = [...favorites, id];
    }
    setFavorites(newFavs);
    localStorage.setItem('bgpmon_favorites', JSON.stringify(newFavs));
  };

  const displayCompany = companyName || 'BGP Monitor';
  const displayMonitoring = monitoringName || 'NOC CONTROL';

  // Determine actual width state based on hover and toggle
  const isEffectivelyCollapsed = isCollapsed && !isHovering;

  // Gather all items
  const allItems = MENU_STRUCTURE.flatMap(g => g.items);
  const favoriteItems = allItems.filter(i => favorites.includes(i.id));

  // Helper to check active
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href.includes('?')) return pathname === href.split('?')[0]; // Simple matching for settings
    return pathname.startsWith(href);
  };

  const renderLink = (item: any, isFavCategory = false) => {
    const active = isActive(item.href);
    return (
      <Link
        key={`${isFavCategory ? 'fav-' : ''}${item.id}`}
        href={item.href}
        className={`nav-link ${active ? 'active' : ''}`}
        title={item.label}
      >
        <div className="nav-link-left">
          <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
          {!isEffectivelyCollapsed && <span className="text-[13px]">{item.label}</span>}
        </div>
        
        {!isEffectivelyCollapsed && (
          <div className="flex items-center gap-1">
            {item.quickAction && (
              <span className="nav-quick-action" title="Quick Action">
                <span className="material-symbols-outlined text-[14px]">{item.quickAction.icon}</span>
              </span>
            )}
            <button 
              className="nav-quick-action" 
              onClick={(e) => toggleFavorite(e, item.id)}
              style={{ color: favorites.includes(item.id) ? '#f59e0b' : undefined, opacity: favorites.includes(item.id) ? 1 : undefined }}
            >
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: favorites.includes(item.id) ? '"FILL" 1' : '"FILL" 0' }}>star</span>
            </button>
          </div>
        )}
      </Link>
    );
  };

  return (
    <>
      <div
        id="sidebar-overlay"
        className="sidebar-overlay"
        aria-hidden="true"
        onClick={() => document.getElementById('sidebar-panel')?.classList.remove('open')}
      />

      <aside
        id="sidebar-panel"
        className={`sidebar-mobile sidebar ${isEffectivelyCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'} flex-shrink-0 border-r`}
        onMouseEnter={() => isCollapsed && setIsHovering(true)}
        onMouseLeave={() => isCollapsed && setIsHovering(false)}
        style={{
          backgroundColor: '#0a1017', /* Darker than body */
          borderColor: 'rgba(255,255,255,0.05)',
          minHeight: '100vh',
          zIndex: 40
        }}
      >
        {/* Logo / Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)', height: '64px' }}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: '#13a4ec', boxShadow: '0 0 10px rgba(19, 164, 236, 0.3)' }}>
            <span className="material-symbols-outlined text-white text-[20px]">troubleshoot</span>
          </div>
          {!isEffectivelyCollapsed && (
            <div className="min-w-0 flex-1 animate-fade-in">
              <h1 className="font-bold text-[13px] text-white truncate leading-tight tracking-wide">{displayCompany}</h1>
              <p className="text-[10px] truncate uppercase font-bold tracking-widest mt-0.5" style={{ color: '#13a4ec' }}>{displayMonitoring}</p>
            </div>
          )}
        </div>

        {/* Superadmin Banner */}
        {isSuperAdmin && !isEffectivelyCollapsed && (
          <div className="mx-4 mt-4 px-3 py-2 rounded-lg flex items-center gap-2 animate-fade-in"
            style={{ backgroundColor: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <span className="material-symbols-outlined text-sm" style={{ color: '#f59e0b' }}>admin_panel_settings</span>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Mode: Superadmin</span>
          </div>
        )}

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-4 pb-6 custom-scrollbar">
          
          {/* Render Groups */}
          {MENU_STRUCTURE.map((group, idx) => (
            <div key={group.group} className="mb-4">
              <p className="nav-group-title">{group.group}</p>
              <nav aria-label={`${group.group} menu`}>
                {group.items.map(item => renderLink(item))}
              </nav>
            </div>
          ))}

          {/* Favorites Group */}
          {favoriteItems.length > 0 && (
            <div className="mt-6 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <p className="nav-group-title flex items-center gap-1" style={{ color: '#f59e0b' }}>
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>star</span>
                Favorites
              </p>
              <nav aria-label="Favorites menu">
                {favoriteItems.map(item => renderLink(item, true))}
              </nav>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="px-3 pb-4 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded hover:bg-white/5 transition-colors text-slate-500 hover:text-slate-300"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<aside className="w-64 flex-shrink-0 flex flex-col border-r bg-[#0a1017] border-white/5 min-h-screen" />}>
      <SidebarInner {...props} />
    </Suspense>
  )
}
