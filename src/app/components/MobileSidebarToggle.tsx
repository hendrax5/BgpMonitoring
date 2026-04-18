'use client';

export default function MobileSidebarToggle() {
  return (
    <button
      className="md:hidden btn-ghost p-1 mr-2 text-[#64748b]"
      aria-label="Open navigation"
      onClick={() => {
        document.getElementById('sidebar-panel')?.classList.add('open');
        document.getElementById('sidebar-overlay')?.classList.add('open');
      }}
    >
      <span className="material-symbols-outlined text-xl">menu</span>
    </button>
  );
}
