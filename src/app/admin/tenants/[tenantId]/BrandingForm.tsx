'use client';

import { useState } from 'react';

interface Props {
    tenantId: string;
    tenantName: string;
    plan: string;
    initial: Record<string, string>;
    saveAction: (formData: FormData) => Promise<void>;
}

const PLANS = ['free', 'standard', 'professional', 'enterprise'];
const SWATCHES = ['#22d3ee', '#6366f1', '#34d399', '#fb7185', '#fbbf24', '#f97316', '#a855f7', '#0ea5e9'];

export default function BrandingForm({ tenantId, tenantName, plan, initial, saveAction }: Props) {
    const [monitoringName, setMonitoringName] = useState(initial.monitoring_name || '');
    const [companyName, setCompanyName] = useState(initial.company_name || '');
    const [logoUrl, setLogoUrl] = useState(initial.logo_url || '');
    const [primaryColor, setPrimaryColor] = useState(initial.primary_color || '#22d3ee');
    const [selectedPlan, setSelectedPlan] = useState(plan);
    const [saving, setSaving] = useState(false);

    const displayCompany = companyName || tenantName;
    const displayMonitoring = monitoringName || 'BGP Monitoring';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="card p-6">
                <form action={async (fd) => { setSaving(true); try { await saveAction(fd); } finally { setSaving(false); } }} className="space-y-4" data-testid="branding-form">
                    <input type="hidden" name="tenantId" value={tenantId} />

                    <div>
                        <label className="form-label">Plan Langganan</label>
                        <select name="plan" className="form-select" value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>
                            {PLANS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Nama Monitoring (Sidebar)</label>
                        <input name="monitoring_name" value={monitoringName} onChange={e => setMonitoringName(e.target.value)}
                            placeholder="e.g. BGP Monitoring" className="form-input" data-testid="branding-monitoring-name" />
                    </div>
                    <div>
                        <label className="form-label">Nama Organisasi (Sidebar)</label>
                        <input name="company_name" value={companyName} onChange={e => setCompanyName(e.target.value)}
                            placeholder="e.g. PT Mitra Net" className="form-input" data-testid="branding-company-name" />
                    </div>
                    <div>
                        <label className="form-label">Logo URL</label>
                        <input name="logo_url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                            placeholder="https://…/logo.png" className="form-input" data-testid="branding-logo-url" />
                    </div>
                    <div>
                        <label className="form-label">Primary Color</label>
                        <div className="flex items-center gap-3">
                            <input type="color" name="primary_color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border" style={{ borderColor: 'var(--color-border)' }}
                                data-testid="branding-primary-color" />
                            <div className="flex gap-1.5">
                                {SWATCHES.map(c => (
                                    <button key={c} type="button" onClick={() => setPrimaryColor(c)}
                                        className="w-6 h-6 rounded-md transition-transform hover:scale-110"
                                        style={{ backgroundColor: c, outline: primaryColor.toLowerCase() === c.toLowerCase() ? '2px solid #fff' : 'none', outlineOffset: '1px' }}
                                        aria-label={`Use ${c}`} />
                                ))}
                            </div>
                            <span className="font-mono text-xs" style={{ color: '#64748b' }}>{primaryColor}</span>
                        </div>
                    </div>

                    <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '0.6rem 1.4rem' }} data-testid="save-branding">
                            {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Live Preview */}
            <div>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>Live Preview</p>
                <div className="card overflow-hidden" data-testid="branding-preview" style={{ padding: 0 }}>
                    {/* Mock sidebar header */}
                    <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt="logo" className="w-9 h-9 rounded-xl object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)`, boxShadow: `0 4px 20px -6px ${primaryColor}99` }}>
                                <span className="material-symbols-outlined text-white text-lg">hub</span>
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate" data-testid="preview-company">{displayCompany}</p>
                            <p className="text-[10px] truncate" style={{ color: primaryColor }} data-testid="preview-monitoring">{displayMonitoring}</p>
                        </div>
                    </div>
                    {/* Mock nav + accent button */}
                    <div className="p-4 space-y-2">
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold"
                            style={{ background: `linear-gradient(90deg, ${primaryColor}22, transparent)`, color: primaryColor, borderLeft: `2px solid ${primaryColor}` }}>
                            <span className="material-symbols-outlined text-base">dashboard</span> Overview
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm" style={{ color: '#94a3b8' }}>
                            <span className="material-symbols-outlined text-base">lan</span> BGP Peers
                        </div>
                        <div className="pt-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`, color: '#041016' }}>
                                <span className="material-symbols-outlined text-sm">add</span> Primary Action
                            </span>
                            <span className="ml-2 inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold capitalize"
                                style={{ backgroundColor: `${primaryColor}1f`, color: primaryColor }}>{selectedPlan} plan</span>
                        </div>
                    </div>
                </div>
                <p className="text-[11px] mt-3" style={{ color: '#475569' }}>
                    Preview updates instantly as you type. Save to apply across this tenant's sidebar.
                </p>
            </div>
        </div>
    );
}
