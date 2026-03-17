import React from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { format } from 'date-fns';

interface Backup {
    id: number;
    createdAt: string;
    configText: string;
}

interface Props {
    device: any;
    leftBackup: Backup;
    rightBackup: Backup;
    onClose: () => void;
}

export default function ConfigDiffViewer({ device, leftBackup, rightBackup, onClose }: Props) {
    return (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col animate-fade-in backdrop-blur-sm">
            {/* Sticky Header */}
            <div className="bg-zinc-900 border-b border-zinc-800 p-4 shrink-0 flex items-center justify-between sticky top-0 z-10 shadow-lg">
                <div>
                    <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                        <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Configuration Compare
                    </h2>
                    <p className="text-zinc-400 text-sm mt-1">
                        Device: <span className="text-blue-400 font-mono">{device.hostname}</span> ({device.ipAddress})
                    </p>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end text-sm">
                        <span className="text-red-400 font-mono">- LEFT: {format(new Date(leftBackup.createdAt), 'yyyy-MM-dd HH:mm:ss')}</span>
                        <span className="text-green-400 font-mono">+ RIGHT: {format(new Date(rightBackup.createdAt), 'yyyy-MM-dd HH:mm:ss')}</span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm border border-zinc-700"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        Close Diff
                    </button>
                </div>
            </div>

            {/* Diff Area */}
            <div className="flex-1 overflow-auto bg-[#1e1e1e] p-4 text-sm">
                <div className="max-w-screen-2xl mx-auto border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
                    <ReactDiffViewer 
                        oldValue={leftBackup.configText} 
                        newValue={rightBackup.configText} 
                        splitView={true} 
                        compareMethod={DiffMethod.WORDS}
                        hideLineNumbers={false}
                        useDarkTheme={true}
                        styles={{
                            variables: {
                                dark: {
                                    diffViewerBackground: '#1e1e1e',
                                    diffViewerTitleBackground: '#2d2d2d',
                                    diffViewerTitleColor: '#fff',
                                    diffViewerTitleBorderColor: '#333',
                                }
                            },
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
