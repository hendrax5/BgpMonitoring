import React, { useState } from 'react';
import { format } from 'date-fns';

interface Backup {
    id: number;
    createdAt: string;
    configHash: string;
}

interface Props {
    device: any;
    targetBackup: Backup;
    onConfirm: () => Promise<void>;
    onCancel: () => void;
}

export default function RollbackModal({ device, targetBackup, onConfirm, onCancel }: Props) {
    const [isApplying, setIsApplying] = useState(false);

    const handleConfirm = async () => {
        setIsApplying(true);
        await onConfirm();
        setIsApplying(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center gap-3 text-red-500 mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <h2 className="text-xl font-bold">Confirm Rollback</h2>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg mb-6">
                    <p className="text-sm text-red-200">
                        This action will <strong>overwrite</strong> the current running configuration on the device with the selected historical version via SSH.
                    </p>
                </div>

                <div className="mb-6 space-y-2">
                    <div className="flex justify-between border-b border-zinc-800 pb-2">
                        <span className="text-zinc-500 text-sm">Target Device</span>
                        <span className="text-zinc-200 font-mono text-sm">{device.hostname}</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800 pb-2">
                        <span className="text-zinc-500 text-sm">Target Version</span>
                        <span className="text-zinc-200 font-mono text-sm">{format(new Date(targetBackup.createdAt), 'yyyy-MM-dd HH:mm:ss')}</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800 pb-2">
                        <span className="text-zinc-500 text-sm">Config Hash</span>
                        <span className="text-zinc-400 font-mono text-xs">{targetBackup.configHash.substring(0, 16)}...</span>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button 
                        onClick={onCancel} 
                        disabled={isApplying}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors font-medium disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={isApplying}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-2 transition-colors font-medium shadow-lg shadow-red-600/20 disabled:opacity-50"
                    >
                        {isApplying ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Applying...
                            </>
                        ) : (
                            <>Confirm Rollback</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
