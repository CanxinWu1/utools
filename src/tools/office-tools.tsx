import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { copyText, Field, MetricStrip, Output, ToolSection, ToolShell, CopyButton, InlineError, ResultViewer, ToolPanel, ToolTabs, ToolWorkspace } from "./ui";

type TextActionTab = "cleanup" | "lines" | "case" | "format";
type CsvMode = "csv-to-json" | "json-to-csv";
type CsvDelimiter = "," | ";" | "\t";
type SnippetTone = "formal" | "support" | "sales" | "internal";
type EmailTone = "neutral" | "friendly" | "firm";
type PriorityQuadrant = "do" | "schedule" | "delegate" | "drop";

type Snippet = {
  trigger: string;
  title: string;
  body: string;
  tone: SnippetTone;
};

type PriorityTask = {
  title: string;
  importance: number;
  urgency: number;
  owner: string;
};

const snippetStorageKey = "swiftbox.office.snippets";

const defaultSnippets: Snippet[] = [
  {
    trigger: ";meeting",
    title: "会议跟进",
    tone: "internal",
    body: "大家好，\n\n同步一下本次会议结论：\n1. {{decision}}\n2. {{action}}\n\n负责人：{{owner}}\n截止时间：{{date}}\n\n如有遗漏请直接补充。",
  },
  {
    trigger: ";delay",
    title: "进度延期说明",
    tone: "formal",
    body: "您好，\n\n由于 {{reason}}，原计划在 {{date}} 完成的事项需要顺延。当前最新预计完成时间为 {{newDate}}。\n\n我会在推进过程中持续同步关键进展，感谢理解。",
  },
  {
    trigger: ";support",
    title: "客服排查回复",
    tone: "support",
    body: "您好，已收到您的反馈。\n\n为了更快定位问题，请补充以下信息：\n- 发生时间：\n- 操作路径：\n- 截图或录屏：\n- 账号或环境：\n\n我们会尽快跟进处理。",
  },
];

function loadSnippets() {
  try {
    const saved = window.localStorage.getItem(snippetStorageKey);
    if (!saved) return defaultSnippets;
    const parsed = JSON.parse(saved) as Snippet[];
    return Array.isArray(parsed) && parsed.length ? parsed : defaultSnippets;
  } catch {
    return defaultSnippets;
  }
}

function applySnippetVariables(body: string, variables: Record<string, string>) {
  return body.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, key: string) => {
    if (variables[key]) return variables[key];
    if (key === "date") return new Date().toISOString().slice(0, 10);
    return `{{${key}}}`;
  });
}

function extractTemplateVariables(body: string) {
  return Array.from(new Set(Array.from(body.matchAll(/\{\{\s*([\w-]+)\s*\}\}/g)).map((match) => match[1])));
}

function summarizeMeetingLine(line: string) {
  return line
    .replace(/^(结论|决定|decision|todo|待办|action|风险|risk|问题|issue)[:：\-\s]*/i, "")
    .trim();
}

function buildMeetingNotes(input: string, options: { title: string; date: string; attendees: string }) {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const decisions = lines.filter((line) => /^(结论|决定|decision)|决定|确认|采用|不做/i.test(line)).map(summarizeMeetingLine);
  const actions = lines.filter((line) => /^(todo|待办|action)|负责人|截止|跟进|处理|完成/i.test(line)).map(summarizeMeetingLine);
  const risks = lines.filter((line) => /^(风险|risk|问题|issue)|阻塞|依赖|延期|争议/i.test(line)).map(summarizeMeetingLine);
  const summary = lines
    .filter((line) => {
      const normalized = summarizeMeetingLine(line);
      return !decisions.includes(normalized) && !actions.includes(normalized) && !risks.includes(normalized);
    })
    .slice(0, 5);

  const section = (heading: string, items: string[], empty: string) => [
    `## ${heading}`,
    ...(items.length ? items.map((item) => `- ${item}`) : [`- ${empty}`]),
  ].join("\n");

  return [
    `# ${options.title || "会议纪要"}`,
    "",
    `- 日期：${options.date}`,
    `- 参会人：${options.attendees || "待补充"}`,
    "",
    section("摘要", summary, "待补充会议背景和核心讨论。"),
    "",
    section("决策", decisions, "暂无明确决策。"),
    "",
    section("行动项", actions, "暂无行动项。"),
    "",
    section("风险 / 问题", risks, "暂无风险或阻塞。"),
  ].join("\n");
}

function emailGreeting(tone: EmailTone) {
  if (tone === "friendly") return "你好，";
  if (tone === "firm") return "您好，";
  return "您好，";
}

function buildEmailDraft(options: {
  scene: string;
  tone: EmailTone;
  recipient: string;
  goal: string;
  context: string;
  action: string;
  deadline: string;
}) {
  const greeting = emailGreeting(options.tone);
  const signoff = options.tone === "friendly" ? "谢谢，辛苦了。" : options.tone === "firm" ? "请按上述安排推进，谢谢。" : "感谢配合。";
  const opener = options.scene === "follow-up"
    ? "跟进一下前面沟通的事项。"
    : options.scene === "request"
      ? "这边需要你协助确认一件事。"
      : options.scene === "apology"
        ? "先说明一下当前进展中的变更。"
        : "同步一下当前事项的最新情况。";

  const lines = [`${options.recipient || greeting}`, "", opener];
  if (options.goal) lines.push(`本次目标：${options.goal}`);
  if (options.context) lines.push(`背景信息：${options.context}`);
  if (options.action) lines.push(`需要动作：${options.action}`);
  if (options.deadline) lines.push(`期望时间：${options.deadline}`);
  lines.push("", signoff);
  return lines.join("\n");
}

function parsePriorityTasks(input: string): PriorityTask[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title = "", importance = "3", urgency = "3", owner = ""] = line.split("|").map((item) => item.trim());
      return {
        title,
        importance: Math.min(5, Math.max(1, Number(importance) || 3)),
        urgency: Math.min(5, Math.max(1, Number(urgency) || 3)),
        owner,
      };
    });
}

function getPriorityQuadrant(task: PriorityTask): PriorityQuadrant {
  if (task.importance >= 4 && task.urgency >= 4) return "do";
  if (task.importance >= 4) return "schedule";
  if (task.urgency >= 4) return "delegate";
  return "drop";
}

function formatPriorityPlan(tasks: PriorityTask[]) {
  const labels: Record<PriorityQuadrant, string> = {
    do: "立即处理",
    schedule: "安排时间",
    delegate: "委派或批处理",
    drop: "暂缓 / 删除",
  };
  const quadrants: Record<PriorityQuadrant, PriorityTask[]> = {
    do: [],
    schedule: [],
    delegate: [],
    drop: [],
  };

  tasks.forEach((task) => {
    quadrants[getPriorityQuadrant(task)].push(task);
  });

  return (Object.keys(labels) as PriorityQuadrant[]).map((key) => [
    `## ${labels[key]}`,
    ...(quadrants[key].length
      ? quadrants[key].map((task) => `- ${task.title}${task.owner ? `（${task.owner}）` : ""} · 重要 ${task.importance} / 紧急 ${task.urgency}`)
      : ["- 暂无"]),
  ].join("\n")).join("\n\n");
}

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

export function SnippetExpanderTool() {
  const [snippets, setSnippets] = useState<Snippet[]>(loadSnippets);
  const [activeIndex, setActiveIndex] = useState(0);
  const [variables, setVariables] = useState<Record<string, string>>({
    decision: "采用新的审批模板",
    action: "本周五前完成第一版",
    owner: "产品组",
  });

  const activeSnippet = snippets[activeIndex] ?? snippets[0] ?? defaultSnippets[0];
  const variableKeys = useMemo(() => extractTemplateVariables(activeSnippet.body), [activeSnippet.body]);
  const output = useMemo(() => applySnippetVariables(activeSnippet.body, variables), [activeSnippet.body, variables]);

  useEffect(() => {
    window.localStorage.setItem(snippetStorageKey, JSON.stringify(snippets));
  }, [snippets]);

  function updateSnippet(patch: Partial<Snippet>) {
    setSnippets((items) => items.map((item, index) => (index === activeIndex ? { ...item, ...patch } : item)));
  }

  function addSnippet() {
    setSnippets((items) => {
      const next = [...items, { trigger: ";new", title: "新片段", tone: "internal" as const, body: "您好，\n\n{{content}}\n\n谢谢。" }];
      setActiveIndex(next.length - 1);
      return next;
    });
  }

  function resetSnippets() {
    setSnippets(defaultSnippets);
    setActiveIndex(0);
  }

  return (
    <ToolWorkspace
      title="文本片段"
      description="整理高频办公话术，支持触发词、模板变量和一键复制。"
      actions={<CopyButton value={output}>复制展开文本</CopyButton>}
      meta={
        <>
          <span>{snippets.length} 个片段</span>
          <span>{variableKeys.length} 个变量</span>
          <span>{activeSnippet.tone}</span>
        </>
      }
    >
      <div className="split align-start">
        <ToolPanel title="片段库" description="适合沉淀邮件回复、客服话术和会议跟进模板。">
          <Field label="当前片段">
            <select value={activeIndex} onChange={(event) => setActiveIndex(Number(event.target.value))}>
              {snippets.map((snippet, index) => (
                <option key={`${snippet.trigger}-${index}`} value={index}>{snippet.trigger} · {snippet.title}</option>
              ))}
            </select>
          </Field>
          <div className="split">
            <Field label="触发词">
              <input value={activeSnippet.trigger} onChange={(event) => updateSnippet({ trigger: event.target.value })} />
            </Field>
            <Field label="语气">
              <select value={activeSnippet.tone} onChange={(event) => updateSnippet({ tone: event.target.value as SnippetTone })}>
                <option value="formal">正式</option>
                <option value="support">客服</option>
                <option value="sales">销售</option>
                <option value="internal">内部协作</option>
              </select>
            </Field>
          </div>
          <Field label="标题">
            <input value={activeSnippet.title} onChange={(event) => updateSnippet({ title: event.target.value })} />
          </Field>
          <Field label="模板正文">
            <textarea value={activeSnippet.body} onChange={(event) => updateSnippet({ body: event.target.value })} />
          </Field>
          <div className="button-row">
            <button type="button" onClick={addSnippet}>新增片段</button>
            <button type="button" onClick={resetSnippets}>恢复示例</button>
          </div>
        </ToolPanel>
        <ToolPanel title="变量" description="正文中的 {{变量名}} 会在输出里替换。">
          {variableKeys.length ? (
            variableKeys.map((key) => (
              <Field key={key} label={key}>
                <input value={variables[key] ?? ""} onChange={(event) => setVariables((current) => ({ ...current, [key]: event.target.value }))} />
              </Field>
            ))
          ) : (
            <p className="muted-text">当前模板没有变量。</p>
          )}
        </ToolPanel>
      </div>
      <ResultViewer title="展开结果" value={output} />
    </ToolWorkspace>
  );
}

export function MeetingNotesTool() {
  const [title, setTitle] = useState("项目周会纪要");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState("产品、设计、前端、后端");
  const [input, setInput] = useState("决定：本周先上线审批流第一阶段\n待办：前端周三前补齐空状态，负责人 Alex\n风险：测试环境数据不稳定，可能影响验收\n讨论了导出功能的权限边界");
  const output = useMemo(() => buildMeetingNotes(input, { title, date, attendees }), [attendees, date, input, title]);
  const actionCount = output.match(/^- /gm)?.length ?? 0;

  return (
    <ToolWorkspace
      title="会议纪要整理"
      description="把会议速记整理为摘要、决策、行动项和风险，适合会后快速同步。"
      actions={<CopyButton value={output}>复制纪要</CopyButton>}
      meta={
        <>
          <span>{input.split(/\r?\n/).filter(Boolean).length} 条速记</span>
          <span>{actionCount} 条输出</span>
        </>
      }
    >
      <div className="split">
        <Field label="会议标题">
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="日期">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <Field label="参会人">
        <input value={attendees} onChange={(event) => setAttendees(event.target.value)} />
      </Field>
      <Field label="会议速记">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} />
      </Field>
      <ResultViewer title="Markdown 纪要" value={output} />
    </ToolWorkspace>
  );
}

export function EmailDraftTool() {
  const [scene, setScene] = useState("follow-up");
  const [tone, setTone] = useState<EmailTone>("neutral");
  const [recipient, setRecipient] = useState("Hi Alex,");
  const [goal, setGoal] = useState("确认本周上线范围和验收安排");
  const [context, setContext] = useState("审批流第一阶段已完成开发，仍有两处文案需要产品确认。");
  const [action, setAction] = useState("请在今天 18:00 前确认文案和验收人。");
  const [deadline, setDeadline] = useState("今天 18:00");
  const output = useMemo(() => buildEmailDraft({ scene, tone, recipient, goal, context, action, deadline }), [action, context, deadline, goal, recipient, scene, tone]);

  return (
    <ToolWorkspace
      title="邮件草稿"
      description="根据场景、语气和关键事实生成可复制的办公邮件初稿。"
      actions={<CopyButton value={output}>复制邮件</CopyButton>}
      meta={
        <>
          <span>{tone}</span>
          <span>{output.length} 字符</span>
        </>
      }
    >
      <ToolPanel title="写作设置" description="保留事实输入，避免在正文里混入无关铺垫。">
        <div className="split">
          <Field label="场景">
            <select value={scene} onChange={(event) => setScene(event.target.value)}>
              <option value="follow-up">跟进事项</option>
              <option value="request">请求协助</option>
              <option value="apology">延期说明</option>
              <option value="sync">进度同步</option>
            </select>
          </Field>
          <Field label="语气">
            <select value={tone} onChange={(event) => setTone(event.target.value as EmailTone)}>
              <option value="neutral">中性</option>
              <option value="friendly">友好</option>
              <option value="firm">明确</option>
            </select>
          </Field>
        </div>
        <Field label="称呼">
          <input value={recipient} onChange={(event) => setRecipient(event.target.value)} />
        </Field>
        <Field label="目标">
          <input value={goal} onChange={(event) => setGoal(event.target.value)} />
        </Field>
        <Field label="背景">
          <textarea value={context} onChange={(event) => setContext(event.target.value)} />
        </Field>
        <div className="split">
          <Field label="需要动作">
            <textarea value={action} onChange={(event) => setAction(event.target.value)} />
          </Field>
          <Field label="期望时间">
            <input value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </Field>
        </div>
      </ToolPanel>
      <ResultViewer title="邮件草稿" value={output} />
    </ToolWorkspace>
  );
}

export function PriorityMatrixTool() {
  const [input, setInput] = useState("修复线上导出失败 | 5 | 5 | Alex\n整理下月选题池 | 4 | 2 | Mia\n回复供应商报价 | 2 | 5 | Ops\n清理旧会议文档 | 2 | 2 | Team");
  const tasks = useMemo(() => parsePriorityTasks(input), [input]);
  const output = useMemo(() => formatPriorityPlan(tasks), [tasks]);
  const doNow = tasks.filter((task) => getPriorityQuadrant(task) === "do").length;

  return (
    <ToolWorkspace
      title="优先级矩阵"
      description="按重要度和紧急度把待办拆到立即处理、安排时间、委派和暂缓。"
      actions={<CopyButton value={output}>复制计划</CopyButton>}
      meta={
        <>
          <span>{tasks.length} 个任务</span>
          <span>{doNow} 个立即处理</span>
        </>
      }
    >
      <ToolPanel title="任务输入" description="每行格式：任务 | 重要度 1-5 | 紧急度 1-5 | 负责人。">
        <Field label="待办列表">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} />
        </Field>
      </ToolPanel>
      <MetricStrip
        items={[
          { label: "任务数", value: tasks.length },
          { label: "立即处理", value: doNow },
          { label: "平均重要度", value: tasks.length ? (tasks.reduce((sum, task) => sum + task.importance, 0) / tasks.length).toFixed(1) : "0" },
          { label: "平均紧急度", value: tasks.length ? (tasks.reduce((sum, task) => sum + task.urgency, 0) / tasks.length).toFixed(1) : "0" },
        ]}
      />
      <ResultViewer title="优先级计划" value={output} />
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
