'use client';

import { useState } from 'react';

type TestResult = {
    ok: boolean;
    message: string;
} | null;

type Results = {
    snmp: TestResult;
    cli: TestResult;
};

export default function RouterTestButton({ routerId }: { routerId: number }) {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<Results | null>(null);

    async function runTest() {
        setLoading(true);
        setResults(null);
        try {
            const res = await fetch('/api/test-router', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ routerId }),
            });
            const data = await res.json();
            setResults(data);
        } catch {
            setResults({
                snmp: { ok: false, message: 'Request failed' },
                cli: { ok: false, message: 'Request failed' },
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col gap-1.5">
            <button
                onClick={runTest}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                style={{
                    backgroundColor: loading ? 'rgba(255,255,255,0.04)' : 'rgba(19, 164, 236, 0.1)',
                    color: loading ? '#475569' : '#13a4ec',
                    border: '1px solid',
                    borderColor: loading ? 'rgba(255,255,255,0.06)' : 'rgba(19,164,236,0.25)',
                }}
            >
                <span className="material-symbols-outlined text-sm">
                    {loading ? 'hourglass_empty' : 'network_check'}
                </span>
                {loading ? 'Testing...' : 'Test'}
            </button>

            {results && (
                <div className="flex flex-col gap-1 mt-0.5">
                    <StatusPill label="SNMP" result={results.snmp} />
                    <StatusPill label="CLI" result={results.cli} />
                </div>
            )}
        </div>
    );
}

function StatusPill({ label, result }: { label: string; result: TestResult }) {
    if (!result) return null;
    return (
        <div
            className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md"
            style={{
                backgroundColor: result.ok ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
                border: '1px solid',
                borderColor: result.ok ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)',
            }}
            title={result.message}
        >
            <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: result.ok ? '#10b981' : '#f43f5e' }}
            />
            <span className="font-bold" style={{ color: result.ok ? '#10b981' : '#f43f5e' }}>
                {label}
            </span>
            <span className="truncate max-w-[120px]" style={{ color: '#64748b' }}>
                {result.ok ? 'OK' : result.message.split(':').pop()?.trim() || 'Failed'}
            </span>
        </div>
    );
}
