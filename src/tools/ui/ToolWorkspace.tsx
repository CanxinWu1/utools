import type { ReactNode } from "react";
import { ToolHeader } from "./ToolHeader";

export function ToolWorkspace({
  title,
  description,
  meta,
  actions,
  children,
}: {
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="tool-shell">
      <ToolHeader title={title} description={description} actions={actions} />
      {meta ? <div className="tool-workspace-meta">{meta}</div> : null}
      {children}
    </section>
  );
}
