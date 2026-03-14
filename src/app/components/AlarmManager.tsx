'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Draggable from 'react-draggable';
import Link from 'next/link';

const SNOOZE_KEY = 'bgp_alarm_snooze_until';
const DEFAULT_SNOOZE_MINUTES = 15;
const POLL_INTERVAL_MS = 30000;

interface DownSession {
    peerIp: string;
    deviceName: string;
    bgpState: string;
}

export default function AlarmManager() {
    const nodeRef = useRef<HTMLDivElement>(null);
    const [downCount, setDownCount] = useState(0);
    const [downSessions, setDownSessions] = useState<DownSession[]>([]);
    const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
    const [alarmActive, setAlarmActive] = useState(false);
    const [snoozeRemaining, setSnoozeRemaining] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem(SNOOZE_KEY);
        if (stored) setSnoozedUntil(parseInt(stored, 10));
    }, []);

    useEffect(() => {
        const tick = setInterval(() => {
            if (snoozedUntil) {
                const rem = Math.max(0, Math.ceil((snoozedUntil - Date.now()) / 1000 / 60));
                setSnoozeRemaining(rem);
                if (rem === 0) { setSnoozedUntil(null); localStorage.removeItem(SNOOZE_KEY); }
            }
        }, 5000);
        return () => clearInterval(tick);
    }, [snoozedUntil]);

    const playAlarmTone = useCallback(() => {
        try {
            if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
                audioCtxRef.current = new AudioContext();
            }
            const ctx = audioCtxRef.current;
            const playBeep = (t: number, freq: number, dur: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(0.35, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
                osc.start(t); osc.stop(t + dur);
            };
            const t = ctx.currentTime;
            playBeep(t, 880, 0.15); playBeep(t + 0.2, 660, 0.15);
            playBeep(t + 0.4, 880, 0.15); playBeep(t + 0.6, 660, 0.15);
        } catch { /* ignore */ }
    }, []);

    const startAlarm = useCallback(() => {
        if (alarmIntervalRef.current) return;
        playAlarmTone();
        alarmIntervalRef.current = setInterval(playAlarmTone, 4000);
        setAlarmActive(true);
    }, [playAlarmTone]);

    const stopAlarm = useCallback(() => {
        if (alarmIntervalRef.current) { clearInterval(alarmIntervalRef.current); alarmIntervalRef.current = null; }
        setAlarmActive(false);
    }, []);

    const snooze = useCallback((minutes = DEFAULT_SNOOZE_MINUTES) => {
        stopAlarm();
        const until = Date.now() + minutes * 60 * 1000;
        setSnoozedUntil(until); setSnoozeRemaining(minutes);
        localStorage.setItem(SNOOZE_KEY, until.toString());
    }, [stopAlarm]);

    const poll = useCallback(async () => {
        try {
            const data = await fetch('/api/status').then(r => r.json());
            // If not authenticated (e.g. on login/register page), stop polling
            if (data.notAuthenticated) {
                if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
                stopAlarm();
                return;
            }
            setDownCount(data.downCount);
            setDownSessions(data.downSessions || []);
            const isSnoozed = snoozedUntil !== null && Date.now() < snoozedUntil;
            if (data.downCount > 0 && !isSnoozed) startAlarm();
            else stopAlarm();
        } catch { /* ignore */ }
    }, [snoozedUntil, startAlarm, stopAlarm]);

    useEffect(() => {
        poll();
        pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
        return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); stopAlarm(); };
    }, [poll, stopAlarm]);


    // Hide entirely when everything OK and not snoozed
    if (downCount === 0 && !alarmActive && !snoozedUntil) return null;

    const isSnoozed = snoozedUntil !== null && Date.now() < snoozedUntil;

    return (
        <Draggable handle=".drag-handle" nodeRef={nodeRef}>
            <div ref={nodeRef} className="fixed top-4 right-4 z-[9999] flex flex-col items-end gap-2">
                {/* Compact badge — always visible, acts as drag handle */}
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="drag-handle flex items-center gap-2 px-3 py-2 rounded-xl shadow-xl transition-all cursor-move"
                    style={{
                        backgroundColor: isSnoozed ? '#1e293b' : '#f43f5e',
                        border: isSnoozed ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(244,63,94,0.7)',
                        boxShadow: alarmActive ? '0 0 20px rgba(244,63,94,0.4)' : undefined,
                    }}
                >
                {alarmActive && (
                    <span className="inline-block w-2 h-2 rounded-full animate-pulse bg-white flex-shrink-0" />
                )}
                <span className="material-symbols-outlined text-lg text-white">
                    {isSnoozed ? 'notifications_paused' : 'notification_important'}
                </span>
                <span className="text-xs font-bold text-white">
                    {isSnoozed
                        ? `Snoozed ${snoozeRemaining}m`
                        : `${downCount} DOWN`}
                </span>
                <span className="material-symbols-outlined text-sm text-white/60">
                    {expanded ? 'expand_less' : 'expand_more'}
                </span>
            </button>

            {/* Expandable detail panel */}
            {expanded && (
                <div
                    className="w-80 rounded-xl overflow-hidden shadow-2xl"
                    style={{ backgroundColor: '#0d1520', border: '1px solid rgba(244,63,94,0.3)' }}
                >
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b"
                        style={{ backgroundColor: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.2)' }}>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base" style={{ color: '#f43f5e' }}>
                                notification_important
                            </span>
                            <span className="text-sm font-bold" style={{ color: '#f43f5e' }}>
                                {isSnoozed ? `Alarm Snoozed` : `${downCount} Session${downCount !== 1 ? 's' : ''} DOWN`}
                            </span>
                        </div>
                        {/* Snooze controls */}
                        {isSnoozed ? (
                            <button
                                onClick={() => { setSnoozedUntil(null); localStorage.removeItem(SNOOZE_KEY); }}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg"
                                style={{ backgroundColor: 'rgba(19,164,236,0.15)', color: '#13a4ec' }}>
                                Resume
                            </button>
                        ) : (
                            <div className="flex gap-1">
                                {[5, 15, 60].map(m => (
                                    <button key={m}
                                        onClick={() => snooze(m)}
                                        className="text-[10px] font-bold px-2 py-1 rounded-lg"
                                        style={{
                                            backgroundColor: m === 15 ? 'rgba(19,164,236,0.15)' : 'rgba(255,255,255,0.07)',
                                            color: m === 15 ? '#13a4ec' : '#94a3b8'
                                        }}
                                        title={`Snooze ${m} minutes`}>
                                        {m === 60 ? '1h' : `${m}m`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Down session list */}
                    {downSessions.length > 0 && (
                        <div className="p-3 space-y-1.5 max-h-56 overflow-y-auto">
                            {downSessions.map((s, i) => (
                                <a key={i} href={`/peers/${encodeURIComponent(s.peerIp)}`}
                                    onClick={() => setExpanded(false)}
                                    className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors"
                                    style={{ backgroundColor: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.12)' }}>
                                    <div>
                                        <span className="font-bold font-mono text-xs" style={{ color: '#f43f5e' }}>{s.peerIp}</span>
                                        <span className="text-[10px] ml-1.5" style={{ color: '#64748b' }}>{s.deviceName}</span>
                                    </div>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                        style={{ backgroundColor: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}>
                                        {s.bgpState}
                                    </span>
                                </a>
                            ))}
                        </div>
                    )}

                    <div className="px-4 py-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px]" style={{ color: '#334155' }}>
                            Polls every 30s · Alarm repeats every 4s until snoozed
                        </p>
                    </div>
                </div>
            )}
            </div>
        </Draggable>
    );
}
