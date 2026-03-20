'use client';

/**
 * ClientDynamicZone – a thin client shell that lazy-loads the two components
 * that require `ssr: false` (EventLogFilters uses useRouter / window APIs,
 * CollapsibleTable has interactive state).
 *
 * Next.js 16+ (Turbopack) forbids dynamic({ ssr: false }) inside Server
 * Components, so we hoist both into this client boundary.
 */

import dynamic from 'next/dynamic';
import React from 'react';
import type CollapsibleTableType from '@/app/components/CollapsibleTable';

// Lazy-load with ssr: false – safe here because this file is already a CC
const EventLogFilters = dynamic(
    () => import('@/app/components/EventLogFilters'),
    { ssr: false, loading: () => <div className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} /> }
);

const CollapsibleTable = dynamic<React.ComponentProps<typeof CollapsibleTableType>>(
    () => import('@/app/components/CollapsibleTable'),
    {
        ssr: false,
        loading: () => <div className="card h-14 animate-pulse" />,
    }
);

// The server page passes all props down through this shell
interface ClientDynamicZoneProps {
    allAsns: { asn: bigint; organizationName: string }[];
    events: React.ComponentProps<typeof CollapsibleTableType>['events'];
    startDate?: string;
    endDate?: string;
    effectiveAsn?: string;
}

export default function ClientDynamicZone({
    allAsns,
    events,
    startDate,
    endDate,
    effectiveAsn,
}: ClientDynamicZoneProps) {
    return (
        <>
            <EventLogFilters allAsns={allAsns} />
            <CollapsibleTable
                events={events}
                startDate={startDate}
                endDate={endDate}
                effectiveAsn={effectiveAsn}
            />
        </>
    );
}
