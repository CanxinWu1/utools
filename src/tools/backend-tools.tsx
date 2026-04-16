import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  CopyButton,
  copyText,
  Field,
  InlineError,
  KeyValueEditor,
  MetricStrip,
  Output,
  ResultViewer,
  StatusBadge,
  ToolPanel,
  ToolShell,
  ToolTabs,
  ToolWorkspace,
  type KeyValueItem,
} from "./ui";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
type KeyValueRow = KeyValueItem;
type HeaderInputMode = "table" | "json" | "raw";
type BodyInputMode = "json" | "table" | "urlencoded" | "raw";
type RequestTab = "params" | "headers" | "body" | "curl";
type ResponseTab = "body" | "headers" | "info";
type JwtTab = "payload" | "header" | "claims";

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

function rowsToFormUrlEncoded(rows: KeyValueRow[]) {
  const params = new URLSearchParams();
  rows
    .filter((row) => row.enabled && row.key.trim())
    .forEach((row) => params.append(row.key.trim(), row.value));
  return params.toString();
}

function formBodyToRows(body: string) {
  try {
    return Array.from(new URLSearchParams(body).entries()).map(([key, value]) => createRow(key, value));
  } catch {
    return [];
  }
}

function objectToRows(value: Record<string, unknown>) {
  return Object.entries(value).map(([key, item]) => createRow(key, typeof item === "string" ? item : JSON.stringify(item)));
}

function rowsFromSearchParams(inputUrl: string) {
  try {
    const parsedUrl = new URL(inputUrl);
    return Array.from(parsedUrl.searchParams.entries()).map(([key, value]) => createRow(key, value));
  } catch {
    return [];
  }
}

function buildUrlWithParams(inputUrl: string, rows: KeyValueRow[]) {
  const activeRows = rows.filter((row) => row.enabled && row.key.trim());
  if (!activeRows.length) return inputUrl;
  try {
    const parsedUrl = new URL(inputUrl);
    activeRows.forEach((row) => parsedUrl.searchParams.set(row.key.trim(), row.value));
    return parsedUrl.toString();
  } catch {
    return inputUrl;
  }
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

function formatJwtTime(value?: number) {
  return typeof value === "number" ? new Date(value * 1000).toLocaleString() : "-";
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
  const [requestTab, setRequestTab] = useState<RequestTab>("params");
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");
  const [paramRows, setParamRows] = useState<KeyValueRow[]>([]);
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
  const effectiveUrl = useMemo(() => buildUrlWithParams(url, paramRows), [paramRows, url]);
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
      if (bodyMode === "urlencoded") return rowsToFormUrlEncoded(bodyRows);
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
  const canSend = /^https?:\/\//i.test(effectiveUrl.trim()) && headerState.invalid.length === 0 && !headerJsonError && !bodyJsonError;
  const responseBody = response ? prettyBody(response.body, response.headers) : "";

  async function sendRequest(requestOverride?: { method: HttpMethod; url: string; headers: string; body: string }) {
    const request = requestOverride ?? { method, url: effectiveUrl, headers: effectiveHeaders, body: effectiveBody };
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

  function applyCurl(sendAfterParse = false) {
    try {
      const parsed = parseCurl(curlInput);
      setMethod(parsed.method);
      setUrl(parsed.url);
      setParamRows(rowsFromSearchParams(parsed.url));
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
          const formRows = formBodyToRows(parsed.body);
          if (formRows.length) {
            setBodyMode("urlencoded");
            setBodyRows(formRows);
          } else {
            setBodyMode("raw");
            setRawBody(parsed.body);
          }
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
  const activeParamCount = paramRows.filter((row) => row.enabled && row.key.trim()).length;
  const bodySize = effectiveBody.length;
  const responseInfo = response
    ? [
        `状态: ${response.status} ${response.status_text}`,
        `耗时: ${response.elapsed_ms} ms`,
        `响应头: ${Object.keys(response.headers).length}`,
        `大小: ${response.body.length} chars`,
      ].join("\n")
    : "";

  return (
    <ToolWorkspace
      title="HTTP 请求"
      description="轻量 Postman：请求不入库，响应自动识别 JSON。"
      actions={<CopyButton value={buildCurl(method, effectiveUrl, effectiveHeaders, effectiveBody)}>复制 cURL</CopyButton>}
      meta={
        <>
          <StatusBadge tone={canSend ? "success" : "danger"}>{canSend ? "Ready" : "Check request"}</StatusBadge>
          <span>{activeParamCount} Params</span>
          <span>{activeHeaderCount} Headers</span>
          <span>{bodySize} Body chars</span>
        </>
      }
    >
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
          {effectiveUrl !== url ? <div className="http-url-preview">最终 URL：{effectiveUrl}</div> : null}
        </section>

        <ToolPanel
          title="请求配置"
          description="Params、Headers、Body、cURL 集中在一个区域，切换时不会丢内容。"
          action={
            <ToolTabs
              active={requestTab}
              onChange={(value) => setRequestTab(value as RequestTab)}
              tabs={[
                { id: "params", label: "Params" },
                { id: "headers", label: "Headers" },
                { id: "body", label: "Body" },
                { id: "curl", label: "cURL" },
              ]}
            />
          }
        >
          {requestTab === "params" ? (
            <KeyValueEditor
              rows={paramRows}
              onChange={setParamRows}
              onAdd={() => createRow()}
              addLabel="添加参数"
            />
          ) : null}

          {requestTab === "headers" ? (
            <div className="http-tab-stack">
              <ToolTabs
                active={headerMode}
                onChange={(value) => setHeaderMode(value as HeaderInputMode)}
                tabs={[
                  { id: "table", label: "表格" },
                  { id: "json", label: "JSON" },
                  { id: "raw", label: "Raw" },
                ]}
              />
          {headerMode === "table" ? (
            <KeyValueEditor rows={headerRows} onChange={setHeaderRows} onAdd={() => createRow()} addLabel="添加 Header" />
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
            </div>
          ) : null}

          {requestTab === "body" ? (
            <div className="http-tab-stack">
              <ToolTabs
                active={bodyMode}
                onChange={(value) => setBodyMode(value as BodyInputMode)}
                tabs={[
                  { id: "json", label: "JSON" },
                  { id: "table", label: "表格" },
                  { id: "urlencoded", label: "Form" },
                  { id: "raw", label: "Raw" },
                ]}
              />
          {bodyMode === "json" ? (
            <Field label="JSON Body">
              <textarea value={bodyJson} onChange={(event) => setBodyJson(event.target.value)} placeholder='{"name":"SwiftBox"}' spellCheck={false} />
            </Field>
          ) : null}
          {bodyMode === "table" ? (
            <KeyValueEditor rows={bodyRows} onChange={setBodyRows} onAdd={() => createRow()} addLabel="添加字段" />
          ) : null}
          {bodyMode === "urlencoded" ? (
            <div className="http-tab-stack">
              <KeyValueEditor rows={bodyRows} onChange={setBodyRows} onAdd={() => createRow()} addLabel="添加字段" />
              <ResultViewer title="x-www-form-urlencoded" value={rowsToFormUrlEncoded(bodyRows)} />
            </div>
          ) : null}
          {bodyMode === "raw" ? (
            <Field label="Raw Body">
              <textarea value={rawBody} onChange={(event) => setRawBody(event.target.value)} spellCheck={false} />
            </Field>
          ) : null}
            </div>
          ) : null}

          {requestTab === "curl" ? (
            <div className="http-tab-stack">
              <div className="button-row">
                <button type="button" onClick={() => applyCurl(false)}>解析到表单</button>
                <button type="button" onClick={() => applyCurl(true)}>解析并发送</button>
              </div>
              <textarea className="curl-input" value={curlInput} onChange={(event) => setCurlInput(event.target.value)} spellCheck={false} />
            </div>
          ) : null}
        </ToolPanel>

        {headerJsonError ? <InlineError message={`Headers JSON 错误：${headerJsonError}`} /> : null}
        {bodyJsonError ? <InlineError message={`Body JSON 错误：${bodyJsonError}`} /> : null}
        {headerState.invalid.length ? <InlineError message={headerState.invalid.join("；")} /> : null}
        {error ? <InlineError message={error} /> : null}

        {response ? (
          <ToolPanel
            title="响应结果"
            description={`${response.status} ${response.status_text}`}
            action={
              <ToolTabs
                active={responseTab}
                onChange={(value) => setResponseTab(value as ResponseTab)}
                tabs={[
                  { id: "body", label: "Body" },
                  { id: "headers", label: "Headers" },
                  { id: "info", label: "Info" },
                ]}
              />
            }
          >
            <MetricStrip
              items={[
                { label: "状态", value: `${response.status}` },
                { label: "耗时", value: `${response.elapsed_ms} ms` },
                { label: "响应头", value: Object.keys(response.headers).length },
                { label: "大小", value: `${response.body.length} chars` },
              ]}
            />
            {responseTab === "body" ? <ResultViewer title="Body" value={responseBody} /> : null}
            {responseTab === "headers" ? <ResultViewer title="Headers" value={JSON.stringify(response.headers, null, 2)} /> : null}
            {responseTab === "info" ? <ResultViewer title="Info" value={responseInfo} /> : null}
          </ToolPanel>
        ) : null}
      </div>
    </ToolWorkspace>
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
  const [tab, setTab] = useState<JwtTab>("payload");
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
  const claimsOutput = result.ok
    ? [
        `Subject: ${result.payload.sub ?? "-"}`,
        `Issuer: ${result.payload.iss ?? "-"}`,
        `Audience: ${Array.isArray(result.payload.aud) ? result.payload.aud.join(", ") : result.payload.aud ?? "-"}`,
        `Issued At: ${formatJwtTime(result.payload.iat)}`,
        `Not Before: ${formatJwtTime(result.payload.nbf)}`,
        `Expires: ${formatJwtTime(result.payload.exp)}`,
        `Status: ${result.expired === null ? "无 exp" : result.expired ? "已过期" : "未过期"}`,
      ].join("\n")
    : "";
  const tabValue = result.ok
    ? {
        payload: JSON.stringify(result.payload, null, 2),
        header: JSON.stringify(result.header, null, 2),
        claims: claimsOutput,
      }[tab]
    : "";

  return (
    <ToolWorkspace
      title="JWT 解码"
      description="本地 decode Header 和 Payload；不验证签名，不承诺 token 可信。"
      actions={<CopyButton value={tabValue || output} disabled={!result.ok}>复制当前视图</CopyButton>}
      meta={
        <>
          <StatusBadge tone={result.ok ? (result.expired ? "danger" : "success") : "warning"}>
            {result.ok ? (result.expired ? "已过期" : "可解码") : "等待令牌"}
          </StatusBadge>
          {result.ok ? <span>{result.header.alg ?? "未知算法"}</span> : null}
        </>
      }
    >
      <Field label="JWT">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />
      </Field>
      <InlineError message="只做本地解码，不做签名校验；请不要把这里的结果当作鉴权结论。" />
      {result.ok ? (
        <>
          <MetricStrip
            items={[
              { label: "算法", value: result.header.alg ?? "未知" },
              { label: "类型", value: result.header.typ ?? "JWT" },
              { label: "Subject", value: result.payload.sub ?? "-" },
              { label: "过期", value: formatJwtTime(result.payload.exp) },
            ]}
          />
          <ToolPanel
            title="解码结果"
            description="Header、Payload 和常见 Claims 分开查看。"
            action={
              <ToolTabs
                active={tab}
                onChange={(value) => setTab(value as JwtTab)}
                tabs={[
                  { id: "payload", label: "Payload" },
                  { id: "header", label: "Header" },
                  { id: "claims", label: "Claims" },
                ]}
              />
            }
          >
            <ResultViewer value={tabValue} />
          </ToolPanel>
        </>
      ) : (
        <InlineError message={result.message} />
      )}
    </ToolWorkspace>
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
