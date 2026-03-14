import type { ReactNode } from "react";

// Auth pages (login, register) — NO sidebar, NO AlarmManager
export default function AuthLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
