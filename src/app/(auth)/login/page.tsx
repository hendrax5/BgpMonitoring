'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    username: (e.currentTarget.elements.namedItem('username') as HTMLInputElement).value,
                    password: (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value,
                }),
            });
            const result = await res.json();
            if (result?.success) {
                // Hard navigation — ensures cookie is stored before new request
                window.location.href = '/';
                return;
            }
            setError(result?.error || `Login failed (HTTP ${res.status})`);
        } catch (err: any) {
            setError(err?.message || 'Network error — check console');
        }
        setLoading(false);

    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient network grid glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(700px circle at 30% 20%, rgba(34,211,238,0.12), transparent 45%), radial-gradient(700px circle at 75% 80%, rgba(99,102,241,0.12), transparent 45%)'
            }} />
            <div className="w-full max-w-sm relative z-10 animate-rise">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #22d3ee, #6366f1)', boxShadow: '0 8px 30px -8px rgba(34,211,238,0.7)' }}>
                            <span className="material-symbols-outlined text-white text-2xl">hub</span>
                        </div>
                        <span className="text-xl font-bold text-white tracking-tight">BGP Monitor</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
                    <p className="text-sm" style={{ color: '#64748b' }}>Sign in to your network operations console</p>
                </div>

                <div className="card p-8 space-y-5">
                    {error && (
                        <div className="p-3 rounded-lg text-sm font-medium" data-testid="login-error"
                            style={{ backgroundColor: 'rgba(251,113,133,0.1)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.25)' }}>
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="form-label">Username</label>
                            <input data-testid="login-username" type="text" name="username" required placeholder="admin" className="form-input w-full" />
                        </div>
                        <div>
                            <label className="form-label">Password</label>
                            <input data-testid="login-password" type="password" name="password" required placeholder="••••••••" className="form-input w-full" />
                        </div>
                        <button data-testid="login-submit" type="submit" disabled={loading}
                            className="btn-primary w-full justify-center" style={{ padding: '0.8rem', fontSize: '0.9rem' }}>
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                </div>
                <p className="text-center text-[11px] mt-6" style={{ color: '#334155' }}>Secure access · Multi-tenant BGP monitoring</p>
            </div>
        </div>
    );
}
