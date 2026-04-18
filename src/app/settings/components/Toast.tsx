'use client';
import { useState, useEffect } from 'react';

export default function Toast({ message, type }: { message: string, type: 'error' | 'success' }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => setVisible(false), 4000);
        return () => clearTimeout(t);
    }, []);

    if (!visible) return null;

    if (type === 'error') {
        return (
            <div className="card px-4 py-3 flex items-center justify-between gap-3 bg-rose-500/10 border-rose-500/30 text-rose-400 animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg">error</span>
                    <span className="text-sm">{message}</span>
                </div>
                <button onClick={() => setVisible(false)} className="text-rose-400 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>
        );
    }
    
    return (
        <div className="card px-4 py-3 flex items-center justify-between gap-3 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-fade-in-up">
            <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-lg">check_circle</span>
                <span className="text-sm">{message}</span>
            </div>
            <button onClick={() => setVisible(false)} className="text-emerald-400 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
            </button>
        </div>
    );
}
