'use client';

export default function SearchCommandTrigger() {
  return (
    <div 
      className="flex-1 max-w-sm flex items-center border rounded-md px-3 py-1.5 cursor-text bg-[#0a1017] hover:border-[#13a4ec]/50 transition-colors"
      style={{ borderColor: 'rgba(255,255,255,0.1)' }}
      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
    >
      <span className="material-symbols-outlined text-[#64748b] text-[18px] mr-2">search</span>
      <span className="text-sm text-[#475569] flex-1">Search or jump to...</span>
      <span className="kbd-shortcut">CTRL+K</span>
    </div>
  );
}
