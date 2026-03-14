import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function addDeviceCredential(formData: FormData) {
    'use server';
    const deviceIp = formData.get('deviceIp') as string;
    const sshUser = formData.get('sshUser') as string;
    const sshPass = formData.get('sshPass') as string;
    const sshPort = parseInt(formData.get('sshPort') as string || '22', 10);
    const vendor = formData.get('vendor') as string;
    const notes = formData.get('notes') as string;

    await prisma.deviceCredential.upsert({
        where: { deviceIp },
        create: { deviceIp, sshUser, sshPass, sshPort, vendor, notes },
        update: { sshUser, sshPass, sshPort, vendor, notes },
    });
    revalidatePath('/settings/devices');
    redirect('/settings/devices');
}

async function deleteDeviceCredential(id: number) {
    'use server';
    await prisma.deviceCredential.delete({ where: { id } });
    revalidatePath('/settings/devices');
}

const VENDOR_LABELS: Record<string, string> = {
    cisco: 'Cisco IOS/XR',
    juniper: 'Juniper JunOS',
    huawei: 'Huawei VRP',
    mikrotik: 'MikroTik RouterOS',
    arista: 'Arista EOS',
};

export default async function DeviceCredentialsPage() {
    const creds = await prisma.deviceCredential.findMany({ orderBy: { deviceIp: 'asc' } });

    // Get all known device IPs from current BGP state for autocomplete suggestions
    let knownDevices: { deviceIp: string; deviceName: string }[] = [];
    try {
        const allKeys = await redis.keys('BgpSession:*');
        const knownDevicesMap = new Map();
        if (allKeys.length > 0) {
            const pipeline = redis.pipeline();
            allKeys.forEach(k => pipeline.hget(k, 'data'));
            const results = await pipeline.exec();
            results?.forEach(([err, res]) => {
                if (res) {
                    const s = JSON.parse(res as string);
                    if (s.deviceIp && s.deviceName) {
                        knownDevicesMap.set(s.deviceIp, { deviceIp: s.deviceIp, deviceName: s.deviceName });
                    }
                }
            });
        }
        knownDevices = Array.from(knownDevicesMap.values()).sort((a, b) => a.deviceName.localeCompare(b.deviceName));
    } catch (err) {
        console.error('[DevicesPage] Failed to fetch device list from Redis:', err);
    }

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
                style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div>
                    <div className="flex items-center gap-2 text-xs mb-0.5" style={{ color: '#475569' }}>
                        <a href="/settings" className="hover:text-white transition-colors">Settings</a>
                        <span>/</span>
                        <span className="text-white">Device Credentials</span>
                    </div>
                    <h2 className="text-white font-bold text-base">SSH Device Credentials</h2>
                </div>
                <a href="/settings" className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
                    ← Back to Settings
                </a>
            </header>

            <main className="p-6 max-w-5xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Add Form */}
                    <div className="md:col-span-1 card p-5">
                        <h3 className="font-bold text-white mb-1">Add / Update Device</h3>
                        <p className="text-xs mb-5" style={{ color: '#64748b' }}>Credentials stored per device IP. Used by SSH Live Check.</p>

                        <form action={addDeviceCredential} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Device IP</label>
                                <select name="deviceIp" className="form-select" required>
                                    <option value="">— Select device —</option>
                                    {knownDevices.map(d => (
                                        <option key={d.deviceIp} value={d.deviceIp}>
                                            {d.deviceName} ({d.deviceIp})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Vendor / OS</label>
                                <select name="vendor" className="form-select" required>
                                    {Object.entries(VENDOR_LABELS).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>SSH Port</label>
                                    <input type="number" name="sshPort" defaultValue="22" className="form-input" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Notes (optional)</label>
                                    <input type="text" name="notes" placeholder="e.g. Core PE" className="form-input" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Username</label>
                                <input type="text" name="sshUser" placeholder="admin" className="form-input" required />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Password</label>
                                <input type="password" name="sshPass" placeholder="••••••••" className="form-input" required />
                            </div>

                            <button type="submit" className="w-full py-2.5 text-sm font-bold rounded-lg text-white mt-2"
                                style={{ backgroundColor: '#13a4ec' }}>
                                Save Credential
                            </button>
                        </form>
                    </div>

                    {/* Credentials List */}
                    <div className="md:col-span-2 card overflow-hidden self-start">
                        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                            <h2 className="font-bold text-white">Saved Device Credentials</h2>
                            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{creds.length} device{creds.length !== 1 ? 's' : ''} configured</p>
                        </div>

                        {creds.length === 0 ? (
                            <div className="p-12 text-center">
                                <span className="material-symbols-outlined text-4xl block mb-3" style={{ color: '#334155' }}>device_hub</span>
                                <p className="font-medium text-white mb-1">No devices configured</p>
                                <p className="text-sm" style={{ color: '#475569' }}>Add credentials to enable SSH Live Check on Peering Details pages.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full data-table">
                                    <thead>
                                        <tr>
                                            <th>Device</th>
                                            <th>Vendor</th>
                                            <th>SSH</th>
                                            <th>Notes</th>
                                            <th style={{ textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {creds.map((c: any) => (
                                            <tr key={c.id}>
                                                <td>
                                                    <span className="font-mono font-bold text-white">{c.deviceIp}</span>
                                                </td>
                                                <td>
                                                    <span className="text-sm" style={{ color: '#94a3b8' }}>
                                                        {VENDOR_LABELS[c.vendor] || c.vendor}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="text-xs font-mono" style={{ color: '#64748b' }}>
                                                        {c.sshUser}@:{c.sshPort}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="text-xs" style={{ color: '#475569' }}>{c.notes || '—'}</span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <form action={async () => {
                                                        'use server';
                                                        await deleteDeviceCredential(c.id);
                                                    }}>
                                                        <button type="submit" className="p-1.5 rounded-lg transition-colors"
                                                            style={{ color: '#475569' }} title="Delete">
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        </button>
                                                    </form>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
