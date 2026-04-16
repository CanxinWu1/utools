export function MetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="metric-strip">
      {items.map((item) => (
        <span key={item.label}>
          <strong>{item.value}</strong>
          <small>{item.label}</small>
        </span>
      ))}
    </div>
  );
}
