'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function TopologyFilter({ routers }: { routers: { id: number, hostname: string }[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeRouterId = searchParams.get('routerId') || (routers.length > 0 ? routers[0].id.toString() : '');

    return (
        <div className="flex items-center gap-3">
            <label className="text-xs text-zinc-400 font-medium">Focus Node:</label>
            <select 
                className="bg-[#0a1019] text-xs text-white border border-white/10 rounded-lg px-3 py-1 outline-none"
                value={activeRouterId}
                onChange={(e) => {
                    const newId = e.target.value;
                    if (newId) router.push(`/topology?routerId=${newId}`);
                }}
            >
                {routers.length === 0 && <option value="">No routers available</option>}
                {routers.map(r => (
                    <option key={r.id} value={r.id}>{r.hostname}</option>
                ))}
            </select>
        </div>
    );
}
