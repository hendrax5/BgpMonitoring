'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface Props {
    devices: string[];
}

function DashboardFiltersInner({ devices }: Props) {
    const router = useRouter();
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
        router.push(`/?${params.toString()}`);
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
                            router.push(`/?${params.toString()}`);
                        }, 400);
                    }}
                    className="form-input text-sm py-1.5"
                    style={{ width: '180px' }}
                />
            </div>

            <span className="text-xs font-medium flex-shrink-0" style={{ color: '#475569' }}>Device:</span>
            <select
                id="device-filter"
                value={currentDevice}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="form-select text-sm"
                style={{ width: 'auto', minWidth: '140px' }}
            >
                <option value="all">All Devices</option>
                {devices.map(d => (
                    <option key={d} value={d}>{d}</option>
                ))}
            </select>
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
