import type { ReactNode } from "react";
import { ToolWorkspace } from "./ToolWorkspace";

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
    <ToolWorkspace title={title} description={note}>
      {children}
    </ToolWorkspace>
  );
}
