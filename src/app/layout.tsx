import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Sidebar from "@/app/components/Sidebar";
import AlarmManager from "@/app/components/AlarmManager";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LibreNMS BGP | Network Monitoring",
  description: "BGP monitoring and reporting dashboard powered by LibreNMS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-auto">
          {children}
        </div>
        <AlarmManager />
      </body>
    </html>
  );
}
