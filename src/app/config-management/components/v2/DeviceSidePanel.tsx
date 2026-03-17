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
        <div className="w-full md:w-[450px] bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col h-full absolute right-0 top-0 z-50 animate-slide-left">
            {/* Header */}
            <div className="p-5 border-b border-zinc-800 flex justify-between items-start bg-zinc-900/50 backdrop-blur shrink-0">
                <div>
                    <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                        {device.hostname}
                    </h3>
                    <p className="text-sm text-zinc-400 font-mono mt-1">{device.ipAddress} • {device.vendor}</p>
                </div>
                <button onClick={onClose} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* General Actions */}
            <div className="p-5 border-b border-zinc-800 shrink-0 space-y-3">
                <div className="flex items-center justify-between text-sm mb-4">
                    <span className="text-zinc-500">Last Backup</span>
                    <span className="text-zinc-200">{device.lastBackupDate ? format(new Date(device.lastBackupDate), 'yyyy-MM-dd HH:mm') : 'None'}</span>
                </div>
                
                <button 
                    onClick={onBackupNow}
                    disabled={isBackupping}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white py-2.5 rounded-xl font-medium flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                >
                    {isBackupping ? (
                        <><svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg> Requesting Backup...</>
                    ) : (
                        <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg> Backup Now</>
                    )}
                </button>

                <button 
                    onClick={handleCompareClick}
                    disabled={selectedCompareIds.length !== 2}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-zinc-700 border border-transparent text-white py-2.5 rounded-xl font-medium transition-all shadow-lg flex justify-center items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Compare {selectedCompareIds.length}/2 Selected
                </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-5 pb-20 scrollbar-thin scrollbar-thumb-zinc-700">
                <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Configuration History</h4>
                
                {loadingBackups ? (
                    <div className="flex justify-center items-center py-10">
                        <svg className="animate-spin h-8 w-8 text-zinc-500" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : backups.length === 0 ? (
                    <div className="bg-zinc-800/50 rounded-lg p-6 text-center border border-zinc-800/80">
                        <svg className="w-10 h-10 text-zinc-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        <p className="text-zinc-500 text-sm">No backups found.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {backups.map((b, idx) => {
                            const isChecked = selectedCompareIds.includes(b.id);
                            return (
                                <div 
                                    key={b.id} 
                                    className={`bg-zinc-800/80 border p-4 rounded-xl transition-all ${isChecked ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)] glow' : 'border-zinc-700 hover:border-zinc-500'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className="relative flex items-center">
                                                <input 
                                                    type="checkbox" 
                                                    className="peer appearance-none w-5 h-5 border-2 border-zinc-500 rounded bg-zinc-900 checked:bg-purple-500 checked:border-purple-500 cursor-pointer transition-all"
                                                    checked={isChecked}
                                                    onChange={() => toggleCompare(b.id)}
                                                />
                                                <svg className="absolute w-3 h-3 text-white left-1 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none"><path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"></path></svg>
                                            </div>
                                            <div>
                                                <div className="font-medium text-zinc-200 text-sm group-hover:text-purple-400 transition-colors">
                                                    {format(new Date(b.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                                                </div>
                                                <div className="text-xs text-zinc-500 font-mono mt-0.5">
                                                    Hash: {b.configHash.substring(0,8)}...
                                                </div>
                                            </div>
                                        </label>
                                        {idx === 0 && <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-blue-500/30">Latest</span>}
                                    </div>
                                    
                                    <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-700/50">
                                        <button 
                                            onClick={() => onViewConfig(b)}
                                            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs py-1.5 rounded transition-colors font-medium border border-zinc-600"
                                        >
                                            View Config
                                        </button>
                                        {(userRole === 'superadmin' || userRole === 'orgadmin') && (
                                            <button 
                                                onClick={() => onRollback(b)}
                                                className="flex-1 bg-red-900/40 hover:bg-red-600 text-red-400 hover:text-white border border-red-800/50 hover:border-red-500 text-xs py-1.5 rounded transition-all font-medium"
                                            >
                                                Rollback
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
