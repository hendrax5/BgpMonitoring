'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Mapping of commands
  const commands = [
    { id: 'goto-dashboard', name: 'Go to Dashboard', shortcut: 'D', action: () => router.push('/') },
    { id: 'goto-bgp', name: 'View BGP Sessions', action: () => router.push('/') },
    { id: 'goto-reports', name: 'View Event Logs', action: () => router.push('/reports') },
    { id: 'goto-routers', name: 'Manage Routers', action: () => router.push('/config-management') },
    { id: 'goto-settings', name: 'System Settings', action: () => router.push('/settings') },
    { id: 'goto-users', name: 'User Management', action: () => router.push('/settings?tab=users') }
  ];

  const filteredCommands = query === '' 
    ? commands 
    : commands.filter(cmd => cmd.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleExecute = (cmd: any) => {
    cmd.action();
    setIsOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredCommands.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleExecute(filteredCommands[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 sm:pt-40" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
      {/* Backdrop click closer */}
      <div className="absolute inset-0" onClick={() => setIsOpen(false)} />
      
      <div 
        className="relative w-full max-w-lg transform overflow-hidden rounded-xl shadow-2xl transition-all"
        style={{ backgroundColor: '#131e29', border: '1px solid rgba(255,255,255,0.1)' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <span className="material-symbols-outlined text-[#64748b] mr-3">search</span>
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-white outline-none placeholder-[#64748b]"
            placeholder="Search commands, navigate... (e.g. 'router')"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleInputKeyDown}
          />
          <button className="kbd-shortcut ml-2" onClick={() => setIsOpen(false)}>ESC</button>
        </div>

        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <li className="p-4 text-center text-sm text-[#64748b]">No commands found.</li>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <li 
                key={cmd.id}
                className={`flex cursor-pointer select-none items-center justify-between rounded-lg px-4 py-2.5 text-sm transition-colors ${idx === selectedIndex ? 'bg-[#13a4ec]/20 text-white' : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'}`}
                onClick={() => handleExecute(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px]">terminal</span>
                  {cmd.name}
                </div>
                {cmd.shortcut && <span className="kbd-shortcut">{cmd.shortcut}</span>}
              </li>
            ))
          )}
        </ul>
        <div className="p-2 border-t text-[10px] text-center" style={{ borderColor: 'rgba(255,255,255,0.03)', color: '#64748b' }}>
          Use <span className="kbd-shortcut">↑</span> <span className="kbd-shortcut">↓</span> to navigate, <span className="kbd-shortcut">Enter</span> to select
        </div>
      </div>
    </div>
  );
}
