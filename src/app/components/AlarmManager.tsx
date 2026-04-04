'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
    const [downCount, setDownCount] = useState(0);
    const [downSessions, setDownSessions] = useState<DownSession[]>([]);
    const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
    const [alarmActive, setAlarmActive] = useState(false);
    const [snoozeRemaining, setSnoozeRemaining] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Carousel logic
    useEffect(() => {
        if (downSessions.length <= 1) {
            setActiveIndex(0);
            return;
        }
        const tick = setInterval(() => {
            setActiveIndex(i => (i + 1) % downSessions.length);
        }, 3500); 
        return () => clearInterval(tick);
    }, [downSessions.length]); // reset active index loop if length changes

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
        } catch { /* ignore audio err */ }
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

    // UI Logic
    if (downCount === 0 && !snoozedUntil && !alarmActive) return null;

    const isSnoozed = snoozedUntil !== null && Date.now() < snoozedUntil;

    // Subdued Snooze Banner
    if (isSnoozed) {
        return (
            <div className="w-full bg-[#0d1520] border-b border-rose-500/30 py-1.5 px-4 flex justify-between items-center z-[100] sticky top-0 text-slate-400 text-[11px] font-medium">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">notifications_paused</span>
                    <span>Alarm snoozed for <b>{snoozeRemaining}m</b>.</span>
                    {downCount > 0 && <span className="text-rose-500 ml-2">({downCount} sessions still down)</span>}
                </div>
                <button 
                    onClick={() => { setSnoozedUntil(null); localStorage.removeItem(SNOOZE_KEY); }}
                    className="hover:text-blue-400 text-[#13a4ec] font-bold uppercase tracking-wider transition focus-ring"
                >
                    Resume Alarm
                </button>
            </div>
        );
    }

    const activeSession = downSessions[activeIndex] || downSessions[0];

    // Active NOC Carousel Banner
    return (
        <div className="w-full bg-[#e11d48] text-white z-[100] sticky top-0 flex items-center shadow-[0_4px_16px_rgba(225,29,72,0.3)] h-11 overflow-hidden box-border shrink-0">
            {/* Urgent Left Badge */}
            <div className="flex items-center gap-2 px-5 h-full bg-[#be123c] font-bold text-[11px] whitespace-nowrap tracking-wider shrink-0 z-10 relative shadow-[4px_0_12px_rgba(0,0,0,0.15)]">
                <span className="material-symbols-outlined text-white animate-pulse text-[18px]">warning</span>
                URGENT: {downCount} DOWN
            </div>

            {/* Fade Carousel */}
            <div className="flex-1 relative h-full flex items-center justify-center bg-[#e11d48] overflow-hidden px-4">
                {activeSession && (
                    <div key={activeSession.peerIp + activeIndex} className="animate-fade-in flex items-center gap-2">
                        <Link href={`/peers/${encodeURIComponent(activeSession.peerIp)}`} className="text-[13px] text-white/95 font-mono tracking-wide hover:text-white hover:underline transition flex items-center gap-1.5 focus-ring px-2 py-0.5 rounded">
                            <span className="font-bold">{activeSession.peerIp}</span> 
                            <span className="text-white/70">({activeSession.deviceName})</span> 
                            <span className="ml-1 bg-black/25 px-1.5 py-0.5 rounded text-[10px] uppercase font-sans font-bold shadow-inner">{activeSession.bgpState}</span>
                        </Link>
                        {downSessions.length > 1 && (
                            <span className="text-[10px] text-white/50 ml-2 font-sans font-medium tracking-wide bg-black/10 border border-white/10 px-1.5 py-0.5 rounded-md shadow-inner">
                                {activeIndex + 1} / {downSessions.length}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 px-4 bg-[#be123c] shrink-0 h-full z-10 relative border-l border-white/10 shadow-[-4px_0_12px_rgba(225,29,72,1)]">
                <span className="material-symbols-outlined text-[16px] text-white/80">campaign</span>
                <span className="text-[10px] text-white/80 mr-1 font-bold tracking-wider">MUTE:</span>
                {[5, 15, 60].map(m => (
                    <button key={m} onClick={() => snooze(m)} className="px-2 py-1 rounded text-[10px] font-bold bg-black/25 hover:bg-black/50 transition focus-ring shadow-inner border border-white/5">
                        {m === 60 ? '1H' : `${m}M`}
                    </button>
                ))}
            </div>
        </div>
    );
}
