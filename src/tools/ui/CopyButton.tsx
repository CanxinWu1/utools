import { useState } from "react";
import { copyText } from "./utils";

export function CopyButton({
  value,
  children = "复制",
  disabled,
}: {
  value: string;
  children?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (disabled) return;
    copyText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button type="button" onClick={copy} disabled={disabled}>
      {copied ? "已复制" : children}
    </button>
  );
}
