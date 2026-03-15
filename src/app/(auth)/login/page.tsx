'use client';

import { login } from '@/app/actions/auth';
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
        const result = await login(new FormData(e.currentTarget));
        if (result?.success) {
            router.push('/');
            router.refresh();
            return;
        }
        if (result?.error) { setError(result.error); setLoading(false); }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #0a0f1a 0%, #0d1520 100%)' }}>
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #13a4ec, #0d47a1)' }}>
                            <span className="material-symbols-outlined text-white text-xl">router</span>
                        </div>
                        <span className="text-xl font-bold text-white">BGP Monitor</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
                    <p className="text-sm" style={{ color: '#64748b' }}>Sign in to your account</p>
                </div>

                <div className="card p-8 space-y-5">
                    {error && (
                        <div className="p-3 rounded-lg text-sm font-medium"
                            style={{ backgroundColor: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)' }}>
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Username</label>
                            <input type="text" name="username" required placeholder="admin" className="form-input w-full" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Password</label>
                            <input type="password" name="password" required placeholder="••••••••" className="form-input w-full" />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full py-3 rounded-xl font-bold text-white transition-all"
                            style={{ background: loading ? '#1e293b' : 'linear-gradient(135deg, #13a4ec, #0d47a1)' }}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                    <p className="text-center text-sm" style={{ color: '#475569' }}>
                        New organization?{' '}
                        <Link href="/register" className="font-bold hover:underline" style={{ color: '#13a4ec' }}>Register here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
