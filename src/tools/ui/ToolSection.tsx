import type { ReactNode } from "react";

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
