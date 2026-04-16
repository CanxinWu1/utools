import type { ReactNode } from "react";
import { CopyButton } from "./CopyButton";

export function ResultViewer({
  title,
  value,
  empty = "结果会显示在这里",
  actions,
}: {
  title?: string;
  value: string;
  empty?: string;
  actions?: ReactNode;
}) {
  const output = value || empty;

  return (
    <section className="result-viewer">
      <div className="result-viewer-head">
        {title ? <strong>{title}</strong> : <span />}
        <div className="button-row">
          {actions}
          <CopyButton value={output} disabled={!value}>复制</CopyButton>
        </div>
      </div>
      <pre className="output">{output}</pre>
    </section>
  );
}
