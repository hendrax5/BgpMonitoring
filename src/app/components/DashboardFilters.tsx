'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useTransition } from 'react';

interface Props {
    devices: string[];
}

function DashboardFiltersInner({ devices }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const searchParams = useSearchParams();
    const currentDevice = searchParams.get('device') || 'all';
    const initSearch = searchParams.get('search') || '';

    const handleDeviceChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('sort'); // keep sort from column headers, not dropdown
        if (value === 'all') params.delete('device');
        else params.set('device', value);
        // Also clear status when switching device
        params.delete('status');
        startTransition(() => {
            router.push(`/?${params.toString()}`);
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
                <span className="material-symbols-outlined text-sm" style={{ color: '#475569' }}>search</span>
                <input 
                    type="text"
                    placeholder="Search IP or AS..."
                    defaultValue={initSearch}
                    onChange={(e) => {
                        const val = e.target.value;
                        if ((window as any)._dashSearchTimeout) clearTimeout((window as any)._dashSearchTimeout);
                        (window as any)._dashSearchTimeout = setTimeout(() => {
                            const params = new URLSearchParams(searchParams.toString());
                            if (val) params.set('search', val);
                            else params.delete('search');
                            startTransition(() => {
                                router.push(`/?${params.toString()}`);
                            });
                        }, 400);
                    }}
                    className={`form-input text-sm py-1.5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ width: '180px' }}
                    disabled={isPending}
                />
            </div>

            <span className="text-xs font-medium flex-shrink-0" style={{ color: '#475569' }}>Device:</span>
            <div className="relative">
                <select
                    id="device-filter"
                    value={currentDevice}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className={`form-select text-sm ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ width: 'auto', minWidth: '140px' }}
                    disabled={isPending}
                >
                    <option value="all">All Devices</option>
                    {devices.map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
                {isPending && (
                    <div className="absolute top-1/2 right-7 -translate-y-1/2 pointer-events-none">
                        <span className="material-symbols-outlined text-[#13a4ec] animate-spin text-[16px]">refresh</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DashboardFilters({ devices }: Props) {
    return (
        <Suspense fallback={<div className="h-8 w-64 bg-white/5 animate-pulse rounded"></div>}>
            <DashboardFiltersInner devices={devices} />
        </Suspense>
    )
}
