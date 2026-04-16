import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { copyText, Field, MetricStrip, Output, ToolSection, ToolShell, CopyButton, InlineError, ResultViewer, ToolPanel, ToolTabs, ToolWorkspace } from "./ui";

type TextActionTab = "cleanup" | "lines" | "case" | "format";
type CsvMode = "csv-to-json" | "json-to-csv";
type CsvDelimiter = "," | ";" | "\t";

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

function parseCsvRows(input: string, delimiter: CsvDelimiter = ",") {
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
    if (char === delimiter && !quoted) {
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

function joinCsvRow(values: unknown[], delimiter: CsvDelimiter) {
  return values.map(csvEscape).join(delimiter);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sentenceCase(value: string) {
  return value.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (match) => match.toUpperCase());
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b[\p{L}\p{N}]/gu, (match) => match.toUpperCase());
}

function linesToJsonArray(lines: string[]) {
  return JSON.stringify(lines.filter((line) => line.trim()).map((line) => line.trim()), null, 2);
}

function linesToCsv(lines: string[]) {
  return lines.filter((line) => line.trim()).map((line) => `"${line.replace(/"/g, '""')}"`).join("\n");
}

export function CsvJsonTool() {
  const [input, setInput] = useState("name,role\nAlex,Designer\nMia,Frontend");
  const [mode, setMode] = useState<CsvMode>("csv-to-json");
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const csvStats = useMemo(() => {
    const rows = parseCsvRows(input, delimiter);
    return { rows: Math.max(0, rows.length - 1), columns: rows[0]?.length ?? 0 };
  }, [delimiter, input]);

  const result = useMemo(() => {
    if (mode === "csv-to-json") {
      const rows = parseCsvRows(input, delimiter);
      const [headers, ...items] = rows;
      if (!headers?.length) return { ok: false as const, message: "CSV 至少需要一行表头" };
      return {
        ok: true as const,
        value: JSON.stringify(items.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))), null, 2),
        previewRows: rows.slice(0, 6),
      };
    }
    try {
      const parsed = JSON.parse(input) as unknown;
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const objects = rows.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
      const headers = Array.from(new Set(objects.flatMap((item) => Object.keys(item))));
      if (!headers.length) return { ok: false as const, message: "JSON 需要对象或对象数组" };
      const value = [joinCsvRow(headers, delimiter), ...objects.map((item) => joinCsvRow(headers.map((header) => item[header]), delimiter))].join("\n");
      return { ok: true as const, value, previewRows: [headers, ...objects.slice(0, 5).map((item) => headers.map((header) => String(item[header] ?? "")))] };
    } catch (error) {
      return { ok: false as const, message: `JSON 转 CSV 失败：${String(error)}` };
    }
  }, [delimiter, input, mode]);

  return (
    <ToolWorkspace
      title="CSV / JSON"
      description="表格数据与 JSON 对象数组互转，支持分隔符和预览。"
      actions={<CopyButton value={result.ok ? result.value : ""} disabled={!result.ok}>复制结果</CopyButton>}
      meta={
        <>
          <span>{csvStats.rows} CSV 行</span>
          <span>{csvStats.columns} CSV 列</span>
          <span>{input.length} 字符</span>
        </>
      }
    >
      <ToolPanel
        title="转换设置"
        description="CSV 转 JSON 使用首行作为字段名。"
        action={
          <ToolTabs
            active={mode}
            onChange={(value) => setMode(value as CsvMode)}
            tabs={[
              { id: "csv-to-json", label: "CSV to JSON" },
              { id: "json-to-csv", label: "JSON to CSV" },
            ]}
          />
        }
      >
        <div className="split">
          <Field label="分隔符">
            <select value={delimiter} onChange={(event) => setDelimiter(event.target.value as CsvDelimiter)}>
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
              <option value={"	"}>Tab</option>
            </select>
          </Field>
          <Field label={mode === "csv-to-json" ? "CSV" : "JSON"}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />
          </Field>
        </div>
      </ToolPanel>
      <MetricStrip
        items={[
          { label: "CSV 行", value: csvStats.rows },
          { label: "CSV 列", value: csvStats.columns },
          { label: "输入字符", value: input.length },
        ]}
      />
      {result.ok ? (
        <ToolPanel title="预览" description="最多展示前 6 行。">
          <div className="data-preview-table">
            {result.previewRows.map((row, rowIndex) => (
              <div key={`${rowIndex}-${row.join("-")}`} className="data-preview-row">
                {row.map((cell, cellIndex) => (
                  <span key={`${cellIndex}-${cell}`}>{cell}</span>
                ))}
              </div>
            ))}
          </div>
        </ToolPanel>
      ) : null}
      {result.ok ? <ResultViewer title="转换结果" value={result.value} /> : <InlineError message={result.message} />}
    </ToolWorkspace>
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
  const [tab, setTab] = useState<TextActionTab>("cleanup");
  const [output, setOutput] = useState("");
  const lines = input.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim());
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  const duplicateCount = lines.length - new Set(lines).size;

  return (
    <ToolWorkspace
      title="文本处理"
      description="清理、行处理、大小写转换和格式转换，结果可回填继续处理。"
      actions={<CopyButton value={output} disabled={!output}>复制结果</CopyButton>}
      meta={
        <>
          <span>{input.length} 字符</span>
          <span>{lines.length} 行</span>
          <span>{words} 单词</span>
        </>
      }
    >
      <MetricStrip
        items={[
          { label: "字符", value: input.length },
          { label: "单词", value: words },
          { label: "行", value: lines.length },
          { label: "非空行", value: nonEmptyLines.length },
          { label: "重复行", value: duplicateCount },
        ]}
      />
      <Field label="文本">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <ToolPanel
        title="处理动作"
        description="先选择动作组，再点击需要的处理方式。"
        action={
          <ToolTabs
            active={tab}
            onChange={(value) => setTab(value as TextActionTab)}
            tabs={[
              { id: "cleanup", label: "Cleanup" },
              { id: "lines", label: "Lines" },
              { id: "case", label: "Case" },
              { id: "format", label: "Format" },
            ]}
          />
        }
      >
        <div className="text-action-grid">
          {tab === "cleanup" ? (
            <>
              <button type="button" onClick={() => setOutput(nonEmptyLines.join("\n"))}>清理空行</button>
              <button type="button" onClick={() => setOutput(input.replace(/[ \t]+$/gm, ""))}>去行尾空格</button>
              <button type="button" onClick={() => setOutput(input.replace(/\s+/g, " ").trim())}>压缩空白</button>
              <button type="button" onClick={() => setOutput(input.trim())}>Trim 首尾</button>
            </>
          ) : null}
          {tab === "lines" ? (
            <>
              <button type="button" onClick={() => setOutput(Array.from(new Set(lines)).join("\n"))}>去重</button>
              <button type="button" onClick={() => setOutput([...lines].sort((a, b) => a.localeCompare(b)).join("\n"))}>A-Z 排序</button>
              <button type="button" onClick={() => setOutput([...lines].sort((a, b) => b.localeCompare(a)).join("\n"))}>Z-A 排序</button>
              <button type="button" onClick={() => setOutput([...lines].reverse().join("\n"))}>反转行</button>
            </>
          ) : null}
          {tab === "case" ? (
            <>
              <button type="button" onClick={() => setOutput(input.toUpperCase())}>UPPERCASE</button>
              <button type="button" onClick={() => setOutput(input.toLowerCase())}>lowercase</button>
              <button type="button" onClick={() => setOutput(sentenceCase(input))}>Sentence case</button>
              <button type="button" onClick={() => setOutput(titleCase(input))}>Title Case</button>
            </>
          ) : null}
          {tab === "format" ? (
            <>
              <button type="button" onClick={() => setOutput(slugify(input))}>Slug</button>
              <button type="button" onClick={() => setOutput(linesToJsonArray(lines))}>行转 JSON Array</button>
              <button type="button" onClick={() => setOutput(linesToCsv(lines))}>行转 CSV 单列</button>
              <button type="button" onClick={() => setOutput(nonEmptyLines.map((line) => `- ${line}`).join("\n"))}>转 Markdown 列表</button>
            </>
          ) : null}
        </div>
      </ToolPanel>
      <div className="button-row">
        <button type="button" onClick={() => setInput(output)} disabled={!output}>结果回填到输入</button>
        <button type="button" onClick={() => setOutput("")} disabled={!output}>清空结果</button>
      </div>
      <ResultViewer title="处理结果" value={output} empty="选择一个处理动作后显示结果。" />
    </ToolWorkspace>
  );
}

export function QrTool() {
  const [input, setInput] = useState("https://example.com");
  const [level, setLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [dark, setDark] = useState("#111827");
  const [light, setLight] = useState("#FFFFFF");
  const [size, setSize] = useState(8);
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(input || " ", {
      errorCorrectionLevel: level,
      margin: 2,
      scale: size,
      color: { dark, light },
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
  }, [dark, input, level, light, size]);

  return (
    <ToolWorkspace
      title="二维码"
      description="离线生成二维码，可调整纠错等级、颜色和 PNG 尺寸。"
      actions={<CopyButton value={input}>复制原文</CopyButton>}
      meta={
        <>
          <span>{input.length} 字符</span>
          <span>纠错 {level}</span>
          <span>{size}x scale</span>
        </>
      }
    >
      <Field label="文本或链接">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <div className="split align-start">
        <Field label="纠错等级">
          <select value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>
            <option value="L">L - 7%</option>
            <option value="M">M - 15%</option>
            <option value="Q">Q - 25%</option>
            <option value="H">H - 30%</option>
          </select>
        </Field>
        <Field label="深色">
          <input value={dark} onChange={(event) => setDark(event.target.value)} />
        </Field>
        <Field label="浅色">
          <input value={light} onChange={(event) => setLight(event.target.value)} />
        </Field>
        <Field label="PNG Scale">
          <input type="number" min="4" max="16" value={size} onChange={(event) => setSize(Number(event.target.value))} />
        </Field>
      </div>
      {error ? <InlineError message={error} /> : null}
      <ToolPanel title="预览" description="纠错等级越高越抗遮挡，但图案会更密。">
        {dataUrl ? <img className="qr-image" src={dataUrl} alt="生成的二维码" /> : null}
      </ToolPanel>
      <div className="button-row">
        <a className="download-link" href={dataUrl} download="swiftbox-qrcode.png">下载 PNG</a>
      </div>
    </ToolWorkspace>
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
