"use client";

interface DataPoint {
  date: string;
  count: number;
  label?: string;
}

interface ScansChartProps {
  data: DataPoint[];
  accent?: string;
}

export function ScansChart({ data, accent = "#10b981" }: ScansChartProps) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((acc, d) => acc + d.count, 0);
  const showLabels = data.length <= 14;
  const labelEvery = data.length > 60 ? Math.ceil(data.length / 6) : 1;

  return (
    <div className="w-full">
      <div className="flex items-end gap-[2px] h-44 pt-2">
        {data.map((d, i) => {
          const heightPct = total > 0 ? (d.count / max) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end group relative min-w-0"
            >
              <div
                className="w-full rounded-t transition-all duration-200 group-hover:opacity-100 hover:opacity-90"
                style={{
                  height: `${Math.max(2, heightPct)}%`,
                  backgroundColor: d.count > 0 ? accent : "#e5e7eb",
                  minHeight: "2px",
                }}
              />
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block px-2 py-1 bg-gray-900 text-white text-[11px] rounded whitespace-nowrap z-10 pointer-events-none">
                <div className="font-semibold">
                  {d.count} scan{d.count > 1 ? "s" : ""}
                </div>
                <div className="text-gray-300 text-[10px]">{d.label ?? d.date}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-0.5 overflow-hidden">
        {data.map((d, i) => {
          if (!showLabels && i % labelEvery !== 0 && i !== data.length - 1) {
            return <span key={i} className="flex-1" />;
          }
          return (
            <span key={i} className="flex-1 text-center truncate">
              {d.label ?? d.date.slice(5)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
