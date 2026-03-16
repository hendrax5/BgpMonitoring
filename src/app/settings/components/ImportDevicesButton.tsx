'use client';

import { useRef, useState } from 'react';

export default function ImportDevicesButton() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setStatus('');
        try {
            const text = await file.text();
            const res = await fetch('/api/devices/import', {
                method: 'POST',
                body: text,
                headers: { 'Content-Type': 'text/csv' },
            });
            const json = await res.json();
            if (res.ok) {
                setStatus(`✅ Imported: ${json.imported}, Skipped: ${json.skipped}${json.errors?.length ? ` | Errors: ${json.errors.join('; ')}` : ''}`);
                // Reload page to show new devices
                if (json.imported > 0) setTimeout(() => window.location.reload(), 1500);
            } else {
                setStatus(`❌ Error: ${json.error}`);
            }
        } catch {
            setStatus('❌ Failed to import');
        } finally {
            setLoading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    }

    return (
        <div className="inline-flex flex-col items-end gap-1">
            <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFile}
            />
            <button
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)' }}
            >
                <span className="material-symbols-outlined text-sm">upload</span>
                {loading ? 'Importing...' : 'Import CSV'}
            </button>
            {status && (
                <span className="text-xs" style={{ color: status.startsWith('✅') ? '#22c55e' : '#f43f5e' }}>
                    {status}
                </span>
            )}
        </div>
    );
}
