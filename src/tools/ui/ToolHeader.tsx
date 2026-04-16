import type { ReactNode } from "react";

export function ToolHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="tool-head">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions ? <div className="tool-head-actions">{actions}</div> : null}
    </div>
  );
}
