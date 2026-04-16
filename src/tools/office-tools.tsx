import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { copyText, Field, MetricStrip, Output, ToolSection, ToolShell } from "./shared";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(value: string) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/\n/g, "<br />");
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((item) => item.some((value) => value.trim()));
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CsvJsonTool() {
  const [input, setInput] = useState("name,role\nAlex,Designer\nMia,Frontend");
  const [output, setOutput] = useState("");
  const csvStats = useMemo(() => {
    const rows = parseCsvRows(input);
    return { rows: Math.max(0, rows.length - 1), columns: rows[0]?.length ?? 0 };
  }, [input]);

  function toJson() {
    const rows = parseCsvRows(input);
    const [headers, ...items] = rows;
    if (!headers?.length) {
      setOutput("CSV 至少需要一行表头");
      return;
    }
    setOutput(JSON.stringify(items.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))), null, 2));
  }

  function toCsv() {
    try {
      const parsed = JSON.parse(input) as unknown;
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const objects = rows.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
      const headers = Array.from(new Set(objects.flatMap((item) => Object.keys(item))));
      setOutput([headers.map(csvEscape).join(","), ...objects.map((item) => headers.map((header) => csvEscape(item[header])).join(","))].join("\n"));
    } catch (error) {
      setOutput(`JSON 转 CSV 失败：${String(error)}`);
    }
  }

  return (
    <ToolShell title="CSV / JSON" note="表格数据与 JSON 数组互转，附带行列统计。">
      <Field label="CSV 或 JSON">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />
      </Field>
      <MetricStrip
        items={[
          { label: "CSV 行", value: csvStats.rows },
          { label: "CSV 列", value: csvStats.columns },
          { label: "输入字符", value: input.length },
        ]}
      />
      <div className="button-row">
        <button type="button" onClick={toJson}>CSV 转 JSON</button>
        <button type="button" onClick={toCsv}>JSON 转 CSV</button>
        <button type="button" onClick={() => copyText(output)}>复制</button>
      </div>
      <Output value={output} />
    </ToolShell>
  );
}

export function MarkdownTool() {
  const [input, setInput] = useState("# 发布说明\n\n支持 **工具搜索** 和 `Cmd/Ctrl+Shift+Space` 呼出。\n\n- 本地处理\n- 快速复制");
  const html = useMemo(() => renderMarkdown(input), [input]);

  return (
    <ToolShell title="Markdown 预览" note="基础 Markdown 实时预览，并支持复制 HTML。">
      <MetricStrip
        items={[
          { label: "字符", value: input.length },
          { label: "行数", value: input.split(/\r?\n/).length },
          { label: "标题", value: input.match(/^#+\s/gm)?.length ?? 0 },
        ]}
      />
      <div className="split">
        <Field label="Markdown">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} />
        </Field>
        <ToolSection title="预览" action={<button type="button" onClick={() => copyText(html)}>复制 HTML</button>}>
          <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />
        </ToolSection>
      </div>
    </ToolShell>
  );
}

export function TextTool() {
  const [input, setInput] = useState("apple\nbanana\napple\norange");
  const [output, setOutput] = useState("");
  const lines = input.split(/\r?\n/);
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;

  return (
    <ToolShell title="文本处理" note="去重、排序、清理空行、大小写和 slug 转换。">
      <MetricStrip
        items={[
          { label: "字符", value: input.length },
          { label: "单词", value: words },
          { label: "行", value: lines.length },
          { label: "非空行", value: lines.filter(Boolean).length },
        ]}
      />
      <Field label="文本">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <div className="button-row">
        <button type="button" onClick={() => setOutput(Array.from(new Set(lines)).join("\n"))}>去重</button>
        <button type="button" onClick={() => setOutput([...lines].sort((a, b) => a.localeCompare(b)).join("\n"))}>排序</button>
        <button type="button" onClick={() => setOutput(lines.filter(Boolean).join("\n"))}>清理空行</button>
        <button type="button" onClick={() => setOutput(input.toUpperCase())}>大写</button>
        <button type="button" onClick={() => setOutput(input.toLowerCase())}>小写</button>
        <button type="button" onClick={() => setOutput(slugify(input))}>Slug</button>
        <button type="button" onClick={() => copyText(output)}>复制</button>
      </div>
      <Output value={output || "选择一个处理动作后显示结果。"} />
    </ToolShell>
  );
}

export function QrTool() {
  const [input, setInput] = useState("https://example.com");
  const [level, setLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [dark, setDark] = useState("#111827");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(input || " ", {
      errorCorrectionLevel: level,
      margin: 2,
      scale: 8,
      color: { dark, light: "#FFFFFF" },
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
  }, [dark, input, level]);

  return (
    <ToolShell title="二维码" note="离线生成二维码，可调整纠错等级和颜色。">
      <Field label="文本或链接">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <div className="split">
        <Field label="纠错等级">
          <select value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>
            <option value="L">L - 更密集内容</option>
            <option value="M">M - 常用</option>
            <option value="Q">Q - 更强容错</option>
            <option value="H">H - 最高容错</option>
          </select>
        </Field>
        <Field label="深色">
          <input value={dark} onChange={(event) => setDark(event.target.value)} />
        </Field>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {dataUrl ? <img className="qr-image" src={dataUrl} alt="生成的二维码" /> : null}
      <div className="button-row">
        <button type="button" onClick={() => copyText(input)}>复制原文</button>
        <a className="download-link" href={dataUrl} download="swiftbox-qrcode.png">下载 PNG</a>
      </div>
    </ToolShell>
  );
}

export function LoremTool() {
  const [paragraphs, setParagraphs] = useState(2);
  const [tone, setTone] = useState<"product" | "office" | "design">("product");
  const sentences = {
    product: ["用户可以更快找到常用工具。", "每个操作都在本地完成。", "收藏和最近使用会减少重复查找。", "结果可直接复制给团队成员。"],
    office: ["请确认信息无误后再发送。", "本次内容仅用于内部协作。", "如需调整，请在今天下班前反馈。", "相关附件会同步更新。"],
    design: ["界面保持清晰的层级和充足留白。", "颜色用于表达状态，而不是装饰。", "每个模块只承担一个主要任务。", "文案需要短、准、可操作。"],
  };
  const output = Array.from({ length: paragraphs }, (_, index) => `${index + 1}. ${sentences[tone].join("")}`).join("\n\n");

  return (
    <ToolShell title="占位文案" note="生成更接近产品、办公和设计场景的占位文本。">
      <div className="split">
        <Field label="段落数">
          <input type="number" min="1" max="8" value={paragraphs} onChange={(event) => setParagraphs(Number(event.target.value))} />
        </Field>
        <Field label="语气">
          <select value={tone} onChange={(event) => setTone(event.target.value as typeof tone)}>
            <option value="product">产品</option>
            <option value="office">办公</option>
            <option value="design">设计</option>
          </select>
        </Field>
      </div>
      <button type="button" onClick={() => copyText(output)}>复制文案</button>
      <Output value={output} />
    </ToolShell>
  );
}
