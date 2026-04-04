import { Suspense } from 'react';
import { logout } from '@/app/actions/auth';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DashboardFilters from '@/app/components/DashboardFilters';
import DashboardContent from '@/app/components/DashboardContent';
import DashboardSkeleton from '@/app/components/DashboardSkeleton';
import UserProfileDropdown from '@/app/components/UserProfileDropdown';

export default async function Home({ searchParams }: { searchParams: Promise<{ device?: string; sort?: string; status?: string; search?: string }> }) {
  const session = await requireSession();
  const isSuperAdmin = session.role === 'superadmin';

  // Configured devices strictly for the header dropdown filters (fast DB query)
  const configuredDevices = await (prisma as any).routerDevice.findMany({
    where: isSuperAdmin ? {} : { tenantId: session.tenantId },
    select: { hostname: true },
    orderBy: { hostname: 'asc' }
  });
  const devices = Array.from(new Set(configuredDevices.map((d: any) => d.hostname))).sort() as string[];

  // Note: searchParams needs to be awaited per Next.js 15+ for Page props
  const params = await searchParams;

  return (
    <div className="min-h-screen">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
        style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <h2 className="text-white font-bold text-base">BGP Overview Dashboard</h2>
            <p className="text-xs" style={{ color: '#64748b' }}>Live monitoring ION Network</p>
          </div>
          <DashboardFilters devices={devices} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <UserProfileDropdown username={session?.username} role={session?.role} />
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
