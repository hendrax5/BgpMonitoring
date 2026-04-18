import { Suspense } from 'react';
import { logout } from '@/app/actions/auth';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DashboardFilters from '@/app/components/DashboardFilters';
import DashboardContent from '@/app/components/DashboardContent';
import DashboardSkeleton from '@/app/components/DashboardSkeleton';
import UserProfileDropdown from '@/app/components/UserProfileDropdown';
import MobileSidebarToggle from '@/app/components/MobileSidebarToggle';
import SearchCommandTrigger from '@/app/components/SearchCommandTrigger';

export default async function Home({ searchParams }: { searchParams: Promise<{ device?: string; sort?: string; status?: string; search?: string; tenant?: string }> }) {
  const session = await requireSession();
  const isSuperAdmin = session.role === 'superadmin';
  
  // Note: searchParams needs to be awaited per Next.js 15+ for Page props
  const params = await searchParams;

  let tenants: { id: string; name: string }[] | undefined;
  const activeTenant = isSuperAdmin && params.tenant && params.tenant !== 'all' ? params.tenant : null;

  if (isSuperAdmin) {
    tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
  }

  // Configured devices strictly for the header dropdown filters (fast DB query)
  const devicesWhere = isSuperAdmin 
    ? (activeTenant ? { tenantId: activeTenant } : {})
    : { tenantId: session.tenantId };

  const configuredDevices = await (prisma as any).routerDevice.findMany({
    where: devicesWhere,
    select: { hostname: true },
    orderBy: { hostname: 'asc' }
  });
  const devices = Array.from(new Set(configuredDevices.map((d: any) => d.hostname))).sort() as string[];

  return (
    <div className="min-h-screen">
      {/* Top Header - Context Navigation */}
      <header className="sticky top-0 z-40 px-6 py-4 border-b flex flex-col gap-3"
        style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.05)' }}>
        
        {/* Top Row: Breadcrumbs & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <MobileSidebarToggle />
            <span style={{ color: '#64748b' }}>Network</span>
            <span className="material-symbols-outlined text-[14px]" style={{ color: '#475569' }}>chevron_right</span>
            <span className="font-bold text-white">BGP Monitor</span>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/5 text-[#94a3b8] hover:text-white transition-colors" title="Notifications">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {/* Dummy badge for alert - in real app, replace with contextual count */}
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[#0d1520]"></span>
            </button>
            <div className="hidden sm:flex items-center mr-2">
               <UserProfileDropdown username={session?.username} role={session?.role} />
            </div>
          </div>
        </div>

        {/* Bottom Row: Search & Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <SearchCommandTrigger />
          
          <div className="flex-1 flex gap-2">
            <DashboardFilters devices={devices} tenants={tenants} />
          </div>
        </div>
      </header>

      <main className="p-6 animate-fade-in" aria-label="BGP monitoring dashboard">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent session={session} searchParams={params} />
        </Suspense>
      </main>
    </div>
  );
}
