import { useMemo, useState } from "react";
import { copyText, Field, MetricStrip, Output, StatusPill, ToolSection, ToolShell } from "./shared";

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

function utf8ToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToUtf8(value: string) {
  const binary = atob(value.trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function JsonTool() {
  const [input, setInput] = useState('{"name":"SwiftBox","roles":["frontend","backend"],"active":true}');
  const [indent, setIndent] = useState(2);

  const result = useMemo(() => {
    try {
      const parsed = JSON.parse(input) as unknown;
      const formatted = JSON.stringify(parsed, null, indent);
      const minified = JSON.stringify(parsed);
      const sorted = JSON.stringify(sortObjectKeys(parsed), null, indent);
      const nodeCount = JSON.stringify(parsed).match(/[{\[,]/g)?.length ?? 0;
      return { ok: true as const, parsed, formatted, minified, sorted, nodeCount };
    } catch (error) {
      return { ok: false as const, message: String(error) };
    }
  }, [indent, input]);

  return (
    <ToolShell title="JSON 工具" note="实时格式化、压缩、排序 key，并给出结构统计。">
      <div className="button-row">
        <StatusPill tone={result.ok ? "success" : "danger"}>{result.ok ? "JSON 有效" : "JSON 无效"}</StatusPill>
        <Field label="缩进">
          <select value={indent} onChange={(event) => setIndent(Number(event.target.value))}>
            {[2, 4, 8].map((value) => (
              <option key={value} value={value}>{value} spaces</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="split">
        <Field label="输入 JSON">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />
        </Field>
        <ToolSection
          title="格式化结果"
          action={result.ok ? <button type="button" onClick={() => copyText(result.formatted)}>复制格式化</button> : null}
        >
          <Output value={result.ok ? result.formatted : `解析失败：${result.message}`} />
        </ToolSection>
      </div>
      {result.ok ? (
        <>
          <MetricStrip
            items={[
              { label: "字符", value: input.length },
              { label: "压缩后", value: result.minified.length },
              { label: "节点", value: result.nodeCount },
              { label: "类型", value: Array.isArray(result.parsed) ? "Array" : typeof result.parsed },
            ]}
          />
          <div className="button-row">
            <button type="button" onClick={() => copyText(result.minified)}>复制压缩</button>
            <button type="button" onClick={() => copyText(result.sorted)}>复制排序 Key</button>
          </div>
        </>
      ) : null}
    </ToolShell>
  );
}

export function Base64Tool() {
  const [input, setInput] = useState("SwiftBox 工具箱");
  const encoded = useMemo(() => utf8ToBase64(input), [input]);
  const decoded = useMemo(() => {
    try {
      return base64ToUtf8(input);
    } catch {
      return "";
    }
  }, [input]);

  return (
    <ToolShell title="Base64" note="UTF-8 文本双向转换，自动识别能否解码。">
      <Field label="文本或 Base64">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <MetricStrip
        items={[
          { label: "输入字符", value: input.length },
          { label: "编码长度", value: encoded.length },
          { label: "可解码", value: decoded ? "是" : "否" },
        ]}
      />
      <div className="split">
        <ToolSection title="编码结果" action={<button type="button" onClick={() => copyText(encoded)}>复制编码</button>}>
          <Output value={encoded} />
        </ToolSection>
        <ToolSection title="解码结果" action={decoded ? <button type="button" onClick={() => copyText(decoded)}>复制解码</button> : null}>
          <Output value={decoded || "当前输入不是有效 Base64"} />
        </ToolSection>
      </div>
    </ToolShell>
  );
}

export function UrlTool() {
  const [input, setInput] = useState("https://example.com/search?q=工具箱&role=frontend");
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
        params,
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

  return (
    <ToolShell title="URL 工具" note="URL 编解码、Query 拆解和规范化输出。">
      <Field label="URL 或文本">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <div className="button-row">
        <StatusPill tone={result.ok ? "success" : "warning"}>{result.ok ? "完整 URL" : "普通文本"}</StatusPill>
        <button type="button" onClick={() => copyText(output)}>复制全部</button>
        <button type="button" onClick={() => copyText(result.encoded)}>复制 Encode</button>
        <button type="button" onClick={() => copyText(result.decoded)}>复制 Decode</button>
      </div>
      {result.ok ? (
        <div className="query-table">
          {result.params.length ? result.params.map(([key, value]) => (
            <button key={`${key}-${value}`} type="button" onClick={() => copyText(value)}>
              <strong>{key}</strong>
              <span>{value}</span>
            </button>
          )) : <span className="muted-text">没有 Query 参数</span>}
        </div>
      ) : null}
      <Output value={output} />
    </ToolShell>
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
