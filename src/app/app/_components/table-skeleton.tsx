export function TableSkeleton({
  rows = 8,
  cols = 5,
  className = "",
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={`animate-pulse overflow-hidden border rounded-xl ${className}`}>
      <table className="w-full text-sm">
        <thead className="bg-bg">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="h-10 px-3 text-left">
                <div className="h-4 w-16 rounded bg-border/60" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-t border-border">
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} className="p-2">
                  <div
                    className="h-5 rounded bg-border/40"
                    style={{ width: colIdx === 0 ? 48 : colIdx === 1 ? 120 : 64 }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
