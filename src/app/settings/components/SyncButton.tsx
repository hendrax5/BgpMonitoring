'use client';

import { useState } from 'react';
import { triggerManualSync } from '@/app/actions/settings';

export default function SyncButton() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSync = async () => {
        setIsSyncing(true);
        setMessage(null);
        
        try {
            const result = await triggerManualSync();
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                // Auto-hide success message after 3 seconds
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex items-center gap-3">
            {message && (
                <span className={`text-xs px-2 py-1 rounded ${
                    message.type === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                    {message.text}
                </span>
            )}
            <button 
                onClick={handleSync}
                disabled={isSyncing}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    isSyncing 
                    ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-400' 
                    : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                }`}
                title="Force sync data from all LibreNMS APIs immediately"
            >
                <span className={`material-symbols-outlined text-[14px] ${isSyncing ? 'animate-spin' : ''}`}>
                    sync
                </span>
                {isSyncing ? 'Syncing...' : 'Refresh Data'}
            </button>
        </div>
    );
}
