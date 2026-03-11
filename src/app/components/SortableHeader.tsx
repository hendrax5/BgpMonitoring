'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface SortableHeaderProps {
    label: string;
    sortKey: string;
    className?: string;
    style?: React.CSSProperties;
    align?: 'left' | 'right';
}

function SortableHeaderInner({ label, sortKey, className, style, align = 'left' }: SortableHeaderProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentSort = searchParams.get('sort') || '';

    const isActive = currentSort === sortKey || currentSort === `${sortKey}-asc`;
    const isAsc = currentSort === `${sortKey}-asc`;
    const nextSort = isActive && !isAsc ? `${sortKey}-asc` : sortKey;

    const handleClick = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('sort', nextSort);
        router.push(`/?${params.toString()}`);
    };

    return (
        <th
            onClick={handleClick}
            className={className}
            style={{
                cursor: 'pointer',
                userSelect: 'none',
                textAlign: align,
                ...style
            }}
            title={`Sort by ${label}`}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                <span style={{ color: isActive ? '#13a4ec' : '#334155', fontSize: '0.6rem' }}>
                    {isActive ? (isAsc ? '▲' : '▼') : '⇅'}
                </span>
            </span>
        </th>
    );
}

export default function SortableHeader(props: SortableHeaderProps) {
    return (
        <Suspense fallback={<th className={props.className} style={props.style}>{props.label}</th>}>
            <SortableHeaderInner {...props} />
        </Suspense>
    )
}
