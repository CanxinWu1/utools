import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Field, InlineError, MetricStrip, ResultViewer, StatusBadge, ToolPanel, ToolWorkspace } from "./ui";

const HISTORY_KEY = "quickdesk:clipboard-history";
const MAX_HISTORY = 20;
const CLIPBOARD_EVENT = "clipboard-observed";

type ClipboardEntry = {
  id: string;
  text: string;
  capturedAtMs: number;
};

type ClipboardEventPayload = {
  text: string;
  capturedAtMs: number;
};

function countLines(text: string) {
  if (!text) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

function formatTimestamp(value: number) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trimEnd() : "";
}

function readHistory(): ClipboardEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): ClipboardEntry | null => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const text = normalizeText(record.text);
        if (!text) return null;
        const capturedAtMs = typeof record.capturedAtMs === "number"
          ? record.capturedAtMs
          : typeof record.capturedAt === "string"
            ? Date.parse(record.capturedAt)
            : Date.now();
        return {
          id: typeof record.id === "string" ? record.id : makeId(),
          text,
          capturedAtMs: Number.isFinite(capturedAtMs) ? capturedAtMs : Date.now(),
        };
      })
      .filter((item): item is ClipboardEntry => item !== null)
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(entries: ClipboardEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // ignore storage errors
  }
}

export function ClipboardTool() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("尚未读取系统剪贴板");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ClipboardEntry[]>(() => readHistory());

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    const unlisten = listen<ClipboardEventPayload>(CLIPBOARD_EVENT, (event) => {
      const nextText = normalizeText(event.payload?.text);
      if (!nextText) return;
      const capturedAtMs = typeof event.payload?.capturedAtMs === "number" ? event.payload.capturedAtMs : Date.now();
      setHistory((current) => {
        const existingIndex = current.findIndex((item) => item.text === nextText);
        const nextEntry: ClipboardEntry = {
          id: existingIndex >= 0 ? current[existingIndex].id : makeId(),
          text: nextText,
          capturedAtMs,
        };
        const nextHistory = existingIndex >= 0
          ? [nextEntry, ...current.filter((_, index) => index !== existingIndex)]
          : [nextEntry, ...current];
        return nextHistory.slice(0, MAX_HISTORY);
      });
      setStatus("已接收系统剪贴板更新");
      setText((current) => (current && current !== nextText ? current : nextText));
      setError(null);
    });

    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  const metrics = useMemo(
    () => [
      { label: "字符数", value: `${text.length}` },
      { label: "行数", value: `${countLines(text)}` },
      { label: "历史", value: `${history.length}` },
      { label: "状态", value: busy ? "处理中" : status },
    ],
    [busy, history.length, status, text],
  );

  async function readClipboard() {
    setBusy(true);
    setError(null);
    try {
      const value = await invoke<string>("read_clipboard_text");
      setText(value);
      setStatus(value ? "已读取系统剪贴板内容" : "系统剪贴板为空");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("读取失败");
    } finally {
      setBusy(false);
    }
  }

  async function writeClipboard(value = text) {
    const nextValue = value;
    setBusy(true);
    setError(null);
    try {
      await invoke("write_clipboard_text", { text: nextValue });
      setText(nextValue);
      setStatus("已复制到系统剪贴板");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("复制失败");
    } finally {
      setBusy(false);
    }
  }

  function loadHistoryItem(item: ClipboardEntry) {
    setText(item.text);
    setStatus(`已载入历史项 · ${formatTimestamp(item.capturedAtMs)}`);
    setError(null);
  }

  function removeHistoryItem(id: string) {
    setHistory((current) => current.filter((item) => item.id !== id));
  }

  function clearHistory() {
    setHistory([]);
    setStatus("已清空系统剪贴板历史");
  }

  function clearText() {
    setText("");
    setStatus("已清空内容");
    setError(null);
  }

  return (
    <ToolWorkspace
      title="剪贴板工具"
      description="读取系统剪贴板、编辑文本、写回系统剪贴板，并保留最近观察到的系统历史。"
      actions={
        <>
          <button type="button" onClick={readClipboard} disabled={busy}>读取当前剪贴板</button>
          <button type="button" onClick={() => void writeClipboard()} disabled={busy || !text}>复制到剪贴板</button>
          <button type="button" onClick={clearText} disabled={busy}>清空输入</button>
          <button type="button" onClick={clearHistory} disabled={busy || history.length === 0}>清空历史</button>
        </>
      }
      meta={<StatusBadge tone={error ? "danger" : "success"}>{error ? "有错误" : busy ? "处理中" : "可用"}</StatusBadge>}
    >
      <ToolPanel title="文本内容">
        <div className="split">
          <Field label="剪贴板文本">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              spellCheck={false}
              placeholder="点击上方按钮读取系统剪贴板，或直接编辑后写回系统剪贴板。"
            />
          </Field>
          <Field label="说明">
            <div style={{ lineHeight: 1.7, fontSize: 13, color: "var(--muted-foreground, #6b7280)" }}>
              <p style={{ margin: 0 }}>这是一个系统剪贴板工具，不只是本工具内部记录。</p>
              <p style={{ margin: "8px 0 0" }}>只要应用保持运行，系统剪贴板变化就会被持续记录下来。</p>
              <p style={{ margin: "8px 0 0" }}>点击下面的历史卡片，就能立刻把内容写回系统剪贴板。</p>
              <p style={{ margin: "8px 0 0" }}>如果当前环境限制了原生剪贴板访问，会在这里显示错误提示。</p>
            </div>
          </Field>
        </div>
      </ToolPanel>
      <MetricStrip items={metrics} />
      {error ? <InlineError message={error} /> : null}
      <ResultViewer title="状态" value={status} empty="尚无状态" />
      <ToolPanel title={`系统剪贴板历史（${history.length} 条）`}>
        {history.length === 0 ? (
          <div style={{ color: "var(--muted-foreground, #6b7280)", fontSize: 13 }}>暂无历史记录。系统剪贴板发生变化后会自动记录最近内容。</div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {history.map((item, index) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  if (event.target !== event.currentTarget) return;
                  void writeClipboard(item.text);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void writeClipboard(item.text);
                  }
                }}
                style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, padding: 12, background: "var(--panel, #fff)", cursor: "pointer" }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <StatusBadge tone="neutral">{`${index + 1}. 系统`}</StatusBadge>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground, #6b7280)" }}>{formatTimestamp(item.capturedAtMs)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => loadHistoryItem(item)} disabled={busy}>载入</button>
                    <button type="button" onClick={() => void writeClipboard(item.text)} disabled={busy}>复制</button>
                    <button type="button" onClick={() => removeHistoryItem(item.id)} disabled={busy}>删除</button>
                  </div>
                </div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.6, color: "var(--foreground, #111827)" }}>{item.text}</pre>
              </div>
            ))}
          </div>
        )}
      </ToolPanel>
    </ToolWorkspace>
  );
}
