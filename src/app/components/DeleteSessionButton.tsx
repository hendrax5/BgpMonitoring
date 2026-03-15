'use client';
import { removeSession } from '@/app/actions/settings';

export default function DeleteSessionButton({ serverName, deviceId, peerIp }: {
    serverName: string; deviceId: string; peerIp: string;
}) {
    return (
        <form action={removeSession}>
            <input type="hidden" name="serverName" value={serverName} />
            <input type="hidden" name="deviceId" value={deviceId} />
            <input type="hidden" name="peerIp" value={peerIp} />
            <button
                type="submit"
                title="Hapus session dari dashboard"
                onClick={(e) => { if (!confirm(`Hapus peer ${peerIp} dari dashboard?`)) e.preventDefault(); }}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                style={{ color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)', background: 'transparent', cursor: 'pointer' }}
            >
                <span className="material-symbols-outlined text-sm">delete</span>
                Hapus
            </button>
        </form>
    );
}
