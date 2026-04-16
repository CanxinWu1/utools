import type { ReactNode } from "react";

export function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ToolShell({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="tool-shell">
      <div className="tool-head">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Output({ value }: { value: string }) {
  return <pre className="output">{value || "结果会显示在这里"}</pre>;
}

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

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

export function ToolSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="tool-section">
      <div className="tool-section-head">
        <strong>{title}</strong>
        {action}
      </div>
      {children}
    </section>
  );
}
