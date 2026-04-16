import { useMemo, useState } from "react";
import { copyText, Field, MetricStrip, Output, StatusPill, ToolSection, ToolShell } from "./shared";

function toCsv(rows: Array<Record<string, string | number>>) {
  const headers = Object.keys(rows[0] ?? {});
  return [headers.join(","), ...rows.map((row) => headers.map((key) => row[key]).join(","))].join("\n");
}

export function RegexTool() {
  const [pattern, setPattern] = useState("\\b\\w+Box\\b");
  const [flags, setFlags] = useState("gi");
  const [replacement, setReplacement] = useState("ToolBox");
  const [text, setText] = useState("SwiftBox 是一个桌面工具箱。swiftbox tools.");
  const result = useMemo(() => {
    try {
      const normalizedFlags = flags.includes("g") ? flags : `${flags}g`;
      const regexp = new RegExp(pattern, normalizedFlags);
      const matches = Array.from(text.matchAll(regexp));
      const replaced = text.replace(regexp, replacement);
      return { ok: true as const, matches, replaced };
    } catch (error) {
      return { ok: false as const, message: String(error) };
    }
  }, [flags, pattern, replacement, text]);
  const output = result.ok
    ? result.matches.length
      ? result.matches
          .map((match, index) => {
            const groups = match.slice(1).map((group, groupIndex) => `  $${groupIndex + 1}: ${group ?? ""}`).join("\n");
            return `${index + 1}. ${match[0]} @ ${match.index ?? 0}${groups ? `\n${groups}` : ""}`;
          })
          .join("\n")
      : "没有匹配结果"
    : `正则错误：${result.message}`;

  return (
    <ToolShell title="正则测试" note="查看匹配位置、捕获组和替换预览。">
      <div className="split">
        <Field label="Pattern">
          <input value={pattern} onChange={(event) => setPattern(event.target.value)} />
        </Field>
        <Field label="Flags">
          <input value={flags} onChange={(event) => setFlags(event.target.value)} />
        </Field>
      </div>
      <Field label="Replacement">
        <input value={replacement} onChange={(event) => setReplacement(event.target.value)} />
      </Field>
      <Field label="测试文本">
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      </Field>
      <div className="button-row">
        <StatusPill tone={result.ok ? "success" : "danger"}>{result.ok ? "表达式有效" : "表达式错误"}</StatusPill>
        <button type="button" onClick={() => copyText(output)}>复制匹配</button>
        {result.ok ? <button type="button" onClick={() => copyText(result.replaced)}>复制替换结果</button> : null}
      </div>
      <div className="split">
        <ToolSection title="匹配结果">
          <Output value={output} />
        </ToolSection>
        <ToolSection title="替换预览">
          <Output value={result.ok ? result.replaced : ""} />
        </ToolSection>
      </div>
    </ToolShell>
  );
}

export function MockDataTool() {
  const [count, setCount] = useState(8);
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [nonce, setNonce] = useState(0);
  const names = ["陈一", "林夏", "Alex Chen", "Mia Wang", "Noah Li", "Iris Zhao", "Ken Wu"];
  const cities = ["上海市徐汇区", "杭州市西湖区", "深圳市南山区", "北京市朝阳区", "成都市高新区"];
  const rows = useMemo(
    () => {
      void nonce;
      return Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        name: names[index % names.length],
        phone: `13${Math.floor(100000000 + Math.random() * 899999999)}`,
        email: `user${index + 1}@example.com`,
        address: cities[index % cities.length],
        score: Math.floor(60 + Math.random() * 40),
        createdAt: new Date(Date.now() - index * 86400000).toISOString(),
      }));
    },
    [count, nonce],
  );
  const output = format === "json" ? JSON.stringify(rows, null, 2) : toCsv(rows);

  return (
    <ToolShell title="Mock 数据" note="按数量生成测试样例，可导出 JSON 或 CSV。">
      <div className="split">
        <Field label="数量">
          <input type="number" min="1" max="100" value={count} onChange={(event) => setCount(Number(event.target.value))} />
        </Field>
        <Field label="格式">
          <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </Field>
      </div>
      <div className="button-row">
        <button type="button" onClick={() => setNonce((value) => value + 1)}>重新生成</button>
        <button type="button" onClick={() => copyText(output)}>复制结果</button>
      </div>
      <MetricStrip
        items={[
          { label: "行数", value: rows.length },
          { label: "字段", value: Object.keys(rows[0] ?? {}).length },
          { label: "格式", value: format.toUpperCase() },
        ]}
      />
      <Output value={output} />
    </ToolShell>
  );
}

export function DiffTool() {
  const [left, setLeft] = useState("alpha\nbeta\ngamma");
  const [right, setRight] = useState("alpha\nbeta changed\ngamma\ndelta");
  const result = useMemo(() => {
    const leftLines = left.split(/\r?\n/);
    const rightLines = right.split(/\r?\n/);
    const max = Math.max(leftLines.length, rightLines.length);
    let added = 0;
    let removed = 0;
    let changed = 0;
    const output = Array.from({ length: max }, (_, index) => {
      const oldLine = leftLines[index];
      const newLine = rightLines[index];
      if (oldLine === newLine) return `  ${oldLine ?? ""}`;
      if (oldLine === undefined) {
        added += 1;
        return `+ ${newLine}`;
      }
      if (newLine === undefined) {
        removed += 1;
        return `- ${oldLine}`;
      }
      changed += 1;
      return `- ${oldLine}\n+ ${newLine}`;
    }).join("\n");
    return { output, added, removed, changed };
  }, [left, right]);

  return (
    <ToolShell title="文本 Diff" note="按行比较两段文本，输出可复制的补丁式结果。">
      <div className="split">
        <Field label="旧文本">
          <textarea value={left} onChange={(event) => setLeft(event.target.value)} />
        </Field>
        <Field label="新文本">
          <textarea value={right} onChange={(event) => setRight(event.target.value)} />
        </Field>
      </div>
      <MetricStrip
        items={[
          { label: "新增", value: result.added },
          { label: "删除", value: result.removed },
          { label: "变更", value: result.changed },
        ]}
      />
      <button type="button" onClick={() => copyText(result.output)}>复制 Diff</button>
      <Output value={result.output} />
    </ToolShell>
  );
}
