import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { addRouterDevice, updateRouterDevice, deleteRouterDevice, getTelegramSettings, saveTelegramSettings, getBackupSettings, saveBackupSettings, addVendorProfile, updateVendorProfile, deleteVendorProfile } from '@/app/actions/settings';
import { addUser, updateUser, deleteUser, updateMyProfile } from '@/app/actions/users';
import SyncButton from '@/app/settings/components/SyncButton';
import RouterTestButton from '@/app/settings/components/RouterTestButton';
import ImportDevicesButton from '@/app/settings/components/ImportDevicesButton';
import SubmitButton from '@/app/components/SubmitButton';
import UserProfileDropdown from '@/app/components/UserProfileDropdown';
import AlertChannelsManager from '@/app/settings/components/AlertChannelsManager';
import Toast from '@/app/settings/components/Toast';
import ProfileTab from '@/app/settings/components/ProfileTab';
import DevicesTab from '@/app/settings/components/DevicesTab';
import UsersTab from '@/app/settings/components/UsersTab';
import SystemTab from '@/app/settings/components/SystemTab';
import VendorsTab from '@/app/settings/components/VendorsTab';
import { revalidatePath } from 'next/cache';

async function saveBranding(formData: FormData) {
    'use server';
    const session = await requireSession();
    const entries = ['monitoring_name', 'company_name'];
    for (const key of entries) {
        const value = formData.get(key) as string | null;
        if (value !== null) {
            await (prisma as any).appSettings.upsert({
                where: { tenantId_key: { tenantId: session.tenantId, key } },
                create: { tenantId: session.tenantId, key, value },
                update: { value },
            });
        }
    }
    revalidatePath('/settings');
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string; success?: string; edit?: string; editUser?: string; editVendor?: string; editAlert?: string }> }) {
    const session = await requireSession();
    const { tab, error, success, edit, editUser, editVendor, editAlert } = await searchParams;
    const activeTab = tab || 'profile';

    const editId = edit ? parseInt(edit) : null;
    const devices = await (prisma as any).routerDevice.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { createdAt: 'desc' },
        include: { sshCredential: true }
    });
    const editDevice = editId ? devices.find((d: any) => d.id === editId) : null;

    const editUserId = editUser ? parseInt(editUser) : null;
    const users = await (prisma as any).appUser.findMany({
        where: {
            tenantId: session.tenantId,
            NOT: { role: 'superadmin' }, 
        },
        orderBy: { createdAt: 'desc' }
    });
    const editUserObj = editUserId ? users.find((u: any) => u.id === editUserId) : null;

    const alertChannels = await (prisma as any).alertChannel.findMany({ where: { tenantId: session.tenantId }, orderBy: { createdAt: 'asc' } });
    const editAlertId = editAlert ? parseInt(editAlert) : null;
    const editAlertObj = editAlertId ? alertChannels.find((a: any) => a.id === editAlertId) : null;
    const backupSettings = await getBackupSettings();

    const vendorProfiles = await (prisma as any).vendorProfile.findMany({
        orderBy: { vendorName: 'asc' }
    });
    const editVendorId = editVendor ? parseInt(editVendor) : null;
    const editVendorObj = editVendorId ? vendorProfiles.find((v: any) => v.id === editVendorId) : null;

    const brandingRows = await (prisma as any).appSettings.findMany({
        where: { tenantId: session.tenantId, key: { in: ['monitoring_name', 'company_name'] } }
    });
    const branding: Record<string, string> = Object.fromEntries(brandingRows.map((r: any) => [r.key, r.value]));

    const tabs = [
        { id: 'profile', label: 'My Profile', icon: 'person', count: null },
        { id: 'devices', label: 'Monitored Routers', icon: 'router', count: devices.length },
        { id: 'users', label: 'User Management', icon: 'group', count: users.length },
        { id: 'system', label: 'Alerts & Branding', icon: 'notifications_active', count: null },
        { id: 'vendors', label: 'Universal Vendor Support', icon: 'extension', count: vendorProfiles.length }
    ];

    return (
        <div className="min-h-screen bg-[#060a11] text-zinc-300">
            {/* Top Header */}
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0d1520]">
                <div>
                    <h2 className="text-white font-bold text-base">Configuration Settings</h2>
                    <p className="text-xs text-zinc-400">Manage preferences and configurations.</p>
                </div>
                <div className="flex items-center gap-4">
                    <SyncButton />
                    <UserProfileDropdown username={session?.username} role={session?.role} />
                </div>
            </header>

            {/* Segmented Horizontal Tabs Navigation */}
            <div className="px-6 border-b border-white/5 bg-[#0a1019] sticky top-16 z-30 overflow-x-auto scrollbar-hide">
                <div className="flex gap-4">
                    {tabs.map(t => {
                        const isActive = activeTab === t.id;
                        return (
                            <a
                                key={t.id}
                                href={`/settings?tab=${t.id}`}
                                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                                    isActive 
                                    ? 'border-blue-500 text-blue-500' 
                                    : 'border-transparent text-zinc-400 hover:text-white'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[1.1rem]">{t.icon}</span>
                                {t.label}
                                {t.count !== null && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ml-1 ${isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-zinc-500'}`}>
                                        {t.count}
                                    </span>
                                )}
                            </a>
                        );
                    })}
                </div>
            </div>

            <main className="p-6 max-w-6xl space-y-6 animate-fade-in mx-auto">

                {error && <Toast message={error} type="error" />}
                {success && activeTab === 'profile' && <Toast message="Profile updated successfully." type="success" />}

                {activeTab === 'profile' && <ProfileTab session={session} />}
                {activeTab === 'devices' && <DevicesTab session={session} devices={devices} editDevice={editDevice} vendorProfiles={vendorProfiles} />}
                {activeTab === 'users' && <UsersTab session={session} users={users} editUserObj={editUserObj} />}
                {activeTab === 'system' && <SystemTab branding={branding} backupSettings={backupSettings} alertChannels={alertChannels} editAlertObj={editAlertObj} />}
                {activeTab === 'vendors' && <VendorsTab session={session} vendorProfiles={vendorProfiles} editVendorObj={editVendorObj} />}
            </main>
        </div>
    );
}

