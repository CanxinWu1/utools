import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { copyText, Field, MetricStrip, Output, StatusPill, ToolShell } from "./shared";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
type KeyValueRow = { id: string; key: string; value: string; enabled: boolean };
type HeaderInputMode = "table" | "json" | "raw";
type BodyInputMode = "json" | "table" | "raw";

interface HttpResponse {
  status: number;
  status_text: string;
  elapsed_ms: number;
  headers: Record<string, string>;
  body: string;
}

function parseHeaders(input: string) {
  const headers: Record<string, string> = {};
  const invalid: string[] = [];
  input.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const separator = trimmed.indexOf(":");
    if (separator <= 0) {
      invalid.push(`第 ${index + 1} 行缺少冒号`);
      return;
    }
    headers[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  });
  return { headers, invalid };
}

function createRow(key = "", value = "", enabled = true): KeyValueRow {
  return { id: crypto.randomUUID(), key, value, enabled };
}

function rowsToHeaders(rows: KeyValueRow[]) {
  return rows
    .filter((row) => row.enabled && row.key.trim())
    .map((row) => `${row.key.trim()}: ${row.value.trim()}`)
    .join("\n");
}

function rowsToObject(rows: KeyValueRow[]) {
  return Object.fromEntries(
    rows
      .filter((row) => row.enabled && row.key.trim())
      .map((row) => [row.key.trim(), row.value]),
  );
}

function objectToRows(value: Record<string, unknown>) {
  return Object.entries(value).map(([key, item]) => createRow(key, typeof item === "string" ? item : JSON.stringify(item)));
}

function parseJsonObject(input: string) {
  const parsed = JSON.parse(input) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("请输入 JSON 对象，例如 {\"Accept\":\"application/json\"}");
  }
  return parsed as Record<string, unknown>;
}

function prettyBody(body: string, headers: Record<string, string>) {
  const contentType = Object.entries(headers).find(([key]) => key.toLowerCase() === "content-type")?.[1] ?? "";
  if (!contentType.includes("json")) return body;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function parseJwtSegment(segment: string) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function describeCronField(value: string, unit: string) {
  if (value === "*") return `每${unit}`;
  if (value.startsWith("*/")) return `每 ${value.slice(2)} ${unit}`;
  if (value.includes(",")) return `${unit}为 ${value.split(",").join("、")}`;
  if (value.includes("-")) return `${unit}范围 ${value}`;
  return `${unit}为 ${value}`;
}

function buildCurl(method: HttpMethod, url: string, headers: string, body: string) {
  const lines = [`curl -X ${method} '${url}'`];
  Object.entries(parseHeaders(headers).headers).forEach(([key, value]) => {
    lines.push(`  -H '${key}: ${value}'`);
  });
  if (body.trim() && method !== "GET") lines.push(`  --data '${body.replace(/'/g, "'\\''")}'`);
  return lines.join(" \\\n");
}

function tokenizeCurl(input: string) {
  const normalized = input.replace(/\\\r?\n/g, " ");
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "\\" && quote !== "'") {
      index += 1;
      current += normalized[index] ?? "";
      continue;
    }
    if ((char === "'" || char === "\"") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (/\s/.test(char) && !quote) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

function parseCurl(input: string): { method: HttpMethod; url: string; headers: KeyValueRow[]; body: string } {
  const tokens = tokenizeCurl(input).filter((token) => token !== "curl");
  let parsedMethod: HttpMethod | "" = "";
  let parsedUrl = "";
  const parsedHeaders: KeyValueRow[] = [];
  const bodyParts: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if ((token === "-X" || token === "--request") && next) {
      parsedMethod = next.toUpperCase() as HttpMethod;
      index += 1;
      continue;
    }
    if ((token === "-H" || token === "--header") && next) {
      const separator = next.indexOf(":");
      if (separator > 0) {
        parsedHeaders.push(createRow(next.slice(0, separator).trim(), next.slice(separator + 1).trim()));
      }
      index += 1;
      continue;
    }
    if (token.startsWith("-H") && token.length > 2) {
      const header = token.slice(2).trim();
      const separator = header.indexOf(":");
      if (separator > 0) parsedHeaders.push(createRow(header.slice(0, separator).trim(), header.slice(separator + 1).trim()));
      continue;
    }
    if (["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode"].includes(token) && next) {
      bodyParts.push(next);
      index += 1;
      continue;
    }
    if (!token.startsWith("-") && !parsedUrl) {
      parsedUrl = token;
    }
  }

  if (!parsedUrl) throw new Error("没有从 cURL 中解析到 URL");
  const parsedBody = bodyParts.join("&");
  return {
    method: (parsedMethod || (parsedBody ? "POST" : "GET")) as HttpMethod,
    url: parsedUrl,
    headers: parsedHeaders.length ? parsedHeaders : [createRow("Accept", "application/json")],
    body: parsedBody,
  };
}

export function HttpTool() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("https://httpbin.org/get");
  const [headerMode, setHeaderMode] = useState<HeaderInputMode>("table");
  const [headerRows, setHeaderRows] = useState<KeyValueRow[]>([createRow("Accept", "application/json")]);
  const [headerJson, setHeaderJson] = useState('{"Accept":"application/json"}');
  const [rawHeaders, setRawHeaders] = useState("Accept: application/json");
  const [bodyMode, setBodyMode] = useState<BodyInputMode>("json");
  const [bodyJson, setBodyJson] = useState("");
  const [bodyRows, setBodyRows] = useState<KeyValueRow[]>([createRow("name", "SwiftBox")]);
  const [rawBody, setRawBody] = useState("");
  const [curlInput, setCurlInput] = useState("curl -X GET 'https://httpbin.org/get' -H 'Accept: application/json'");
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const effectiveHeaders = useMemo(() => {
    try {
      if (headerMode === "table") return rowsToHeaders(headerRows);
      if (headerMode === "json") return rowsToHeaders(objectToRows(parseJsonObject(headerJson)));
      return rawHeaders;
    } catch {
      return rawHeaders;
    }
  }, [headerJson, headerMode, headerRows, rawHeaders]);
  const effectiveBody = useMemo(() => {
    try {
      if (bodyMode === "table") return JSON.stringify(rowsToObject(bodyRows), null, 2);
      if (bodyMode === "json") return bodyJson.trim() ? JSON.stringify(JSON.parse(bodyJson), null, 2) : "";
      return rawBody;
    } catch {
      return bodyJson;
    }
  }, [bodyJson, bodyMode, bodyRows, rawBody]);
  const headerJsonError = useMemo(() => {
    if (headerMode !== "json") return "";
    try {
      parseJsonObject(headerJson);
      return "";
    } catch (parseError) {
      return String(parseError);
    }
  }, [headerJson, headerMode]);
  const bodyJsonError = useMemo(() => {
    if (bodyMode !== "json" || !bodyJson.trim()) return "";
    try {
      JSON.parse(bodyJson);
      return "";
    } catch (parseError) {
      return String(parseError);
    }
  }, [bodyJson, bodyMode]);
  const headerState = useMemo(() => parseHeaders(effectiveHeaders), [effectiveHeaders]);
  const canSend = /^https?:\/\//i.test(url.trim()) && headerState.invalid.length === 0 && !headerJsonError && !bodyJsonError;
  const responseBody = response ? prettyBody(response.body, response.headers) : "";

  async function sendRequest(requestOverride?: { method: HttpMethod; url: string; headers: string; body: string }) {
    const request = requestOverride ?? { method, url, headers: effectiveHeaders, body: effectiveBody };
    if (!/^https?:\/\//i.test(request.url.trim()) || parseHeaders(request.headers).invalid.length) return;
    setLoading(true);
    setError("");
    setResponse(null);
    try {
      const result = await invoke<HttpResponse>("send_http_request", {
        request,
      });
      setResponse(result);
    } catch (requestError) {
      setError(String(requestError));
    } finally {
      setLoading(false);
    }
  }

  function updateHeaderRow(id: string, patch: Partial<KeyValueRow>) {
    setHeaderRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateBodyRow(id: string, patch: Partial<KeyValueRow>) {
    setBodyRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function applyCurl(sendAfterParse = false) {
    try {
      const parsed = parseCurl(curlInput);
      setMethod(parsed.method);
      setUrl(parsed.url);
      setHeaderMode("table");
      setHeaderRows(parsed.headers);
      setRawHeaders(rowsToHeaders(parsed.headers));
      setHeaderJson(JSON.stringify(rowsToObject(parsed.headers), null, 2));
      if (parsed.body) {
        try {
          JSON.parse(parsed.body);
          setBodyMode("json");
          setBodyJson(JSON.stringify(JSON.parse(parsed.body), null, 2));
        } catch {
          setBodyMode("raw");
          setRawBody(parsed.body);
        }
      }
      setError("");
      if (sendAfterParse) {
        void sendRequest({
          method: parsed.method,
          url: parsed.url,
          headers: rowsToHeaders(parsed.headers),
          body: parsed.body,
        });
      }
    } catch (curlError) {
      setError(`cURL 解析失败：${String(curlError)}`);
    }
  }

  const activeHeaderCount = Object.keys(headerState.headers).length;
  const bodySize = effectiveBody.length;

  return (
    <ToolShell title="HTTP 请求" note="轻量 Postman：请求不入库，响应自动识别 JSON。">
      <div className="http-tool">
        <section className="http-composer">
          <div className="http-request-line">
            <select value={method} onChange={(event) => setMethod(event.target.value as HttpMethod)} aria-label="请求方法">
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://api.example.com" />
            <button type="button" className="send-button" onClick={() => void sendRequest()} disabled={loading || !canSend}>
              {loading ? "发送中" : "发送请求"}
            </button>
          </div>
          <div className="http-meta-row">
            <StatusPill tone={canSend ? "success" : "danger"}>{canSend ? "Ready" : "Check request"}</StatusPill>
            <span>{activeHeaderCount} Headers</span>
            <span>{bodySize} Body chars</span>
            <button type="button" onClick={() => copyText(buildCurl(method, url, effectiveHeaders, effectiveBody))}>复制 cURL</button>
          </div>
        </section>

        <section className="http-import">
          <div className="http-import-head">
            <div>
              <strong>cURL 导入</strong>
              <span>粘贴命令后可解析到表单，或直接发起请求。</span>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => applyCurl(false)}>解析</button>
              <button type="button" onClick={() => applyCurl(true)}>解析并发送</button>
            </div>
          </div>
          <textarea className="curl-input" value={curlInput} onChange={(event) => setCurlInput(event.target.value)} spellCheck={false} />
        </section>

        <div className="http-config-grid">
          <section className="http-config-panel">
            <div className="http-panel-head">
              <div>
                <strong>Headers</strong>
                <span>请求头会被转换为标准 key: value 格式。</span>
              </div>
              <div className="segmented-tabs">
                {[
                  ["table", "表格"],
                  ["json", "JSON"],
                  ["raw", "Raw"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={headerMode === value ? "active" : ""}
                    onClick={() => setHeaderMode(value as HeaderInputMode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          {headerMode === "table" ? (
            <div className="kv-editor">
              {headerRows.map((row) => (
                <div key={row.id} className="kv-row">
                  <input type="checkbox" checked={row.enabled} onChange={(event) => updateHeaderRow(row.id, { enabled: event.target.checked })} />
                  <input value={row.key} onChange={(event) => updateHeaderRow(row.id, { key: event.target.value })} placeholder="Key" />
                  <input value={row.value} onChange={(event) => updateHeaderRow(row.id, { value: event.target.value })} placeholder="Value" />
                  <button type="button" onClick={() => setHeaderRows((rows) => rows.filter((item) => item.id !== row.id))}>删除</button>
                </div>
              ))}
              <button type="button" onClick={() => setHeaderRows((rows) => [...rows, createRow()])}>添加 Header</button>
            </div>
          ) : null}
          {headerMode === "json" ? (
            <Field label="JSON Headers">
              <textarea value={headerJson} onChange={(event) => setHeaderJson(event.target.value)} spellCheck={false} />
            </Field>
          ) : null}
          {headerMode === "raw" ? (
            <Field label="Raw Headers，每行 key: value">
              <textarea value={rawHeaders} onChange={(event) => setRawHeaders(event.target.value)} spellCheck={false} />
            </Field>
          ) : null}
          </section>

          <section className="http-config-panel">
            <div className="http-panel-head">
              <div>
                <strong>Body</strong>
                <span>JSON 和表格都会在发送前规范化。</span>
              </div>
              <div className="segmented-tabs">
                {[
                  ["json", "JSON"],
                  ["table", "表格"],
                  ["raw", "Raw"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={bodyMode === value ? "active" : ""}
                    onClick={() => setBodyMode(value as BodyInputMode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          {bodyMode === "json" ? (
            <Field label="JSON Body">
              <textarea value={bodyJson} onChange={(event) => setBodyJson(event.target.value)} placeholder='{"name":"SwiftBox"}' spellCheck={false} />
            </Field>
          ) : null}
          {bodyMode === "table" ? (
            <div className="kv-editor">
              {bodyRows.map((row) => (
                <div key={row.id} className="kv-row">
                  <input type="checkbox" checked={row.enabled} onChange={(event) => updateBodyRow(row.id, { enabled: event.target.checked })} />
                  <input value={row.key} onChange={(event) => updateBodyRow(row.id, { key: event.target.value })} placeholder="Key" />
                  <input value={row.value} onChange={(event) => updateBodyRow(row.id, { value: event.target.value })} placeholder="Value" />
                  <button type="button" onClick={() => setBodyRows((rows) => rows.filter((item) => item.id !== row.id))}>删除</button>
                </div>
              ))}
              <button type="button" onClick={() => setBodyRows((rows) => [...rows, createRow()])}>添加字段</button>
            </div>
          ) : null}
          {bodyMode === "raw" ? (
            <Field label="Raw Body">
              <textarea value={rawBody} onChange={(event) => setRawBody(event.target.value)} spellCheck={false} />
            </Field>
          ) : null}
          </section>
        </div>

        {headerJsonError ? <p className="error">Headers JSON 错误：{headerJsonError}</p> : null}
        {bodyJsonError ? <p className="error">Body JSON 错误：{bodyJsonError}</p> : null}
        {headerState.invalid.length ? <p className="error">{headerState.invalid.join("；")}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {response ? (
          <section className="http-response-panel">
            <div className="http-response-head">
              <div>
                <strong>响应结果</strong>
                <span>{response.status} {response.status_text}</span>
              </div>
              <button type="button" onClick={() => copyText(responseBody)}>复制响应体</button>
            </div>
            <MetricStrip
              items={[
                { label: "状态", value: `${response.status}` },
                { label: "耗时", value: `${response.elapsed_ms} ms` },
                { label: "响应头", value: Object.keys(response.headers).length },
                { label: "大小", value: `${response.body.length} chars` },
              ]}
            />
            <Output value={`${JSON.stringify(response.headers, null, 2)}\n\n${responseBody}`} />
          </section>
        ) : null}
      </div>
    </ToolShell>
  );
}

export function UuidTool() {
  const [length, setLength] = useState(24);
  const [count, setCount] = useState(4);
  const [includeSymbols, setIncludeSymbols] = useState(false);
  const [nonce, setNonce] = useState(0);
  const alphabet = `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789${includeSymbols ? "!@#$%^&*" : ""}`;
  const rows = useMemo(() => {
    void nonce;
    return Array.from({ length: count }, () => {
      const values = crypto.getRandomValues(new Uint32Array(length));
      return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
    });
  }, [alphabet, count, length, nonce]);
  const uuidRows = useMemo(() => {
    void nonce;
    return Array.from({ length: count }, () => crypto.randomUUID());
  }, [count, nonce]);
  const output = `UUID\n${uuidRows.join("\n")}\n\n随机字符串\n${rows.join("\n")}`;

  return (
    <ToolShell title="UUID / 随机字符串" note="批量生成 UUID、Token 和测试密码。">
      <div className="split">
        <Field label="随机字符串长度">
          <input type="number" min="8" max="96" value={length} onChange={(event) => setLength(Number(event.target.value))} />
        </Field>
        <Field label="生成数量">
          <input type="number" min="1" max="32" value={count} onChange={(event) => setCount(Number(event.target.value))} />
        </Field>
      </div>
      <label className="inline-check">
        <input type="checkbox" checked={includeSymbols} onChange={(event) => setIncludeSymbols(event.target.checked)} />
        包含符号
      </label>
      <div className="button-row">
        <button type="button" onClick={() => setNonce((value) => value + 1)}>重新生成</button>
        <button type="button" onClick={() => copyText(output)}>复制全部</button>
      </div>
      <Output value={output} />
    </ToolShell>
  );
}

export function JwtTool() {
  const [input, setInput] = useState("");
  const result = useMemo(() => {
    if (!input.trim()) return { ok: false as const, message: "粘贴 JWT 后会在本地解码，不验证签名。" };
    const parts = input.trim().split(".");
    if (parts.length < 2) return { ok: false as const, message: "JWT 至少需要 Header 和 Payload 两段" };
    try {
      const header = parseJwtSegment(parts[0]) as { alg?: string; typ?: string };
      const payload = parseJwtSegment(parts[1]) as { exp?: number; iat?: number; nbf?: number; sub?: string; iss?: string; aud?: string };
      const now = Math.floor(Date.now() / 1000);
      const expired = typeof payload.exp === "number" ? payload.exp < now : null;
      return { ok: true as const, header, payload, expired };
    } catch (error) {
      return { ok: false as const, message: `JWT 解码失败：${String(error)}` };
    }
  }, [input]);
  const output = result.ok
    ? `Header\n${JSON.stringify(result.header, null, 2)}\n\nPayload\n${JSON.stringify(result.payload, null, 2)}`
    : result.message;

  return (
    <ToolShell title="JWT 解码" note="只做本地 decode，展示常见声明和过期状态。">
      <Field label="JWT">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />
      </Field>
      <div className="button-row">
        <StatusPill tone={result.ok ? (result.expired ? "danger" : "success") : "warning"}>
          {result.ok ? (result.expired ? "已过期" : "可解码") : "等待令牌"}
        </StatusPill>
        <button type="button" onClick={() => copyText(output)}>复制结果</button>
      </div>
      {result.ok ? (
        <MetricStrip
          items={[
            { label: "算法", value: result.header.alg ?? "未知" },
            { label: "类型", value: result.header.typ ?? "JWT" },
            { label: "Subject", value: result.payload.sub ?? "-" },
            { label: "过期", value: result.payload.exp ? new Date(result.payload.exp * 1000).toLocaleString() : "无 exp" },
          ]}
        />
      ) : null}
      <Output value={output} />
    </ToolShell>
  );
}

export function HashTool() {
  const [input, setInput] = useState("SwiftBox");
  const [fileName, setFileName] = useState("");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [output, setOutput] = useState("");
  const sourceBytes = useMemo(() => fileBytes ?? new TextEncoder().encode(input), [fileBytes, input]);

  useEffect(() => {
    let cancelled = false;
    crypto.subtle
      .digest(algorithm, sourceBytes)
      .then((digest) => {
        if (!cancelled) setOutput(bufferToHex(digest));
      })
      .catch((error: unknown) => {
        if (!cancelled) setOutput(`摘要生成失败：${String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [algorithm, sourceBytes]);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileBytes(await file.arrayBuffer());
  }

  return (
    <ToolShell title="哈希摘要" note="文本和文件都可生成 SHA 摘要。">
      <div className="split">
        <Field label="算法">
          <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value as HashAlgorithm)}>
            {["SHA-1", "SHA-256", "SHA-384", "SHA-512"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="选择文件">
          <input type="file" onChange={readFile} />
        </Field>
      </div>
      <Field label={fileName ? `当前文件：${fileName}` : "文本"}>
        <textarea value={input} onChange={(event) => {
          setInput(event.target.value);
          setFileBytes(null);
          setFileName("");
        }} />
      </Field>
      <MetricStrip
        items={[
          { label: "来源", value: fileName || "文本" },
          { label: "字节", value: sourceBytes.byteLength },
          { label: "算法", value: algorithm },
        ]}
      />
      <button type="button" onClick={() => copyText(output)}>复制摘要</button>
      <Output value={output} />
    </ToolShell>
  );
}

export function CronTool() {
  const [input, setInput] = useState("*/15 9-18 * * 1-5");
  const presets = ["*/5 * * * *", "0 9 * * 1-5", "0 0 1 * *", "30 2 * * *"];
  const output = useMemo(() => {
    const fields = input.trim().split(/\s+/);
    if (fields.length !== 5) return "请输入 5 段 Cron：分钟 小时 日期 月份 星期";
    const [minute, hour, day, month, weekday] = fields;
    return [
      `分钟：${describeCronField(minute, "分钟")}`,
      `小时：${describeCronField(hour, "小时")}`,
      `日期：${describeCronField(day, "日")}`,
      `月份：${describeCronField(month, "月")}`,
      `星期：${describeCronField(weekday, "星期")}`,
      "",
      "说明只覆盖常见 5 段 Cron，不包含秒和时区。",
    ].join("\n");
  }, [input]);

  return (
    <ToolShell title="Cron 表达式" note="解释常见 5 段 Cron 表达式，适合定时任务沟通。">
      <Field label="Cron">
        <input value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <div className="button-row">
        {presets.map((preset) => (
          <button key={preset} type="button" onClick={() => setInput(preset)}>{preset}</button>
        ))}
        <button type="button" onClick={() => copyText(output)}>复制说明</button>
      </div>
      <Output value={output} />
    </ToolShell>
  );
}
