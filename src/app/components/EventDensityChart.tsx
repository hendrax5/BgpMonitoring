'use client';

type Bar = { hour: string; count: number; hasDown: boolean };

export default function EventDensityChart({ density }: { density: Bar[] }) {
  const maxCount = Math.max(...density.map(d => d.count), 1);

  return (
    <div
      className="card px-5 py-4"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>
          Event Density — Last 12 Hours
        </p>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: '#475569' }}>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#f43f5e' }} />
            Has DOWN
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#13a4ec' }} />
            Recovery
          </span>
        </div>
      </div>

      <div className="flex items-end gap-1.5 h-14">
        {density.map((bar, i) => {
          const pct = bar.count === 0 ? 0 : Math.max(8, Math.round((bar.count / maxCount) * 100));
          const color = bar.count === 0
            ? 'rgba(255,255,255,0.06)'
            : bar.hasDown
              ? '#f43f5e'
              : '#13a4ec';
          const alpha = bar.count === 0 ? 1 : bar.hasDown ? 0.7 : 0.5;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 group relative"
              title={`${bar.hour} — ${bar.count} event${bar.count !== 1 ? 's' : ''}`}
            >
              <div
                className="w-full rounded-sm transition-all duration-300"
                style={{
                  height: `${pct}%`,
                  backgroundColor: color,
                  opacity: alpha,
                }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                <div
                  className="text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap"
                  style={{ backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {bar.hour} · {bar.count} evt
                </div>
                <div className="w-1.5 h-1.5 rotate-45" style={{ backgroundColor: '#1e293b', marginTop: '-4px' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* X axis labels — show only first, middle, last */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px]" style={{ color: '#334155' }}>{density[0]?.hour}</span>
        <span className="text-[9px]" style={{ color: '#334155' }}>{density[5]?.hour}</span>
        <span className="text-[9px]" style={{ color: '#334155' }}>Now</span>
      </div>
    </div>
  );
}
