'use client';

import { useRef } from 'react';
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

    // useRef-based debounce (avoids polluting window object)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleDeviceChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('sort');
        if (value === 'all') params.delete('device');
        else params.set('device', value);
        params.delete('status');
        startTransition(() => {
            router.push(`/?${params.toString()}`);
        });
    };

    const handleSearch = (val: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (val) params.set('search', val);
            else params.delete('search');
            startTransition(() => {
                router.push(`/?${params.toString()}`);
            });
        }, 400);
    };

    const searchId = 'peer-search';
    const deviceId = 'device-filter';

    return (
        <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter BGP sessions">
            <div className="flex items-center gap-2 mr-2">
                <label htmlFor={searchId} className="sr-only">Search by IP or AS number</label>
                <span className="material-symbols-outlined text-sm" style={{ color: '#475569' }} aria-hidden="true">search</span>
                <input
                    id={searchId}
                    type="search"
                    placeholder="Search IP or AS…"
                    defaultValue={initSearch}
                    onChange={(e) => handleSearch(e.target.value)}
                    className={`form-input text-sm py-1.5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ width: '180px' }}
                    disabled={isPending}
                    aria-label="Search by IP or AS number"
                />
            </div>

            <label htmlFor={deviceId} className="text-xs font-medium flex-shrink-0" style={{ color: '#475569' }}>
                Device:
            </label>
            <div className="relative">
                <select
                    id={deviceId}
                    value={currentDevice}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className={`form-select text-sm ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ width: 'auto', minWidth: '140px' }}
                    disabled={isPending}
                    aria-label="Filter by device"
                >
                    <option value="all">All Devices</option>
                    {devices.map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
                {isPending && (
                    <div className="absolute top-1/2 right-7 -translate-y-1/2 pointer-events-none" aria-hidden="true">
                        <span className="material-symbols-outlined text-[#13a4ec] animate-spin text-[16px]">refresh</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DashboardFilters({ devices }: Props) {
    return (
        <Suspense fallback={<div className="h-8 w-64 bg-white/5 animate-pulse rounded" aria-label="Loading filters…" />}>
            <DashboardFiltersInner devices={devices} />
        </Suspense>
    );
}
