import { saveBackupSettings } from '@/app/actions/settings';
import SubmitButton from '@/app/components/SubmitButton';
import AlertChannelsManager from '@/app/settings/components/AlertChannelsManager';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
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

export default async function SystemTab({ branding, backupSettings, alertChannels, editAlertObj }: { branding: Record<string, string>; backupSettings: any; alertChannels: any[]; editAlertObj: any }) {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 card p-5 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                    <h4 className="font-bold text-white mb-1">Company Branding</h4>
                    <p className="text-xs mb-4 text-zinc-400">Customizes the sidebar logo names.</p>
                    <form action={saveBranding} className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Company Name</label>
                            <input type="text" name="company_name" defaultValue={branding['company_name'] || ''} placeholder="e.g. Acme Corp"
                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Monitoring Subtitle</label>
                            <input type="text" name="monitoring_name" defaultValue={branding['monitoring_name'] || ''} placeholder="e.g. Global BGP Monitor"
                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                        </div>
                        <SubmitButton className="w-full py-2 text-sm font-bold rounded-xl text-white bg-blue-600">Simpan Branding</SubmitButton>
                    </form>
                </div>

                <div className="md:col-span-1 card p-5 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                    <h4 className="font-bold text-white mb-1">Backup Config</h4>
                    <p className="text-xs mb-4 text-zinc-400">Automated fetch polling interval.</p>
                    <form action={async (formData: FormData) => { 'use server'; await saveBackupSettings(formData); }} className="space-y-3">
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Interval Cron Job</label>
                        <select name="backup_interval_cron" defaultValue={backupSettings.intervalCron} className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                            <option value="0 * * * *">Every Hour</option>
                            <option value="0 */2 * * *">Every 2 Hours</option>
                            <option value="0 */6 * * *">Every 6 Hours</option>
                            <option value="0 0 * * *">Every Midnight</option>
                        </select>
                        <SubmitButton className="w-full py-2 text-sm font-bold rounded-xl text-white bg-blue-600">Simpan Interval</SubmitButton>
                    </form>
                </div>

                <div className="md:col-span-3">
                    <AlertChannelsManager alertChannels={alertChannels} editAlertObj={editAlertObj} />
                </div>
            </div>
        </div>
    );
}
