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
    const globalSettings = await (prisma as any).globalSettings.findMany();
    const cfg: Record<string, string> = Object.fromEntries(globalSettings.map((s: any) => [s.key, s.value]));
    appName = cfg['app_name'] || appName;
    monitoringName = cfg['monitoring_name'] || monitoringName;
    companyName = cfg['company_name'] || companyName;
  } catch { /* GlobalSettings table might not exist yet on first run */ }

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
        <div className="flex-1 flex flex-col min-h-screen overflow-auto">
          {children}
        </div>
        <AlarmManager />
      </body>
    </html>
  );
}
