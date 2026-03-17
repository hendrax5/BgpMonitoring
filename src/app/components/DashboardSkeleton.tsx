export default function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5 h-28" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}></div>
        ))}
      </div>
      <div className="card h-64 w-full" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}></div>
      <div className="card h-96 w-full" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}></div>
    </div>
  );
}
