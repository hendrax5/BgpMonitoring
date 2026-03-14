import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

async function savePlatformSettings(formData: FormData) {
    'use server';
    const session = await requireSession();
    if (session.role !== 'superadmin') redirect('/');
    const appName = formData.get('app_name') as string;
    const monitoringName = formData.get('monitoring_name') as string;
    const companyName = formData.get('company_name') as string;

    const entries = [
        { key: 'app_name', value: appName },
        { key: 'monitoring_name', value: monitoringName },
        { key: 'company_name', value: companyName },
    ].filter(e => e.value !== null && e.value !== undefined);

    for (const { key, value } of entries) {
        await (prisma as any).globalSettings.upsert({
            where: { key },
            create: { key, value },
            update: { value }
        });
    }
    revalidatePath('/admin/settings');
    revalidatePath('/');
}

export default async function AdminSettingsPage() {
    const session = await requireSession();
    if (session.role !== 'superadmin') redirect('/');

    const settings = await (prisma as any).globalSettings.findMany();
    const cfg: Record<string, string> = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
                style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div>
                    <div className="flex items-center gap-2 text-xs mb-0.5">
                        <Link href="/admin" className="hover:text-white" style={{ color: '#f59e0b' }}>
                            <span className="font-bold uppercase tracking-wider">Admin</span>
                        </Link>
                        <span style={{ color: '#475569' }}>/</span>
                        <span className="text-white">Platform Settings</span>
                    </div>
                    <h2 className="text-white font-bold text-base">Platform Configuration</h2>
                </div>
                <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
                    ← Back to Admin
                </Link>
            </header>

            <main className="p-6 max-w-2xl">
                <div className="card p-6">
                    <h3 className="font-bold text-white mb-1">Branding & Identity</h3>
                    <p className="text-xs mb-6" style={{ color: '#64748b' }}>
                        Customize the name shown in the sidebar, browser tab, and dashboard header.
                    </p>
                    <form action={savePlatformSettings} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>
                                App / Website Name
                            </label>
                            <input type="text" name="app_name"
                                defaultValue={cfg['app_name'] || 'BGP Monitor'}
                                placeholder="e.g. BGP Monitor" className="form-input w-full" />
                            <p className="text-[11px] mt-1" style={{ color: '#475569' }}>Ditampilkan di browser tab title</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>
                                Monitoring System Name
                            </label>
                            <input type="text" name="monitoring_name"
                                defaultValue={cfg['monitoring_name'] || 'BGP Monitoring'}
                                placeholder="e.g. Network Eye" className="form-input w-full" />
                            <p className="text-[11px] mt-1" style={{ color: '#475569' }}>Ditampilkan di header dashboard dan sidebar</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>
                                Company / Platform Name
                            </label>
                            <input type="text" name="company_name"
                                defaultValue={cfg['company_name'] || ''}
                                placeholder="e.g. PT Mitra Solusi" className="form-input w-full" />
                            <p className="text-[11px] mt-1" style={{ color: '#475569' }}>Ditampilkan di logo sidebar sebagai brand owner</p>
                        </div>
                        <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                            <button type="submit"
                                className="px-6 py-2.5 rounded-xl font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #13a4ec, #0d47a1)' }}>
                                Save Platform Settings
                            </button>
                        </div>
                    </form>
                </div>

                {/* Preview */}
                <div className="card p-5 mt-4" style={{ border: '1px dashed rgba(245,158,11,0.3)' }}>
                    <p className="text-xs font-bold mb-3" style={{ color: '#f59e0b' }}>PREVIEW SIDEBAR</p>
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#13a4ec' }}>
                            <span className="material-symbols-outlined text-white text-lg">hub</span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-white">{cfg['company_name'] || 'Your Company'}</p>
                            <p className="text-[10px]" style={{ color: '#13a4ec' }}>{cfg['monitoring_name'] || 'BGP Monitoring'}</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
