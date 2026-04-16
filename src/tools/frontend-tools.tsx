import { useEffect, useMemo, useState } from "react";
import {
  CopyButton,
  copyText,
  EmptyHint,
  Field,
  InlineError,
  KeyValueEditor,
  MetricStrip,
  Output,
  ResultViewer,
  StatusBadge,
  StatusPill,
  ToolPanel,
  ToolShell,
  ToolTabs,
  ToolWorkspace,
  type KeyValueItem,
} from "./ui";

type JsonResultTab = "format" | "minify" | "sort" | "escape" | "unescape";
type Base64Mode = "text" | "url";

function createKeyValueItem(key = "", value = "", enabled = true): KeyValueItem {
  return { id: crypto.randomUUID(), key, value, enabled };
}

function safeDecodeUriComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "解码失败：输入包含不完整的百分号转义";
  }
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortObjectKeys(item)]),
  );
}

function jsonType(value: unknown) {
  if (Array.isArray(value)) return "Array";
  if (value === null) return "null";
  return typeof value;
}

function countJsonNodes(value: unknown): number {
  if (Array.isArray(value)) return 1 + value.reduce((total, item) => total + countJsonNodes(item), 0);
  if (value && typeof value === "object") {
    return 1 + Object.values(value as Record<string, unknown>).reduce<number>((total, item) => total + countJsonNodes(item), 0);
  }
  return 1;
}

function rowsFromUrlSearch(input: string) {
  try {
    const url = new URL(input);
    return Array.from(url.searchParams.entries()).map(([key, value]) => createKeyValueItem(key, value));
  } catch {
    return [];
  }
}

function rebuildUrlWithRows(input: string, rows: KeyValueItem[]) {
  const url = new URL(input);
  url.search = "";
  rows
    .filter((row) => row.enabled && row.key.trim())
    .forEach((row) => url.searchParams.append(row.key.trim(), row.value));
  return url.toString();
}

function utf8ToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function toUrlSafeBase64(value: string) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromUrlSafeBase64(value: string) {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
}

function base64ToUtf8(value: string) {
  const binary = atob(value.trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function JsonTool() {
  const [input, setInput] = useState('{"name":"SwiftBox","roles":["frontend","backend"],"active":true}');
  const [indent, setIndent] = useState(2);
  const [tab, setTab] = useState<JsonResultTab>("format");

  const result = useMemo(() => {
    try {
      const parsed = JSON.parse(input) as unknown;
      const formatted = JSON.stringify(parsed, null, indent);
      const minified = JSON.stringify(parsed);
      const sorted = JSON.stringify(sortObjectKeys(parsed), null, indent);
      const escaped = JSON.stringify(formatted);
      const unescaped = typeof parsed === "string" ? parsed : formatted;
      return { ok: true as const, parsed, formatted, minified, sorted, escaped, unescaped, nodeCount: countJsonNodes(parsed) };
    } catch (error) {
      return { ok: false as const, message: String(error) };
    }
  }, [indent, input]);

  const resultValue = result.ok
    ? {
        format: result.formatted,
        minify: result.minified,
        sort: result.sorted,
        escape: result.escaped,
        unescape: result.unescaped,
      }[tab]
    : "";

  return (
    <ToolWorkspace
      title="JSON 工具"
      description="格式化、压缩、排序 key、字符串转义，并阻止复制无效结果。"
      actions={<CopyButton value={resultValue} disabled={!result.ok}>复制当前结果</CopyButton>}
      meta={
        <>
          <StatusBadge tone={result.ok ? "success" : "danger"}>{result.ok ? "JSON 有效" : "JSON 无效"}</StatusBadge>
          <span>{input.length} 字符</span>
          {result.ok ? <span>{jsonType(result.parsed)}</span> : null}
        </>
      }
    >
      <div className="split">
        <Field label="输入 JSON">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />
        </Field>
        <ToolPanel
          title="输出"
          description="选择一种转换结果后直接复制。"
          action={
            <ToolTabs
              active={tab}
              onChange={(value) => setTab(value as JsonResultTab)}
              tabs={[
                { id: "format", label: "Format" },
                { id: "minify", label: "Minify" },
                { id: "sort", label: "Sort Keys" },
                { id: "escape", label: "Escape" },
                { id: "unescape", label: "Unescape" },
              ]}
            />
          }
        >
          {result.ok ? <ResultViewer value={resultValue} /> : <InlineError message={`解析失败：${result.message}。请检查缺失逗号、引号、括号或非法尾逗号。`} />}
        </ToolPanel>
      </div>
      {result.ok ? (
        <MetricStrip
          items={[
            { label: "输入字符", value: input.length },
            { label: "压缩后", value: result.minified.length },
            { label: "节点", value: result.nodeCount },
            { label: "缩进", value: `${indent} spaces` },
          ]}
        />
      ) : null}
      <ToolPanel title="选项" description="调整格式化缩进。">
        <Field label="缩进">
          <select value={indent} onChange={(event) => setIndent(Number(event.target.value))}>
            {[2, 4, 8].map((value) => (
              <option key={value} value={value}>{value} spaces</option>
            ))}
          </select>
        </Field>
      </ToolPanel>
    </ToolWorkspace>
  );
}

export function Base64Tool() {
  const [input, setInput] = useState("SwiftBox 工具箱");
  const [mode, setMode] = useState<Base64Mode>("text");
  const encoded = useMemo(() => {
    const value = utf8ToBase64(input);
    return mode === "url" ? toUrlSafeBase64(value) : value;
  }, [input, mode]);
  const decoded = useMemo<{ ok: true; value: string } | { ok: false; message: string }>(() => {
    try {
      return { ok: true, value: base64ToUtf8(mode === "url" ? fromUrlSafeBase64(input) : input) };
    } catch (error) {
      return { ok: false, message: `解码失败：${String(error)}` };
    }
  }, [input, mode]);

  return (
    <ToolWorkspace
      title="Base64"
      description="UTF-8 文本、标准 Base64 和 URL-safe Base64 双向转换。"
      actions={<CopyButton value={encoded}>复制编码</CopyButton>}
      meta={
        <>
          <StatusBadge tone={decoded.ok ? "success" : "warning"}>{decoded.ok ? "可解码" : "不可解码"}</StatusBadge>
          <span>{input.length} 输入字符</span>
          <span>{encoded.length} 编码长度</span>
        </>
      }
    >
      <ToolPanel
        title="模式"
        description="URL-safe 会替换 + / 并移除尾部 =。"
        action={
          <ToolTabs
            active={mode}
            onChange={(value) => setMode(value as Base64Mode)}
            tabs={[
              { id: "text", label: "Text" },
              { id: "url", label: "URL-safe" },
            ]}
          />
        }
      >
        <Field label="文本或 Base64">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} />
        </Field>
      </ToolPanel>
      <MetricStrip
        items={[
          { label: "输入字符", value: input.length },
          { label: "编码长度", value: encoded.length },
          { label: "模式", value: mode === "url" ? "URL-safe" : "Text" },
        ]}
      />
      <div className="split">
        <ResultViewer title="编码结果" value={encoded} />
        {decoded.ok ? (
          <ResultViewer title="解码结果" value={decoded.value} actions={<CopyButton value={decoded.value}>复制解码</CopyButton>} />
        ) : (
          <ToolPanel title="解码结果">
            <InlineError message={decoded.message} />
          </ToolPanel>
        )}
      </div>
    </ToolWorkspace>
  );
}

export function UrlTool() {
  const [input, setInput] = useState("https://example.com/search?q=工具箱&role=frontend");
  const [queryRows, setQueryRows] = useState<KeyValueItem[]>(() => rowsFromUrlSearch("https://example.com/search?q=工具箱&role=frontend"));

  useEffect(() => {
    setQueryRows(rowsFromUrlSearch(input));
  }, [input]);

  const result = useMemo(() => {
    try {
      const url = new URL(input);
      const params = Array.from(url.searchParams.entries());
      return {
        ok: true as const,
        normalized: url.toString(),
        decoded: safeDecodeUriComponent(input),
        encoded: encodeURIComponent(input),
        origin: url.origin,
        pathname: url.pathname,
        hash: url.hash,
        params,
        queryObject: Object.fromEntries(params),
      };
    } catch {
      return {
        ok: false as const,
        encoded: encodeURIComponent(input),
        decoded: safeDecodeUriComponent(input),
      };
    }
  }, [input]);

  const output = result.ok
    ? JSON.stringify(
        {
          origin: result.origin,
          pathname: result.pathname,
          query: Object.fromEntries(result.params),
          encoded: result.encoded,
          decoded: result.decoded,
          normalized: result.normalized,
        },
        null,
        2,
      )
    : `Encoded:\n${result.encoded}\n\nDecoded:\n${result.decoded}`;

  function updateQueryRows(rows: KeyValueItem[]) {
    setQueryRows(rows);
    try {
      setInput(rebuildUrlWithRows(input, rows));
    } catch {
      // Query editor is only shown for valid URLs; this protects fast edits.
    }
  }

  return (
    <ToolWorkspace
      title="URL 工具"
      description="URL 编解码、结构拆解、Query 编辑与重组。"
      actions={<CopyButton value={output}>复制全部</CopyButton>}
      meta={
        <>
          <StatusBadge tone={result.ok ? "success" : "warning"}>{result.ok ? "完整 URL" : "普通文本"}</StatusBadge>
          <span>{input.length} 字符</span>
          {result.ok ? <span>{result.params.length} Query</span> : null}
        </>
      }
    >
      <Field label="URL 或文本">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <div className="button-row">
        <CopyButton value={result.encoded}>复制 Encode</CopyButton>
        <CopyButton value={result.decoded}>复制 Decode</CopyButton>
        {result.ok ? <CopyButton value={result.normalized}>复制规范 URL</CopyButton> : null}
        {result.ok ? <CopyButton value={JSON.stringify(result.queryObject, null, 2)} disabled={!result.params.length}>复制 Query JSON</CopyButton> : null}
      </div>
      {result.ok ? (
        <div className="split align-start">
          <ToolPanel title="URL 结构" description="用于快速确认协议、域名、路径和 hash。">
            <div className="url-parts">
              <span>Protocol</span><strong>{new URL(result.normalized).protocol}</strong>
              <span>Host</span><strong>{new URL(result.normalized).host}</strong>
              <span>Path</span><strong>{result.pathname || "/"}</strong>
              <span>Hash</span><strong>{result.hash || "-"}</strong>
            </div>
          </ToolPanel>
          <ToolPanel title="Query 参数" description="启用的行会实时重组到 URL。">
            {queryRows.length ? (
              <KeyValueEditor rows={queryRows} onChange={updateQueryRows} onAdd={() => createKeyValueItem()} addLabel="添加参数" />
            ) : (
              <EmptyHint>没有 Query 参数</EmptyHint>
            )}
          </ToolPanel>
        </div>
      ) : null}
      <ResultViewer title={result.ok ? "解析结果" : "文本编解码结果"} value={output} />
    </ToolWorkspace>
  );
}

export function TimestampTool() {
  const [input, setInput] = useState(String(Math.floor(Date.now() / 1000)));
  const result = useMemo(() => {
    const trimmed = input.trim();
    const numeric = Number(trimmed);
    const date = Number.isFinite(numeric)
      ? new Date(trimmed.length === 13 ? numeric : numeric * 1000)
      : new Date(trimmed);

    if (!Number.isFinite(date.getTime())) return null;
    return {
      date,
      seconds: Math.floor(date.getTime() / 1000),
      millis: date.getTime(),
      iso: date.toISOString(),
      local: date.toLocaleString(),
      utc: date.toUTCString(),
    };
  }, [input]);

  const output = result
    ? [`本地时间：${result.local}`, `UTC：${result.utc}`, `ISO：${result.iso}`, `秒：${result.seconds}`, `毫秒：${result.millis}`].join("\n")
    : "请输入 Unix 秒、Unix 毫秒或 ISO 时间。";

  return (
    <ToolShell title="时间戳" note="Unix 秒/毫秒、ISO 和本地时间互转。">
      <Field label="时间戳或日期字符串">
        <input value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <div className="button-row">
        <StatusPill tone={result ? "success" : "danger"}>{result ? "可解析" : "不可解析"}</StatusPill>
        <button type="button" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>当前秒</button>
        <button type="button" onClick={() => setInput(String(Date.now()))}>当前毫秒</button>
        <button type="button" onClick={() => setInput(new Date().toISOString())}>当前 ISO</button>
        <button type="button" onClick={() => copyText(output)}>复制</button>
      </div>
      <Output value={output} />
    </ToolShell>
  );
}

export function UnitTool() {
  const [px, setPx] = useState(16);
  const [root, setRoot] = useState(16);
  const [viewport, setViewport] = useState(1440);
  const rem = px / root;
  const vw = (px / viewport) * 100;
  const percent = (px / viewport) * 100;
  const output = [
    `${px}px = ${rem.toFixed(4)}rem`,
    `${px}px = ${vw.toFixed(4)}vw（视口 ${viewport}px）`,
    `${px}px = ${percent.toFixed(4)}%（相对 ${viewport}px）`,
    `1rem = ${root}px`,
    `Tailwind 任意值：w-[${px}px] text-[${px}px]`,
    `clamp 示例：clamp(${Math.max(12, px - 4)}px, ${vw.toFixed(3)}vw, ${px + 8}px)`,
  ].join("\n");

  return (
    <ToolShell title="CSS 单位换算" note="px、rem、vw、百分比和 clamp 片段换算。">
      <div className="split">
        <Field label="像素 px">
          <input type="number" value={px} onChange={(event) => setPx(Number(event.target.value))} />
        </Field>
        <Field label="根字号">
          <input type="number" value={root} onChange={(event) => setRoot(Number(event.target.value))} />
        </Field>
      </div>
      <Field label="视口 / 父级宽度">
        <input type="number" value={viewport} onChange={(event) => setViewport(Number(event.target.value))} />
      </Field>
      <MetricStrip
        items={[
          { label: "rem", value: rem.toFixed(4) },
          { label: "vw", value: vw.toFixed(4) },
          { label: "percent", value: percent.toFixed(4) },
        ]}
      />
      <button type="button" onClick={() => copyText(output)}>复制结果</button>
      <Output value={output} />
    </ToolShell>
  );
}
