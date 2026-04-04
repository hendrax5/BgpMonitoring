import React, { useState } from 'react';
import { format } from 'date-fns';

interface Backup {
    id: number;
    createdAt: string;
    configHash: string;
    isCompliant: boolean | null;
    configText: string;
}

interface Props {
    device: any;
    backups: Backup[];
    loadingBackups: boolean;
    onClose: () => void;
    onViewConfig: (backup: Backup) => void;
    onCompare: (oldBackup: Backup, newBackup: Backup) => void;
    onBackupNow: () => void;
    onRollback: (backup: Backup) => void;
    isBackupping: boolean;
    userRole: string;
}

export default function DeviceSidePanel({ 
    device, backups, loadingBackups, onClose, 
    onViewConfig, onCompare, onBackupNow, onRollback,
    isBackupping, userRole
}: Props) {
    const [selectedCompareIds, setSelectedCompareIds] = useState<number[]>([]);

    const toggleCompare = (id: number) => {
        if (selectedCompareIds.includes(id)) {
            setSelectedCompareIds(selectedCompareIds.filter(x => x !== id));
        } else {
            if (selectedCompareIds.length >= 2) {
                // Keep only the newest selected one, and add the new one
                setSelectedCompareIds([selectedCompareIds[1], id]);
            } else {
                setSelectedCompareIds([...selectedCompareIds, id]);
            }
        }
    };

    const handleCompareClick = () => {
        if (selectedCompareIds.length !== 2) return;
        const b1 = backups.find(b => b.id === selectedCompareIds[0]);
        const b2 = backups.find(b => b.id === selectedCompareIds[1]);
        if (b1 && b2) {
            // Urutkan supaya yang lama di kiri (old), yang baru di kanan (new)
            const oldB = new Date(b1.createdAt) < new Date(b2.createdAt) ? b1 : b2;
            const newB = new Date(b1.createdAt) >= new Date(b2.createdAt) ? b1 : b2;
            onCompare(oldB, newB);
        }
    };

    return (
        <div className="w-full md:w-[480px] bg-[#060a11]/95 backdrop-blur-3xl border-l border-zinc-800 shadow-[-20px_0_50px_-10px_rgba(0,0,0,0.8)] flex flex-col h-full absolute right-0 top-0 z-50 animate-slide-left">
            {/* Header */}
            <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/30 shrink-0">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                            {device.hostname}
                        </h3>
                        <p className="text-sm text-zinc-400 font-mono mt-1 font-medium">{device.ipAddress} • <span className="uppercase text-zinc-500 text-xs">{device.vendor}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-transparent hover:bg-white/10 rounded-full text-zinc-400 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* General Actions */}
            <div className="p-6 border-b border-zinc-800/80 shrink-0 space-y-4 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />
                
                <div className="flex items-center justify-between text-sm mb-2 relative z-10">
                    <span className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Last Backup</span>
                    <span className="text-zinc-100 font-mono">{device.lastBackupDate ? format(new Date(device.lastBackupDate), 'yyyy-MM-dd HH:mm') : 'None'}</span>
                </div>
                
                <button 
                    onClick={onBackupNow}
                    disabled={isBackupping}
                    className="relative z-10 w-full bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 disabled:bg-indigo-600/50 disabled:border-transparent text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-indigo-900/40 active:scale-[0.98]"
                >
                    {isBackupping ? (
                        <><svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg> Requesting Backup...</>
                    ) : (
                        <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg> Request Full Backup Now</>
                    )}
                </button>

                <button 
                    onClick={handleCompareClick}
                    disabled={selectedCompareIds.length !== 2}
                    className="w-full bg-zinc-800 mt-2 disabled:opacity-50 hover:bg-zinc-700 hover:text-white border border-zinc-700/50 text-zinc-300 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 active:scale-[0.98]"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Compare Context ({selectedCompareIds.length}/2)
                </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-6 pb-20 scrollbar-thin scrollbar-thumb-zinc-700">
                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-5">Configuration History Database</h4>
                
                {loadingBackups ? (
                    <div className="flex justify-center items-center py-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
                    </div>
                ) : backups.length === 0 ? (
                    <div className="bg-[#0f172a]/60 rounded-2xl p-8 text-center border border-zinc-800/80 border-dashed">
                        <svg className="w-12 h-12 text-zinc-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        <p className="text-zinc-500 text-sm font-medium tracking-wide">No configuration checkpoints found.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {backups.map((b, idx) => {
                            const isChecked = selectedCompareIds.includes(b.id);
                            return (
                                <div 
                                    key={b.id} 
                                    className={`bg-[#0f172a] border p-5 rounded-2xl transition-all relative overflow-hidden ${isChecked ? 'border-indigo-500/80 shadow-[0_0_20px_rgba(99,102,241,0.1)] glow' : 'border-zinc-800/80 hover:border-zinc-600'}`}
                                >
                                    {isChecked && <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none" />}
                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                        <label className="flex items-start gap-4 cursor-pointer group w-full">
                                            <div className="relative flex items-center mt-0.5 shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    className="peer appearance-none w-5 h-5 border-2 border-zinc-600 rounded-md bg-zinc-900 checked:bg-indigo-500 checked:border-indigo-500 cursor-pointer transition-all"
                                                    checked={isChecked}
                                                    onChange={() => toggleCompare(b.id)}
                                                />
                                                <svg className="absolute w-3.5 h-3.5 text-white left-0.5 top-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none"><path d="M3 8L6 11L11 3.5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"></path></svg>
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-zinc-100 text-[15px] leading-tight group-hover:text-indigo-300 transition-colors">
                                                    {format(new Date(b.createdAt), 'MMM dd, yyyy - HH:mm:ss')}
                                                </div>
                                                <div className="text-xs text-zinc-500 font-mono mt-1.5 flex items-center gap-2">
                                                    <span className="bg-zinc-800 px-2 py-0.5 rounded font-medium border border-zinc-700/50">#{b.configHash.substring(0,8)}</span>
                                                </div>
                                            </div>
                                        </label>
                                        {idx === 0 && <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border border-emerald-500/20 shrink-0">Latest</span>}
                                    </div>
                                    
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800/80 relative z-10">
                                        <button 
                                            onClick={() => onViewConfig(b)}
                                            className="flex-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs py-2 rounded-lg transition-colors font-bold border border-zinc-700"
                                        >
                                            View Source
                                        </button>
                                        {(userRole === 'superadmin' || userRole === 'orgadmin') && (
                                            <button 
                                                onClick={() => onRollback(b)}
                                                className="flex-1 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500/80 text-xs py-2 rounded-lg transition-all font-bold"
                                            >
                                                Apply Rollback
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
