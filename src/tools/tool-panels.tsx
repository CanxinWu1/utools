import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import QRCode from "qrcode";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface HttpResponse {
  status: number;
  status_text: string;
  elapsed_ms: number;
  headers: Record<string, string>;
  body: string;
}

function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

function ToolShell({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tool-shell">
      <div className="tool-head">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Output({ value }: { value: string }) {
  return <pre className="output">{value || "结果会显示在这里"}</pre>;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === nr) h = (ng - nb) / d + (ng < nb ? 6 : 0);
    if (max === ng) h = (nb - nr) / d + 2;
    if (max === nb) h = (nr - ng) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function componentToHex(value: number) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function parseJwtSegment(segment: string) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(decodeURIComponent(escape(atob(padded)))) as unknown;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeDecodeUriComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "解码失败：输入包含不完整的百分号转义";
  }
}

function renderMarkdown(value: string) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br />");
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function adjustHex(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    clampColor(rgb.r + amount),
    clampColor(rgb.g + amount),
    clampColor(rgb.b + amount),
  );
}

export function HttpTool() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("https://httpbin.org/get");
  const [headers, setHeaders] = useState("Accept: application/json");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendRequest() {
    setLoading(true);
    setError("");
    setResponse(null);
    try {
      const result = await invoke<HttpResponse>("send_http_request", {
        request: { method, url, headers, body },
      });
      setResponse(result);
    } catch (requestError) {
      setError(String(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ToolShell title="HTTP 请求" note="本地执行请求，不保存历史和请求正文。">
      <div className="request-line">
        <select value={method} onChange={(event) => setMethod(event.target.value as HttpMethod)}>
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://api.example.com" />
        <button type="button" onClick={sendRequest} disabled={loading}>
          {loading ? "发送中" : "发送"}
        </button>
      </div>
      <div className="split">
        <Field label="Headers，每行一个 key: value">
          <textarea value={headers} onChange={(event) => setHeaders(event.target.value)} />
        </Field>
        <Field label="Body">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {response ? (
        <div className="result-block">
          <div className="status-row">
            <strong>
              {response.status} {response.status_text}
            </strong>
            <span>{response.elapsed_ms} ms</span>
            <button type="button" onClick={() => copyText(response.body)}>
              复制响应
            </button>
          </div>
          <Output value={`${JSON.stringify(response.headers, null, 2)}\n\n${response.body}`} />
        </div>
      ) : null}
    </ToolShell>
  );
}

export function ColorTool() {
  const [hex, setHex] = useState("#2563EB");
  const [sample, setSample] = useState("#2563EB");
  const fileRef = useRef<HTMLInputElement>(null);
  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
  const output = rgb && hsl
    ? [`HEX ${rgbToHex(rgb.r, rgb.g, rgb.b)}`, `RGB rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, `HSL hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`, `CSS --color-accent: ${rgbToHex(rgb.r, rgb.g, rgb.b)};`].join("\n")
    : "请输入 6 位 HEX 色值，例如 #2563EB";

  function pickFromImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0);
      const data = context?.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data;
      if (data) {
        const picked = rgbToHex(data[0], data[1], data[2]);
        setHex(picked);
        setSample(picked);
      }
    };
    image.src = URL.createObjectURL(file);
  }

  return (
    <ToolShell title="颜色工具" note="转换色值，上传图片会读取中心点颜色。">
      <div className="split align-start">
        <div>
          <Field label="HEX 色值">
            <input value={hex} onChange={(event) => setHex(event.target.value)} />
          </Field>
          <div className="button-row">
            <button type="button" onClick={() => fileRef.current?.click()}>
              上传图片取色
            </button>
            <button type="button" onClick={() => copyText(output)}>
              复制结果
            </button>
          </div>
          <input ref={fileRef} className="hidden-input" type="file" accept="image/*" onChange={pickFromImage} />
        </div>
        <div className="color-preview" style={{ background: rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : sample }}>
          <span>{rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : sample}</span>
        </div>
      </div>
      <Output value={output} />
    </ToolShell>
  );
}

export function JsonTool() {
  const [input, setInput] = useState('{"name":"QuickDesk","roles":["frontend","backend"]}');
  const [output, setOutput] = useState("");

  function transform(mode: "format" | "minify") {
    try {
      const parsed = JSON.parse(input) as unknown;
      setOutput(mode === "format" ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed));
    } catch (error) {
      setOutput(`JSON 解析失败：${String(error)}`);
    }
  }

  return (
    <ToolShell title="JSON 工具" note="格式化、压缩和校验 JSON。">
      <Field label="输入 JSON">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <div className="button-row">
        <button type="button" onClick={() => transform("format")}>格式化</button>
        <button type="button" onClick={() => transform("minify")}>压缩</button>
        <button type="button" onClick={() => copyText(output)}>复制</button>
      </div>
      <Output value={output} />
    </ToolShell>
  );
}

export function Base64Tool() {
  const [input, setInput] = useState("QuickDesk 工具箱");
  const [output, setOutput] = useState("");

  return (
    <ToolShell title="Base64" note="文本编码和解码，不保存输入内容。">
      <Field label="文本">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <div className="button-row">
        <button type="button" onClick={() => setOutput(btoa(unescape(encodeURIComponent(input))))}>编码</button>
        <button
          type="button"
          onClick={() => {
            try {
              setOutput(decodeURIComponent(escape(atob(input))));
            } catch {
              setOutput("Base64 解码失败");
            }
          }}
        >
          解码
        </button>
        <button type="button" onClick={() => copyText(output)}>复制</button>
      </div>
      <Output value={output} />
    </ToolShell>
  );
}

export function UrlTool() {
  const [input, setInput] = useState("https://example.com/search?q=工具箱&role=frontend");
  const output = useMemo(() => {
    try {
      const url = new URL(input);
      return JSON.stringify(
        {
          origin: url.origin,
          pathname: url.pathname,
          query: Object.fromEntries(url.searchParams.entries()),
          encoded: encodeURIComponent(input),
          decoded: safeDecodeUriComponent(input),
        },
        null,
        2,
      );
    } catch {
      return `Encoded:\n${encodeURIComponent(input)}\n\nDecoded:\n${safeDecodeUriComponent(input)}`;
    }
  }, [input]);

  return (
    <ToolShell title="URL 工具" note="URL 编解码与 Query 参数解析。">
      <Field label="URL 或文本">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <button type="button" onClick={() => copyText(output)}>复制结果</button>
      <Output value={output} />
    </ToolShell>
  );
}

export function TimestampTool() {
  const now = Math.floor(Date.now() / 1000);
  const [timestamp, setTimestamp] = useState(String(now));
  const date = new Date(Number(timestamp.length === 13 ? timestamp : Number(timestamp) * 1000));
  const output = Number.isFinite(date.getTime())
    ? [`本地时间：${date.toLocaleString()}`, `ISO：${date.toISOString()}`, `秒：${Math.floor(date.getTime() / 1000)}`, `毫秒：${date.getTime()}`].join("\n")
    : "请输入有效时间戳";

  return (
    <ToolShell title="时间戳" note="Unix 秒/毫秒和本地时间互转。">
      <Field label="时间戳">
        <input value={timestamp} onChange={(event) => setTimestamp(event.target.value)} />
      </Field>
      <div className="button-row">
        <button type="button" onClick={() => setTimestamp(String(Math.floor(Date.now() / 1000)))}>当前秒</button>
        <button type="button" onClick={() => setTimestamp(String(Date.now()))}>当前毫秒</button>
        <button type="button" onClick={() => copyText(output)}>复制</button>
      </div>
      <Output value={output} />
    </ToolShell>
  );
}

export function UuidTool() {
  const [length, setLength] = useState(24);
  const token = useMemo(() => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const values = crypto.getRandomValues(new Uint32Array(length));
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  }, [length]);
  const uuid = useMemo(() => crypto.randomUUID(), [token]);

  return (
    <ToolShell title="UUID / 随机字符串" note="生成一次性标识、测试 token 和随机密码。">
      <Field label="随机字符串长度">
        <input type="number" min="8" max="96" value={length} onChange={(event) => setLength(Number(event.target.value))} />
      </Field>
      <Output value={`UUID\n${uuid}\n\n随机字符串\n${token}`} />
      <div className="button-row">
        <button type="button" onClick={() => copyText(uuid)}>复制 UUID</button>
        <button type="button" onClick={() => copyText(token)}>复制随机字符串</button>
      </div>
    </ToolShell>
  );
}

export function JwtTool() {
  const [input, setInput] = useState("");
  const output = useMemo(() => {
    if (!input.trim()) return "粘贴 JWT 后会在本地解码，不验证签名。";
    const parts = input.split(".");
    if (parts.length < 2) return "JWT 至少需要 Header 和 Payload 两段";
    try {
      const header = parseJwtSegment(parts[0]);
      const payload = parseJwtSegment(parts[1]) as { exp?: number };
      const expires = payload.exp ? new Date(payload.exp * 1000).toLocaleString() : "未提供 exp";
      return `Header\n${JSON.stringify(header, null, 2)}\n\nPayload\n${JSON.stringify(payload, null, 2)}\n\n过期时间：${expires}`;
    } catch (error) {
      return `JWT 解码失败：${String(error)}`;
    }
  }, [input]);

  return (
    <ToolShell title="JWT 解码" note="只做本地 decode，不承诺签名有效。">
      <Field label="JWT">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <button type="button" onClick={() => copyText(output)}>复制结果</button>
      <Output value={output} />
    </ToolShell>
  );
}

export function RegexTool() {
  const [pattern, setPattern] = useState("\\b\\w+Desk\\b");
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState("QuickDesk 是一个桌面工具箱。quickdesk tools.");
  const output = useMemo(() => {
    try {
      const normalizedFlags = flags.includes("g") ? flags : `${flags}g`;
      const regexp = new RegExp(pattern, normalizedFlags);
      const matches = Array.from(text.matchAll(regexp));
      return matches.length
        ? matches.map((match, index) => `${index + 1}. ${match[0]} @ ${match.index ?? 0}`).join("\n")
        : "没有匹配结果";
    } catch (error) {
      return `正则错误：${String(error)}`;
    }
  }, [flags, pattern, text]);

  return (
    <ToolShell title="正则测试" note="输入表达式、flags 和文本，查看匹配结果。">
      <div className="split">
        <Field label="Pattern">
          <input value={pattern} onChange={(event) => setPattern(event.target.value)} />
        </Field>
        <Field label="Flags">
          <input value={flags} onChange={(event) => setFlags(event.target.value)} />
        </Field>
      </div>
      <Field label="测试文本">
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      </Field>
      <Output value={output} />
    </ToolShell>
  );
}

export function MockDataTool() {
  const names = ["陈一", "林夏", "Alex Chen", "Mia Wang", "Noah Li"];
  const cities = ["上海市徐汇区", "杭州市西湖区", "深圳市南山区", "北京市朝阳区"];
  const rows = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => ({
        id: index + 1,
        name: names[index % names.length],
        phone: `13${Math.floor(100000000 + Math.random() * 899999999)}`,
        email: `user${index + 1}@example.com`,
        address: cities[index % cities.length],
        createdAt: new Date(Date.now() - index * 86400000).toISOString(),
      })),
    [],
  );
  const output = JSON.stringify(rows, null, 2);

  return (
    <ToolShell title="Mock 数据" note="生成可复制的测试样例。">
      <button type="button" onClick={() => copyText(output)}>复制 JSON</button>
      <Output value={output} />
    </ToolShell>
  );
}

export function MarkdownTool() {
  const [input, setInput] = useState("# 发布说明\n\n支持 **工具搜索** 和 `Cmd/Ctrl+Shift+Space` 呼出。");

  return (
    <ToolShell title="Markdown 预览" note="基础 Markdown 实时预览。">
      <div className="split">
        <Field label="Markdown">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} />
        </Field>
        <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(input) }} />
      </div>
    </ToolShell>
  );
}

export function TextTool() {
  const [input, setInput] = useState("apple\nbanana\napple\norange");
  const [output, setOutput] = useState("");
  const lines = input.split(/\r?\n/);
  const stats = `字符：${input.length}  单词：${input.trim() ? input.trim().split(/\s+/).length : 0}  行：${lines.length}`;

  return (
    <ToolShell title="文本处理" note="去重、排序、大小写转换和统计。">
      <Field label={stats}>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <div className="button-row">
        <button type="button" onClick={() => setOutput(Array.from(new Set(lines)).join("\n"))}>去重</button>
        <button type="button" onClick={() => setOutput([...lines].sort().join("\n"))}>排序</button>
        <button type="button" onClick={() => setOutput(input.toUpperCase())}>大写</button>
        <button type="button" onClick={() => setOutput(input.toLowerCase())}>小写</button>
        <button type="button" onClick={() => copyText(output)}>复制</button>
      </div>
      <Output value={output || stats} />
    </ToolShell>
  );
}

export function QrTool() {
  const [input, setInput] = useState("https://example.com");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(input || " ", {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: { dark: "#0F172A", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setError("");
        }
      })
      .catch((qrError: unknown) => {
        if (!cancelled) setError(`二维码生成失败：${String(qrError)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [input]);

  return (
    <ToolShell title="二维码" note="离线生成可扫码二维码，适合链接和短文本。">
      <Field label="文本或链接">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      {error ? <p className="error">{error}</p> : null}
      {dataUrl ? <img className="qr-image" src={dataUrl} alt="生成的二维码" /> : null}
      <div className="button-row">
        <button type="button" onClick={() => copyText(input)}>复制原文</button>
        <a className="download-link" href={dataUrl} download="quickdesk-qrcode.png">下载 PNG</a>
      </div>
    </ToolShell>
  );
}

export function ImageInfoTool() {
  const [info, setInfo] = useState("选择一张图片后显示尺寸、格式和大小。");

  function inspectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      setInfo([`文件：${file.name}`, `类型：${file.type || "未知"}`, `尺寸：${image.width} x ${image.height}`, `大小：${(file.size / 1024).toFixed(1)} KB`].join("\n"));
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  }

  return (
    <ToolShell title="图片信息" note="查看图片尺寸、格式和文件大小。">
      <input type="file" accept="image/*" onChange={inspectImage} />
      <Output value={info} />
    </ToolShell>
  );
}

export function PaletteTool() {
  const [base, setBase] = useState("#2563EB");
  const colors = [adjustHex(base, -70), adjustHex(base, -35), base, adjustHex(base, 35), adjustHex(base, 70)];

  return (
    <ToolShell title="配色板" note="从主色生成一组可复制色值。">
      <Field label="主色">
        <input value={base} onChange={(event) => setBase(event.target.value)} />
      </Field>
      <div className="palette-row">
        {colors.map((color) => (
          <button key={color} type="button" className="swatch" style={{ background: color }} onClick={() => copyText(color)}>
            {color}
          </button>
        ))}
      </div>
    </ToolShell>
  );
}
