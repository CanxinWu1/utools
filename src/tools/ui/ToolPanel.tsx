import type { ReactNode } from "react";

export function ToolPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="tool-ui-panel">
      <div className="tool-ui-panel-head">
        <div>
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
