import { useEffect, useState } from "react";
import { CopyButton, Field, MetricStrip, ResultViewer, StatusBadge, ToolPanel, ToolTabs, ToolWorkspace } from "./ui";

type HmacAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
type OutputFormat = "hex" | "base64";

type HmacState =
  | { loading: true; value: null; error: "" }
  | { loading: false; value: string; error: "" }
  | { loading: false; value: null; error: string };

function textToBytes(text: string) {
  return new TextEncoder().encode(text);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function importHmacKey(secret: string, algorithm: HmacAlgorithm) {
  return crypto.subtle.importKey("raw", textToBytes(secret), { name: "HMAC", hash: { name: algorithm } }, false, ["sign"]);
}

async function signHmac(secret: string, message: string, algorithm: HmacAlgorithm) {
  const key = await importHmacKey(secret, algorithm);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, textToBytes(message)));
  return signature;
}

async function sha256Hex(text: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", textToBytes(text)));
  return bytesToHex(digest);
}

async function hmacSha256Raw(key: Uint8Array | string, message: string) {
  const raw = typeof key === "string" ? textToBytes(key) : key;
  const imported = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, textToBytes(message)));
}

async function deriveAwsSigningKey(secretKey: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmacSha256Raw(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmacSha256Raw(kDate, region);
  const kService = await hmacSha256Raw(kRegion, service);
  return hmacSha256Raw(kService, "aws4_request");
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toAmzDate(date = new Date()) {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
}

function toDateStamp(amzDate: string) {
  return amzDate.slice(0, 8);
}

function percentEncodeAws(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%7E/g, "~");
}

function normalizePath(pathname: string) {
  const segments = pathname.split("/").map((segment) => percentEncodeAws(decodeURIComponent(segment)));
  if (!segments.length) return "/";
  return segments.join("/").replace(/\/\/+/g, "/") || "/";
}

function normalizeQuery(url: URL) {
  return Array.from(url.searchParams.entries())
    .map(([key, value]) => [percentEncodeAws(key), percentEncodeAws(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function parseHeaderLines(input: string) {
  const headers: Record<string, string> = {};
  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const separator = line.indexOf(":");
      if (separator <= 0) {
        throw new Error(`第 ${index + 1} 行缺少冒号`);
      }
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      headers[key] = value;
    });
  return headers;
}

function buildHmacSummary(secret: string, message: string, algorithm: HmacAlgorithm, format: OutputFormat, expected: string) {
  return signHmac(secret, message, algorithm).then((signature) => {
    const encoded = format === "hex" ? bytesToHex(signature) : bytesToBase64(signature);
    const normalizedExpected = expected.trim();
    const matches = Boolean(normalizedExpected) && normalizedExpected.toLowerCase() === encoded.toLowerCase();
    return [
      `Signature: ${encoded}`,
      `Expected Match: ${matches ? "YES" : "NO"}`,
      `Raw HEX: ${bytesToHex(signature)}`,
    ].join("\n");
  });
}

function useAsyncState<T>(factory: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<HmacState>({ loading: true, value: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, value: null, error: "" });
    factory()
      .then((value) => {
        if (!cancelled) setState({ loading: false, value: typeof value === "string" ? value : JSON.stringify(value, null, 2), error: "" });
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, value: null, error: String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, deps);

  return state;
}

export function HmacTool() {
  const [algorithm, setAlgorithm] = useState<HmacAlgorithm>("SHA-256");
  const [format, setFormat] = useState<OutputFormat>("hex");
  const [secret, setSecret] = useState("swiftbox-secret");
  const [message, setMessage] = useState("payload to sign");
  const [expected, setExpected] = useState("");

  const result = useAsyncState(
    () => buildHmacSummary(secret, message, algorithm, format, expected),
    [secret, message, algorithm, format, expected],
  );

  const output = result.value || result.error || "";

  return (
    <ToolWorkspace
      title="HMAC / Webhook 签名"
      description="为接口签名、Webhook 验签和调试回调消息生成 HMAC。"
      actions={<CopyButton value={output} disabled={result.loading || !result.value}>复制结果</CopyButton>}
      meta={
        <>
          <StatusBadge tone={result.error ? "danger" : "success"}>{result.error ? "计算失败" : result.loading ? "计算中" : "已生成"}</StatusBadge>
          <span>{algorithm}</span>
          <span>{format.toUpperCase()}</span>
        </>
      }
    >
      <ToolPanel
        title="签名设置"
        action={
          <ToolTabs
            active={algorithm}
            onChange={(value) => setAlgorithm(value as HmacAlgorithm)}
            tabs={[
              { id: "SHA-1", label: "SHA-1" },
              { id: "SHA-256", label: "SHA-256" },
              { id: "SHA-384", label: "SHA-384" },
              { id: "SHA-512", label: "SHA-512" },
            ]}
          />
        }
      >
        <div className="split">
          <Field label="Secret">
            <input value={secret} onChange={(event) => setSecret(event.target.value)} />
          </Field>
          <Field label="消息 / Payload">
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} spellCheck={false} />
          </Field>
        </div>
        <div className="split">
          <Field label="输出格式">
            <select value={format} onChange={(event) => setFormat(event.target.value as OutputFormat)}>
              <option value="hex">HEX</option>
              <option value="base64">Base64</option>
            </select>
          </Field>
          <Field label="预期签名（可选）">
            <input value={expected} onChange={(event) => setExpected(event.target.value)} />
          </Field>
        </div>
      </ToolPanel>
      <MetricStrip
        items={[
          { label: "消息长度", value: message.length },
          { label: "Secret 长度", value: secret.length },
          { label: "算法", value: algorithm },
        ]}
      />
      {result.error ? <ResultViewer title="错误" value={result.error} /> : <ResultViewer title="签名结果" value={result.value ?? ""} />}
    </ToolWorkspace>
  );
}

export function AwsSigV4Tool() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://example.amazonaws.com/v1/resource?foo=bar");
  const [region, setRegion] = useState("ap-southeast-1");
  const [service, setService] = useState("execute-api");
  const [accessKey, setAccessKey] = useState("AKIAEXAMPLE");
  const [secretKey, setSecretKey] = useState("wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY");
  const [sessionToken, setSessionToken] = useState("");
  const [body, setBody] = useState("");
  const [headersText, setHeadersText] = useState("content-type: application/json");
  const [amzDate, setAmzDate] = useState(toAmzDate());

  const result = useAsyncState(async () => {
    const parsedUrl = new URL(url);
    const payloadHash = await sha256Hex(body);
    const additionalHeaders = parseHeaderLines(headersText);
    const headers: Record<string, string> = {
      host: parsedUrl.host,
      ...additionalHeaders,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
    };
    if (sessionToken.trim()) headers["x-amz-security-token"] = sessionToken.trim();

    const normalizedHeaders = Object.fromEntries(
      Object.entries(headers)
        .map(([key, value]) => [key.toLowerCase(), value.trim()] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    );

    const canonicalHeaders = Object.entries(normalizedHeaders)
      .map(([key, value]) => `${key}:${value.replace(/\s+/g, " ")}`)
      .join("\n");
    const signedHeaders = Object.keys(normalizedHeaders).join(";");
    const canonicalRequest = [
      method.toUpperCase(),
      normalizePath(parsedUrl.pathname),
      normalizeQuery(parsedUrl),
      `${canonicalHeaders}\n`,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = `${toDateStamp(amzDate)}/${region}/${service}/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");
    const signingKey = await deriveAwsSigningKey(secretKey, toDateStamp(amzDate), region, service);
    const signature = bytesToHex(await hmacSha256Raw(signingKey, stringToSign));
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      canonicalRequest,
      stringToSign,
      signature,
      authorization,
      payloadHash,
      canonicalHeaders,
      signedHeaders,
    };
  }, [method, url, region, service, accessKey, secretKey, sessionToken, body, headersText, amzDate]);

  const output = result.value || result.error || "";

  return (
    <ToolWorkspace
      title="AWS SigV4 签名"
      description="生成 AWS Signature Version 4 的 canonical request、string-to-sign 和 Authorization 头。"
      actions={<CopyButton value={output} disabled={result.loading || !result.value}>复制结果</CopyButton>}
      meta={
        <>
          <StatusBadge tone={result.error ? "danger" : "success"}>{result.error ? "签名失败" : result.loading ? "计算中" : "已签名"}</StatusBadge>
          <span>{region}</span>
          <span>{service}</span>
        </>
      }
    >
      <div className="split">
        <Field label="Method">
          <input value={method} onChange={(event) => setMethod(event.target.value)} />
        </Field>
        <Field label="URL">
          <input value={url} onChange={(event) => setUrl(event.target.value)} />
        </Field>
      </div>
      <div className="split">
        <Field label="Region">
          <input value={region} onChange={(event) => setRegion(event.target.value)} />
        </Field>
        <Field label="Service">
          <input value={service} onChange={(event) => setService(event.target.value)} />
        </Field>
      </div>
      <div className="split">
        <Field label="Access Key">
          <input value={accessKey} onChange={(event) => setAccessKey(event.target.value)} />
        </Field>
        <Field label="Secret Key">
          <input value={secretKey} onChange={(event) => setSecretKey(event.target.value)} />
        </Field>
      </div>
      <div className="split">
        <Field label="Session Token（可选）">
          <input value={sessionToken} onChange={(event) => setSessionToken(event.target.value)} />
        </Field>
        <Field label="X-Amz-Date">
          <input value={amzDate} onChange={(event) => setAmzDate(event.target.value)} />
        </Field>
      </div>
      <div className="split align-start">
        <Field label="Headers">
          <textarea value={headersText} onChange={(event) => setHeadersText(event.target.value)} spellCheck={false} />
        </Field>
        <Field label="Body">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false} />
        </Field>
      </div>
      <MetricStrip
        items={[
          { label: "Method", value: method.toUpperCase() },
          { label: "Signed Headers", value: result.value ? JSON.parse(result.value).signedHeaders.split(";").length : 0 },
          { label: "Body 字符", value: body.length },
        ]}
      />
      {result.error ? (
        <ResultViewer title="错误" value={result.error} />
      ) : (
        <div className="split">
          <ResultViewer title="Authorization" value={JSON.parse(result.value || "{}").authorization || ""} />
          <ResultViewer title="Canonical Request" value={JSON.parse(result.value || "{}").canonicalRequest || ""} />
          <ResultViewer title="String To Sign" value={JSON.parse(result.value || "{}").stringToSign || ""} />
        </div>
      )}
    </ToolWorkspace>
  );
}
