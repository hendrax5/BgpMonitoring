'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { logout } from '@/app/actions/auth';

interface UserProfileDropdownProps {
  username?: string;
  role?: string;
}

export default function UserProfileDropdown({ username, role }: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors focus:outline-none"
        style={{ border: '1px solid rgba(255,255,255,0.07)' }}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white uppercase">
          {username?.charAt(0) || 'U'}
        </div>
        <div className="text-left hidden md:block max-w-[120px]">
          <p className="text-xs font-semibold text-white truncate">{username || 'User'}</p>
          <p className="text-[10px] text-zinc-400 capitalize truncate">{role || 'viewer'}</p>
        </div>
        <span className="material-symbols-outlined text-zinc-400 text-sm">expand_more</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl z-50 animate-fade-in-up"
          style={{ backgroundColor: '#0d1520', border: '1px solid rgba(255,255,255,0.1)' }}>
          
          <div className="px-4 py-3 border-b border-white/5 md:hidden">
            <p className="text-xs font-semibold text-white truncate">{username || 'User'}</p>
            <p className="text-[10px] text-zinc-400 capitalize truncate">{role || 'viewer'}</p>
          </div>
          
          <div className="py-1">
            <Link href="/settings" onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-sm">tune</span>
              Settings
            </Link>
          </div>
          
          <div className="py-1 border-t border-white/5">
            <form action={logout}>
              <button type="submit" className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left">
                <span className="material-symbols-outlined text-sm">logout</span>
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
