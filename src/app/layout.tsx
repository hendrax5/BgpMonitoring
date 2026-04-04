import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Sidebar from "@/app/components/Sidebar";
import AlarmManager from "@/app/components/AlarmManager";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const appNameSetting = await (prisma as any).globalSettings.findUnique({ where: { key: 'app_name' } });
    const title = appNameSetting?.value || 'BGP Monitor';
    return {
      title: `${title} | Network Monitoring`,
      description: "BGP monitoring and reporting dashboard.",
    };
  } catch {
    return {
      title: "BGP Monitor | Network Monitoring",
      description: "BGP monitoring and reporting dashboard.",
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read session and global platform settings (server-side)
  const session = await getSession();
  let appName = 'BGP Monitor';
  let monitoringName = 'BGP Monitoring';
  let companyName = '';

  try {
    // Read GlobalSettings first (superadmin-level defaults)
    const globalSettings = await (prisma as any).globalSettings.findMany();
    const gCfg: Record<string, string> = Object.fromEntries(globalSettings.map((s: any) => [s.key, s.value]));
    appName = gCfg['app_name'] || appName;
    monitoringName = gCfg['monitoring_name'] || monitoringName;
    companyName = gCfg['company_name'] || companyName;

    // Per-tenant branding overrides GlobalSettings (if user is logged in + has tenant branding)
    if (session?.tenantId && session.role !== 'superadmin') {
      const tenantSettings = await (prisma as any).appSettings.findMany({
        where: { tenantId: session.tenantId, key: { in: ['monitoring_name', 'company_name'] } }
      });
      const tCfg: Record<string, string> = Object.fromEntries(tenantSettings.map((s: any) => [s.key, s.value]));
      if (tCfg['monitoring_name']) monitoringName = tCfg['monitoring_name'];
      if (tCfg['company_name']) companyName = tCfg['company_name'];
    }
  } catch { /* Tables might not exist yet on first run */ }


  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} font-sans antialiased h-full flex`}
        style={{ backgroundColor: '#101c22', color: '#f1f5f9' }}
      >
        <Sidebar
          isSuperAdmin={session?.role === 'superadmin'}
          appName={appName}
          monitoringName={monitoringName}
          companyName={companyName}
        />
        <div className="flex-1 flex flex-col min-h-screen overflow-auto relative">
          <AlarmManager />
          {children}
        </div>
      </body>
    </html>
  );
}
