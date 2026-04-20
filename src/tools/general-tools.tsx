import { useMemo, useState } from "react";
import { CopyButton, Field, MetricStrip, ResultViewer, StatusBadge, ToolPanel, ToolTabs, ToolWorkspace } from "./ui";

type EntityMode = "encode" | "decode";

function safeCalculate(input: string) {
  const normalized = input.trim();
  if (!normalized) return { ok: false as const, message: "请输入算式，例如 (2 + 3) * 4" };
  if (!/^[0-9+\-*/%().\s,^]+$/.test(normalized)) {
    return { ok: false as const, message: "算式包含不支持的字符" };
  }
  const prepared = normalized.replace(/\^/g, "**");
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${prepared});`)();
    if (typeof result !== "number" || Number.isNaN(result) || !Number.isFinite(result)) {
      return { ok: false as const, message: "计算结果不是有限数字" };
    }
    return { ok: true as const, value: result };
  } catch (error) {
    return { ok: false as const, message: `计算失败：${String(error)}` };
  }
}

function entropyScore(length: number, alphabetSize: number) {
  if (!length || !alphabetSize) return 0;
  return Math.round(length * Math.log2(alphabetSize));
}

function strengthLabel(bits: number) {
  if (bits >= 80) return "很强";
  if (bits >= 60) return "较强";
  if (bits >= 40) return "一般";
  return "偏弱";
}

function generatePassword(length: number, options: { lower: boolean; upper: boolean; numbers: boolean; symbols: boolean }) {
  const sets = [] as string[];
  if (options.lower) sets.push("abcdefghijklmnopqrstuvwxyz");
  if (options.upper) sets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  if (options.numbers) sets.push("0123456789");
  if (options.symbols) sets.push("!@#$%^&*()-_=+[]{};:,.?/|~");
  const alphabet = sets.join("");
  if (!alphabet) return { ok: false as const, message: "至少选择一种字符集" };
  const chars = Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return { ok: true as const, value: chars, alphabetSize: alphabet.length };
}

function encodeHtmlEntities(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtmlEntities(input: string) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = input;
  return textarea.value;
}

function prettyXml(input: string) {
  const parser = new DOMParser();
  const documentElement = parser.parseFromString(input, "application/xml");
  const parserError = documentElement.querySelector("parsererror");
  if (parserError) {
    return { ok: false as const, message: parserError.textContent || "XML 解析失败" };
  }

  const serializer = new XMLSerializer();
  const formatNode = (node: ChildNode, indent = 0): string => {
    const pad = "  ".repeat(indent);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      return text ? `${pad}${text}` : "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as Element;
    const attrs = Array.from(element.attributes).map((attr) => `${attr.name}="${attr.value}"`).join(" ");
    const openTag = attrs ? `<${element.tagName} ${attrs}>` : `<${element.tagName}>`;
    const children = Array.from(element.childNodes)
      .map((child) => formatNode(child, indent + 1))
      .filter(Boolean);

    if (!children.length) {
      return `${pad}${openTag.replace(/>$/, " />")}`;
    }

    return [
      `${pad}${openTag}`,
      ...children,
      `${pad}</${element.tagName}>`,
    ].join("\n");
  };

  const root = documentElement.documentElement;
  return { ok: true as const, value: formatNode(root), raw: serializer.serializeToString(documentElement) };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function words(value: string) {
  return value
    .trim()
    .replace(/[\-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function toPascalCase(value: string) {
  return words(value)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function toCamelCase(value: string) {
  const pascal = toPascalCase(value);
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "";
}

function toSnakeCase(value: string) {
  return words(value)
    .map((word) => word.toLowerCase())
    .join("_");
}

function toKebabCase(value: string) {
  return words(value)
    .map((word) => word.toLowerCase())
    .join("-");
}

function toTitleCase(value: string) {
  return words(value)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function parseLocalDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

const commonTimeZones = [
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export function CalculatorTool() {
  const [expression, setExpression] = useState("(2 + 3) * 4");
  const result = safeCalculate(expression);
  const output = result.ok ? `${expression} = ${result.value}` : result.message;

  return (
    <ToolWorkspace
      title="计算器"
      description="快速计算常见算式，支持括号、四则运算和幂运算。"
      actions={<CopyButton value={output} disabled={!result.ok}>复制结果</CopyButton>}
      meta={
        <>
          <StatusBadge tone={result.ok ? "success" : "danger"}>{result.ok ? "可计算" : "表达式错误"}</StatusBadge>
          <span>{expression.length} 字符</span>
        </>
      }
    >
      <Field label="算式">
        <input value={expression} onChange={(event) => setExpression(event.target.value)} />
      </Field>
      <MetricStrip
        items={[
          { label: "表达式长度", value: expression.length },
          { label: "结果类型", value: result.ok ? typeof result.value : "error" },
        ]}
      />
      {result.ok ? <ResultViewer title="计算结果" value={output} /> : <ResultViewer title="错误" value={output} />}
    </ToolWorkspace>
  );
}

export function PasswordTool() {
  const [length, setLength] = useState(16);
  const [lower, setLower] = useState(true);
  const [upper, setUpper] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(false);
  const [seed, setSeed] = useState(0);

  const generated = useMemo(
    () => generatePassword(length, { lower, upper, numbers, symbols }),
    [length, lower, numbers, symbols, upper, seed],
  );
  const strengthBits = generated.ok ? entropyScore(length, generated.alphabetSize) : 0;
  const output = generated.ok ? generated.value : generated.message;

  return (
    <ToolWorkspace
      title="密码生成器"
      description="生成高强度随机密码，并显示简单熵估算。"
      actions={<CopyButton value={output} disabled={!generated.ok}>复制密码</CopyButton>}
      meta={
        <>
          <StatusBadge tone={generated.ok ? "success" : "danger"}>{generated.ok ? strengthLabel(strengthBits) : "不可生成"}</StatusBadge>
          <span>{generated.ok ? `${strengthBits} bits` : "-"}</span>
        </>
      }
    >
      <div className="split align-start">
        <ToolPanel title="选项" description="字符集越多，组合越大。">
          <Field label="长度">
            <input type="number" min="8" max="64" value={length} onChange={(event) => setLength(Number(event.target.value))} />
          </Field>
          <div className="flag-grid">
            <label className="inline-check"><input type="checkbox" checked={lower} onChange={(event) => setLower(event.target.checked)} />小写字母</label>
            <label className="inline-check"><input type="checkbox" checked={upper} onChange={(event) => setUpper(event.target.checked)} />大写字母</label>
            <label className="inline-check"><input type="checkbox" checked={numbers} onChange={(event) => setNumbers(event.target.checked)} />数字</label>
            <label className="inline-check"><input type="checkbox" checked={symbols} onChange={(event) => setSymbols(event.target.checked)} />符号</label>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => setSeed((value) => value + 1)}>重新生成</button>
            <CopyButton value={generated.ok ? generated.value : ""} disabled={!generated.ok}>复制当前</CopyButton>
          </div>
        </ToolPanel>
        <ResultViewer title="密码" value={output} />
      </div>
      <MetricStrip
        items={[
          { label: "长度", value: length },
          { label: "字符集", value: generated.ok ? generated.alphabetSize : 0 },
          { label: "熵估算", value: generated.ok ? `${strengthBits} bits` : "-" },
        ]}
      />
    </ToolWorkspace>
  );
}

export function HtmlEntityTool() {
  const [mode, setMode] = useState<EntityMode>("encode");
  const [input, setInput] = useState("<div class=\"box\">SwiftBox & more</div>");
  const output = mode === "encode" ? encodeHtmlEntities(input) : decodeHtmlEntities(input);

  return (
    <ToolWorkspace
      title="HTML 实体转换"
      description="在原始文本与 HTML 实体之间编码/解码。"
      actions={<CopyButton value={output}>复制结果</CopyButton>}
      meta={
        <>
          <StatusBadge tone="success">本地处理</StatusBadge>
          <span>{mode === "encode" ? "Encode" : "Decode"}</span>
        </>
      }
    >
      <ToolPanel
        title="模式"
        action={
          <ToolTabs
            active={mode}
            onChange={(value) => setMode(value as EntityMode)}
            tabs={[
              { id: "encode", label: "Encode" },
              { id: "decode", label: "Decode" },
            ]}
          />
        }
      >
        <Field label="输入">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />
        </Field>
      </ToolPanel>
      <ResultViewer title="输出" value={output} />
    </ToolWorkspace>
  );
}

export function XmlTool() {
  const [input, setInput] = useState("<root><item id=\"1\">SwiftBox</item><item id=\"2\"/></root>");
  const result = useMemo(() => prettyXml(input), [input]);

  return (
    <ToolWorkspace
      title="XML 格式化"
      description="校验 XML 并输出缩进后的结构。"
      actions={<CopyButton value={result.ok ? result.value : ""} disabled={!result.ok}>复制格式化</CopyButton>}
      meta={
        <>
          <StatusBadge tone={result.ok ? "success" : "danger"}>{result.ok ? "XML 有效" : "XML 无效"}</StatusBadge>
        </>
      }
    >
      <Field label="XML 输入">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />
      </Field>
      {result.ok ? (
        <div className="split">
          <ResultViewer title="格式化结果" value={result.value} />
          <ResultViewer title="原始序列化" value={result.raw} />
        </div>
      ) : (
        <ResultViewer title="解析错误" value={result.message} />
      )}
    </ToolWorkspace>
  );
}

export function CaseTool() {
  const [input, setInput] = useState("Swift Box toolbox");
  const outputs = useMemo(() => ({
    camel: toCamelCase(input),
    pascal: toPascalCase(input),
    snake: toSnakeCase(input),
    kebab: toKebabCase(input),
    title: toTitleCase(input),
    slug: slugify(input),
  }), [input]);

  return (
    <ToolWorkspace
      title="大小写 / Slug 转换"
      description="常用命名风格互转，适合变量、文件名、URL slug。"
      actions={<CopyButton value={Object.entries(outputs).map(([key, value]) => `${key}: ${value}`).join("\n")}>复制全部</CopyButton>}
      meta={<><StatusBadge tone="success">常用文本工具</StatusBadge></>}
    >
      <Field label="文本">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />
      </Field>
      <MetricStrip
        items={[
          { label: "字符", value: input.length },
          { label: "单词", value: words(input).length },
        ]}
      />
      <div className="split">
        {Object.entries(outputs).map(([key, value]) => (
          <ResultViewer key={key} title={key} value={value} actions={<CopyButton value={value}>复制</CopyButton>} />
        ))}
      </div>
    </ToolWorkspace>
  );
}

export function TimezoneTool() {
  const [input, setInput] = useState(() => new Date().toISOString().slice(0, 16));
  const [timeZone, setTimeZone] = useState("Asia/Shanghai");
  const parsed = parseLocalDateTime(input);
  const output = parsed
    ? [
        `本地：${parsed.toLocaleString()}`,
        `目标时区：${formatInTimeZone(parsed, timeZone)}`,
        `UTC：${parsed.toISOString()}`,
        `Unix ms：${parsed.getTime()}`,
      ].join("\n")
    : "请输入有效的日期时间，例如 2026-04-17T13:30";

  return (
    <ToolWorkspace
      title="时区转换"
      description="将本地日期时间转换为常见时区输出。"
      actions={<CopyButton value={output} disabled={!parsed}>复制结果</CopyButton>}
      meta={
        <>
          <StatusBadge tone={parsed ? "success" : "danger"}>{parsed ? "可转换" : "输入无效"}</StatusBadge>
          <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
        </>
      }
    >
      <div className="split">
        <Field label="日期时间">
          <input type="datetime-local" value={input} onChange={(event) => setInput(event.target.value)} />
        </Field>
        <Field label="目标时区">
          <select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
            {commonTimeZones.map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </Field>
      </div>
      <MetricStrip
        items={[
          { label: "当前时区", value: Intl.DateTimeFormat().resolvedOptions().timeZone },
          { label: "目标时区", value: timeZone },
          { label: "输入字符", value: input.length },
        ]}
      />
      <ResultViewer title="转换结果" value={output} />
    </ToolWorkspace>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(value);
}

type MortgageMode = "equal-principal-and-interest" | "equal-principal";
type MortgageScenario = "single" | "combined" | "prepayment" | "stepwise";
type PrepaymentStrategy = "shorten-term" | "reduce-payment";

type MortgageRow = {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remaining: number;
};

type MortgageStep = {
  month: number;
  amount: number;
  strategy: PrepaymentStrategy;
  label?: string;
  repaymentMonth?: string;
  shortenYears?: number;
};

type MortgageStepForm = {
  id: string;
  repaymentMonth: string;
  amount: number;
  strategy: PrepaymentStrategy;
  shortenYears: number;
};

type StepResult = MortgageStep & {
  balanceBefore: number;
  balanceAfter: number;
  monthlyPaymentBefore: number;
  monthlyPaymentAfter: number;
  targetRemainingMonths?: number;
  cumulativeShortenMonths?: number;
};

type MortgageCalcResult = {
  ok: true;
  loanAmount: number;
  months: number;
  monthlyRate: number;
  monthlyPayment: number;
  lastMonthPayment?: number;
  totalPayment: number;
  totalInterest: number;
  schedule: MortgageRow[];
  allRows: MortgageRow[];
  commercialLoanAmount?: number;
  providentLoanAmount?: number;
  commercialLoanResult?: MortgageCalcResult;
  providentLoanResult?: MortgageCalcResult;
  originalMonthlyPayment?: number;
  newMonthlyPayment?: number;
  originalTotalInterest?: number;
  savedInterest?: number;
  remainingMonths?: number;
  finalMonthlyPayment?: number;
  prepaymentMonth?: number;
  prepaymentAmount?: number;
  prepaymentStrategy?: PrepaymentStrategy;
  steps?: StepResult[];
  unusedSteps?: MortgageStep[];
};

type MortgageError = {
  ok: false;
  message: string;
};

function buildPreviewMonths(months: number) {
  return Array.from(new Set([1, 2, 3, months - 2, months - 1, months].filter((month) => month >= 1 && month <= months))).sort((left, right) => left - right);
}

function makeZeroRows(months: number) {
  return Array.from({ length: months }, (_, index) => ({
    month: index + 1,
    payment: 0,
    principal: 0,
    interest: 0,
    remaining: 0,
  } satisfies MortgageRow));
}

function sumRows(rows: MortgageRow[]) {
  return rows.reduce(
    (accumulator, row) => ({
      payment: accumulator.payment + row.payment,
      principal: accumulator.principal + row.principal,
      interest: accumulator.interest + row.interest,
    }),
    { payment: 0, principal: 0, interest: 0 },
  );
}

function selectPreviewRows(rows: MortgageRow[]) {
  const previewMonths = buildPreviewMonths(rows.length);
  return previewMonths.map((month) => rows[month - 1]).filter(Boolean);
}

function calculateLoan(
  loanAmount: number,
  annualRate: number,
  years: number,
  mode: MortgageMode,
  allowZero = false,
): MortgageCalcResult | MortgageError {
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = Math.max(0, annualRate) / 100 / 12;

  if (loanAmount <= 0) {
    if (!allowZero) {
      return { ok: false as const, message: "请输入有效的贷款金额，需大于 0" };
    }

    const allRows = makeZeroRows(months);
    return {
      ok: true as const,
      loanAmount: 0,
      months,
      monthlyRate,
      monthlyPayment: 0,
      lastMonthPayment: 0,
      totalPayment: 0,
      totalInterest: 0,
      schedule: selectPreviewRows(allRows),
      allRows,
    };
  }

  const allRows: MortgageRow[] = [];
  let balance = loanAmount;
  let monthlyPayment = 0;
  let lastMonthPayment = 0;

  if (mode === "equal-principal-and-interest") {
    monthlyPayment = monthlyRate === 0
      ? loanAmount / months
      : (loanAmount * monthlyRate * (1 + monthlyRate) ** months) / ((1 + monthlyRate) ** months - 1);

    for (let month = 1; month <= months; month += 1) {
      const interest = balance * monthlyRate;
      const principal = month === months ? balance : Math.min(balance, monthlyPayment - interest);
      const payment = principal + interest;
      balance = Math.max(0, balance - principal);
      lastMonthPayment = payment;
      allRows.push({ month, payment, principal, interest, remaining: balance });
    }
  } else {
    const monthlyPrincipal = loanAmount / months;

    for (let month = 1; month <= months; month += 1) {
      const interest = balance * monthlyRate;
      const principal = month === months ? balance : Math.min(balance, monthlyPrincipal);
      const payment = principal + interest;
      balance = Math.max(0, balance - principal);
      if (month === 1) {
        monthlyPayment = payment;
      }
      lastMonthPayment = payment;
      allRows.push({ month, payment, principal, interest, remaining: balance });
    }
  }

  const totals = sumRows(allRows);

  return {
    ok: true as const,
    loanAmount,
    months,
    monthlyRate,
    monthlyPayment: mode === "equal-principal-and-interest" ? monthlyPayment : allRows[0]?.payment ?? 0,
    lastMonthPayment,
    totalPayment: totals.payment,
    totalInterest: totals.interest,
    schedule: selectPreviewRows(allRows),
    allRows,
  };
}

function calculateMortgage(homePrice: number, downPayment: number, annualRate: number, years: number, mode: MortgageMode): MortgageCalcResult | MortgageError {
  const loanAmount = Math.max(0, homePrice - downPayment);
  return calculateLoan(loanAmount, annualRate, years, mode);
}

function calculateCombinedMortgage(
  commercialLoanAmount: number,
  commercialAnnualRate: number,
  providentLoanAmount: number,
  providentAnnualRate: number,
  years: number,
  mode: MortgageMode,
): MortgageCalcResult | MortgageError {
  const commercialLoanResult = calculateLoan(commercialLoanAmount, commercialAnnualRate, years, mode, true);
  if (!commercialLoanResult.ok) {
    return commercialLoanResult;
  }

  const providentLoanResult = calculateLoan(providentLoanAmount, providentAnnualRate, years, mode, true);
  if (!providentLoanResult.ok) {
    return providentLoanResult;
  }

  if (commercialLoanResult.loanAmount <= 0 && providentLoanResult.loanAmount <= 0) {
    return { ok: false as const, message: "请输入有效的商贷或公积金贷款金额" };
  }

  const months = Math.max(commercialLoanResult.months, providentLoanResult.months);
  const allRows = Array.from({ length: months }, (_, index) => {
    const month = index + 1;
    const commercialRow = commercialLoanResult.allRows[index] ?? { month, payment: 0, principal: 0, interest: 0, remaining: 0 };
    const providentRow = providentLoanResult.allRows[index] ?? { month, payment: 0, principal: 0, interest: 0, remaining: 0 };
    return {
      month,
      payment: commercialRow.payment + providentRow.payment,
      principal: commercialRow.principal + providentRow.principal,
      interest: commercialRow.interest + providentRow.interest,
      remaining: commercialRow.remaining + providentRow.remaining,
    } satisfies MortgageRow;
  });

  const totals = sumRows(allRows);
  const loanAmount = commercialLoanResult.loanAmount + providentLoanResult.loanAmount;

  return {
    ok: true as const,
    loanAmount,
    months,
    monthlyRate: 0,
    monthlyPayment: allRows[0]?.payment ?? 0,
    lastMonthPayment: allRows[allRows.length - 1]?.payment ?? 0,
    totalPayment: totals.payment,
    totalInterest: totals.interest,
    schedule: selectPreviewRows(allRows),
    allRows,
    commercialLoanAmount: commercialLoanResult.loanAmount,
    providentLoanAmount: providentLoanResult.loanAmount,
    commercialLoanResult,
    providentLoanResult,
  };
}

function monthlyPaymentForBalance(balance: number, monthlyRate: number, months: number) {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return balance / months;
  return (balance * monthlyRate * (1 + monthlyRate) ** months) / ((1 + monthlyRate) ** months - 1);
}

function parseMonthKey(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

function monthKeyToMonthIndex(startMonthKey: string, targetMonthKey: string) {
  const start = parseMonthKey(startMonthKey);
  const target = parseMonthKey(targetMonthKey);
  if (!start || !target) return null;
  const diff = (target.year - start.year) * 12 + (target.month - start.month);
  return diff < 0 ? null : diff + 1;
}

function shiftMonthKey(monthKey: string, deltaMonths: number) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return null;
  const totalMonths = parsed.year * 12 + (parsed.month - 1) + deltaMonths;
  if (!Number.isFinite(totalMonths) || totalMonths < 0) return null;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatYears(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  const textValue = normalized.toFixed(1).replace(/\.0$/, "");
  return `${textValue} 年`;
}

function createMortgageStepForm(index: number, loanStartMonth: string, previousMonth?: string): MortgageStepForm {
  const fallbackMonth = index === 0 ? loanStartMonth : previousMonth ?? loanStartMonth;
  const repaymentMonth = shiftMonthKey(fallbackMonth, index === 0 ? 36 : 12) ?? fallbackMonth;
  return {
    id: `step-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    repaymentMonth,
    amount: index === 0 ? 200000 : 100000,
    strategy: index === 1 ? "reduce-payment" : "shorten-term",
    shortenYears: 1,
  };
}

function createInitialMortgageSteps(loanStartMonth: string) {
  const first = createMortgageStepForm(0, loanStartMonth);
  const secondMonth = shiftMonthKey(first.repaymentMonth, 12) ?? first.repaymentMonth;
  const second: MortgageStepForm = {
    ...createMortgageStepForm(1, loanStartMonth, first.repaymentMonth),
    repaymentMonth: secondMonth,
  };
  const thirdMonth = shiftMonthKey(second.repaymentMonth, 12) ?? second.repaymentMonth;
  const third: MortgageStepForm = {
    ...createMortgageStepForm(2, loanStartMonth, second.repaymentMonth),
    repaymentMonth: thirdMonth,
  };
  return [first, second, third];
}


function calculateStepwiseMortgage(
  loanAmount: number,
  annualRate: number,
  years: number,
  steps: MortgageStep[],
): MortgageCalcResult | MortgageError {
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = Math.max(0, annualRate) / 100 / 12;

  if (loanAmount <= 0) {
    return { ok: false as const, message: "请输入有效的贷款金额，需大于 0" };
  }

  const sortedSteps = steps
    .map((step) => ({
      ...step,
      month: Math.max(1, Math.round(step.month)),
      amount: Math.max(0, step.amount),
      shortenYears: Math.max(0, Number(step.shortenYears ?? 0)),
    }))
    .filter((step) => step.amount > 0)
    .sort((left, right) => left.month - right.month);

  const originalMonthlyPayment = monthlyPaymentForBalance(loanAmount, monthlyRate, months);
  const originalRows: MortgageRow[] = [];
  let originalBalance = loanAmount;
  for (let month = 1; month <= months; month += 1) {
    const interest = originalBalance * monthlyRate;
    const principal = month === months ? originalBalance : Math.min(originalBalance, originalMonthlyPayment - interest);
    const payment = principal + interest;
    originalBalance = Math.max(0, originalBalance - principal);
    originalRows.push({ month, payment, principal, interest, remaining: originalBalance });
    if (originalBalance <= 0) break;
  }

  const allRows: MortgageRow[] = [];
  const stepResults: StepResult[] = [];
  const unusedSteps: MortgageStep[] = [];
  let balance = loanAmount;
  let currentMonth = 0;
  let currentMonthlyPayment = originalMonthlyPayment;
  let totalPayment = 0;
  let totalInterest = 0;
  let stepIndex = 0;
  let cumulativeShortenMonths = 0;

  while (balance > 0 && currentMonth < 2000) {
    currentMonth += 1;
    const interest = balance * monthlyRate;
    const principal = Math.min(balance, currentMonthlyPayment - interest);
    if (principal <= 0) {
      return { ok: false as const, message: "当前月供不足以覆盖利息，无法完成分步提前还款测算" };
    }

    const payment = principal + interest;
    balance = Math.max(0, balance - principal);
    const row: MortgageRow = { month: currentMonth, payment, principal, interest, remaining: balance };
    allRows.push(row);
    totalPayment += payment;
    totalInterest += interest;

    while (stepIndex < sortedSteps.length && sortedSteps[stepIndex].month === currentMonth) {
      const step = sortedSteps[stepIndex];
      stepIndex += 1;
      if (balance <= 0) {
        unusedSteps.push(step);
        continue;
      }

      const balanceBefore = balance;
      const paymentBefore = currentMonthlyPayment;
      const extraPayment = Math.min(balanceBefore, step.amount);
      if (extraPayment <= 0) {
        unusedSteps.push(step);
        continue;
      }

      balance = Math.max(0, balance - extraPayment);
      row.payment += extraPayment;
      row.principal += extraPayment;
      row.remaining = balance;
      totalPayment += extraPayment;

      const remainingMonthsAfter = Math.max(1, months - currentMonth);
      const shortenMonths = step.strategy === "shorten-term" ? Math.round(Math.max(0, (step.shortenYears ?? 0)) * 12) : 0;
      const shortenMonthsAfterThisStep = cumulativeShortenMonths + shortenMonths;
      const targetRemainingMonths = step.strategy === "shorten-term"
        ? Math.max(1, remainingMonthsAfter - shortenMonthsAfterThisStep)
        : Math.max(1, remainingMonthsAfter - cumulativeShortenMonths);
      const paymentAfter = balance > 0
        ? monthlyPaymentForBalance(balance, monthlyRate, targetRemainingMonths)
        : currentMonthlyPayment;

      stepResults.push({
        month: step.month,
        amount: extraPayment,
        strategy: step.strategy,
        label: step.label,
        repaymentMonth: step.repaymentMonth,
        shortenYears: step.shortenYears,
        balanceBefore,
        balanceAfter: balance,
        monthlyPaymentBefore: paymentBefore,
        monthlyPaymentAfter: paymentAfter,
        targetRemainingMonths,
        cumulativeShortenMonths: shortenMonthsAfterThisStep,
      });

      cumulativeShortenMonths = shortenMonthsAfterThisStep;
      currentMonthlyPayment = paymentAfter;
      if (balance <= 0) {
        break;
      }
    }

    if (balance <= 0) {
      break;
    }
  }

  while (stepIndex < sortedSteps.length) {
    unusedSteps.push(sortedSteps[stepIndex]);
    stepIndex += 1;
  }

  const lastRow = allRows[allRows.length - 1];

  return {
    ok: true as const,
    loanAmount,
    months,
    monthlyRate,
    monthlyPayment: originalMonthlyPayment,
    lastMonthPayment: lastRow?.payment ?? originalMonthlyPayment,
    totalPayment,
    totalInterest,
    schedule: selectPreviewRows(allRows),
    allRows,
    originalMonthlyPayment,
    originalTotalInterest: sumRows(originalRows).interest,
    savedInterest: sumRows(originalRows).interest - totalInterest,
    remainingMonths: allRows.length,
    finalMonthlyPayment: currentMonthlyPayment,
    steps: stepResults,
    unusedSteps,
  };
}

function calculatePrepaymentMortgage(
  homePrice: number,
  downPayment: number,
  annualRate: number,
  years: number,
  prepaymentMonth: number,
  prepaymentAmount: number,
  strategy: PrepaymentStrategy,
  shortenYears = 1,
): MortgageCalcResult | MortgageError {
  const loanAmount = Math.max(0, homePrice - downPayment);
  const result = calculateStepwiseMortgage(loanAmount, annualRate, years, [
    { month: prepaymentMonth, amount: prepaymentAmount, strategy, shortenYears, label: "预设提前还款" },
  ]);

  if (!result.ok) {
    return result;
  }

  const step = result.steps?.[0];
  return {
    ...result,
    prepaymentMonth,
    prepaymentAmount: step?.amount ?? prepaymentAmount,
    prepaymentStrategy: strategy,
    newMonthlyPayment: step?.monthlyPaymentAfter ?? result.finalMonthlyPayment ?? result.monthlyPayment,
  };
}

export function MortgageTool() {
  const [scenario, setScenario] = useState<MortgageScenario>("single");
  const [homePrice, setHomePrice] = useState(3000000);
  const [downPayment, setDownPayment] = useState(900000);
  const [loanAmount, setLoanAmount] = useState(700000);
  const [annualRate, setAnnualRate] = useState(3.45);
  const [years, setYears] = useState(30);
  const [commercialLoanAmount, setCommercialLoanAmount] = useState(1800000);
  const [commercialAnnualRate, setCommercialAnnualRate] = useState(3.45);
  const [providentLoanAmount, setProvidentLoanAmount] = useState(600000);
  const [providentAnnualRate, setProvidentAnnualRate] = useState(2.85);
  const [prepaymentMonth, setPrepaymentMonth] = useState(60);
  const [prepaymentAmount, setPrepaymentAmount] = useState(200000);
  const [prepaymentStrategy, setPrepaymentStrategy] = useState<PrepaymentStrategy>("shorten-term");
  const [prepaymentShortenYears, setPrepaymentShortenYears] = useState(1);
  const [loanStartMonth, setLoanStartMonth] = useState("2021-01");
  const [stepForms, setStepForms] = useState<MortgageStepForm[]>(() => createInitialMortgageSteps("2021-01"));
  const [mode, setMode] = useState<MortgageMode>("equal-principal-and-interest");

  const stepValidationError = useMemo(() => {
    for (let index = 0; index < stepForms.length; index += 1) {
      const form = stepForms[index];
      if (!form.repaymentMonth.trim()) {
        return `第 ${index + 1} 步还款月份不能为空`;
      }
      if (monthKeyToMonthIndex(loanStartMonth, form.repaymentMonth) == null) {
        return `第 ${index + 1} 步还款月份不能早于贷款月份`;
      }
      if (form.amount <= 0) {
        return `第 ${index + 1} 步提前还款金额必须大于 0`;
      }
    }
    return null;
  }, [loanStartMonth, stepForms]);

  const stepInputs = useMemo<MortgageStep[]>(() => {
    return stepForms.flatMap((form, index) => {
      const month = monthKeyToMonthIndex(loanStartMonth, form.repaymentMonth);
      if (month == null || form.amount <= 0) {
        return [];
      }

      return [{
        month,
        amount: form.amount,
        strategy: form.strategy,
        label: `步骤 ${index + 1}`,
        repaymentMonth: form.repaymentMonth,
        shortenYears: form.strategy === "shorten-term" ? Math.max(0, form.shortenYears) : undefined,
      }];
    });
  }, [loanStartMonth, stepForms]);

  const result = useMemo(() => {
    if (scenario === "combined") {
      return calculateCombinedMortgage(
        commercialLoanAmount,
        commercialAnnualRate,
        providentLoanAmount,
        providentAnnualRate,
        years,
        mode,
      );
    }

    if (scenario === "stepwise") {
      if (stepValidationError) {
        return { ok: false as const, message: stepValidationError };
      }

      return calculateStepwiseMortgage(loanAmount, annualRate, years, stepInputs);
    }

    if (scenario === "prepayment") {
      return calculatePrepaymentMortgage(
        homePrice,
        downPayment,
        annualRate,
        years,
        prepaymentMonth,
        prepaymentAmount,
        prepaymentStrategy,
        prepaymentShortenYears,
      );
    }

    return calculateMortgage(homePrice, downPayment, annualRate, years, mode);
  }, [
    annualRate,
    commercialAnnualRate,
    commercialLoanAmount,
    downPayment,
    homePrice,
    loanAmount,
    mode,
    prepaymentAmount,
    prepaymentMonth,
    prepaymentShortenYears,
    prepaymentStrategy,
    providentAnnualRate,
    providentLoanAmount,
    scenario,
    stepForms,
    stepInputs,
    years,
  ]);

  const summary = result.ok
    ? scenario === "combined"
      ? [
          `组合贷款总额：${formatCurrency(result.loanAmount)}`,
          `商贷：${formatCurrency(result.commercialLoanAmount ?? 0)} / 公积金：${formatCurrency(result.providentLoanAmount ?? 0)}`,
          `还款月数：${result.months} 个月`,
          `商贷年利率：${commercialAnnualRate.toFixed(2)}% / 公积金年利率：${providentAnnualRate.toFixed(2)}%`,
          `综合首月月供：${formatCurrency(result.monthlyPayment)}`,
          `综合总利息：${formatCurrency(result.totalInterest)}`,
          `综合总还款：${formatCurrency(result.totalPayment)}`,
        ].join("\n")
      : scenario === "stepwise"
        ? [
            `贷款月份：${loanStartMonth}`,
            `原始贷款金额：${formatCurrency(result.loanAmount)}`,
            `贷款年限：${result.months} 个月`,
            `原始月供：${formatCurrency(result.originalMonthlyPayment ?? result.monthlyPayment)}`,
            ...(result.steps ?? []).map((step) => {
              const strategyLabel = step.strategy === "shorten-term" ? "缩短年限" : "减少月供";
              const stepLabel = step.label ?? `步骤（第 ${step.month} 个月）`;
              const monthLabel = step.repaymentMonth ? `${step.repaymentMonth}（第 ${step.month} 个月）` : `第 ${step.month} 个月`;
              const shortenLabel = step.strategy === "shorten-term" && step.shortenYears
                ? `，缩短 ${formatYears(step.shortenYears)}`
                : "";
              const targetLabel = step.targetRemainingMonths
                ? `，目标剩余 ${step.targetRemainingMonths} 个月`
                : "";
              return `${stepLabel}：${monthLabel} 追加 ${formatCurrency(step.amount)}，${strategyLabel}${shortenLabel}${targetLabel}，余额 ${formatCurrency(step.balanceAfter)}，月供 ${formatCurrency(step.monthlyPaymentAfter)}`;
            }),
            ...(stepForms.length === 0 ? ["未添加提前还款步骤"] : []),
            `原始总利息：${formatCurrency(result.originalTotalInterest ?? result.totalInterest)}`,
            `实际总利息：${formatCurrency(result.totalInterest)}`,
            `节省利息：${formatCurrency(result.savedInterest ?? 0)}`,
            `节省期数：${Math.max(0, (result.months ?? 0) - (result.remainingMonths ?? 0))} 个月`,
            `最终月供：${formatCurrency(result.finalMonthlyPayment ?? result.monthlyPayment)}`,
            ...(result.unusedSteps?.length ? [`未执行步骤：${result.unusedSteps.length} 个，后续步骤已超过结清时间`] : []),
          ].join("\n")
        : scenario === "prepayment"
          ? [
              `原始贷款金额：${formatCurrency(result.loanAmount)}`,
              `提前还款：第 ${prepaymentMonth} 期后一次性还款 ${formatCurrency(prepaymentAmount)}`,
              `还款策略：${prepaymentStrategy === "shorten-term" ? "缩短年限" : "减少月供"}`,
              prepaymentStrategy === "shorten-term" ? `缩短年限：${formatYears(prepaymentShortenYears)}` : "",
              `原始月供：${formatCurrency(result.originalMonthlyPayment ?? result.monthlyPayment)}`,
              prepaymentStrategy === "shorten-term"
                ? `提前还款后仍按原月供：${formatCurrency(result.newMonthlyPayment ?? result.monthlyPayment)}`
                : `提前还款后新月供：${formatCurrency(result.newMonthlyPayment ?? result.monthlyPayment)}`,
              `剩余期数：${result.remainingMonths ?? 0} 个月`,
              `原始总利息：${formatCurrency(result.originalTotalInterest ?? result.totalInterest)}`,
              `提前还款后总利息：${formatCurrency(result.totalInterest)}`,
              `节省利息：${formatCurrency(result.savedInterest ?? 0)}`,
              `总还款：${formatCurrency(result.totalPayment)}`,
            ].filter(Boolean).join("\n")
          : [
              `贷款金额：${formatCurrency(result.loanAmount)}`,
              `还款月数：${result.months} 个月`,
              `月利率：${(result.monthlyRate * 100).toFixed(4)}%`,
              mode === "equal-principal-and-interest"
                ? `月供：${formatCurrency(result.monthlyPayment)}`
                : `首月月供：${formatCurrency(result.monthlyPayment)}`,
              mode === "equal-principal"
                ? `末月月供：${formatCurrency(result.lastMonthPayment ?? result.monthlyPayment)}`
                : `总利息：${formatCurrency(result.totalInterest)}`,
              `总还款：${formatCurrency(result.totalPayment)}`,
            ].join("\n")
    : result.message;

  const description = scenario === "combined"
    ? "计算商贷 + 公积金组合贷款的月供、总利息和还款明细。"
    : scenario === "stepwise"
      ? "按多次提前还款的顺序分步测算余额、月供变化、可自由增减步骤，并可自定义缩短年限。"
      : scenario === "prepayment"
        ? "测算提前还款后的月供、剩余期数和节省利息。"
        : "计算等额本息与等额本金的月供、总利息和还款明细。";

  const metricItems = result.ok
    ? scenario === "combined"
      ? [
          { label: "组合贷款总额", value: formatCurrency(result.loanAmount) },
          { label: "综合首月月供", value: formatCurrency(result.monthlyPayment) },
          { label: "商贷月供", value: formatCurrency(result.commercialLoanResult?.monthlyPayment ?? 0) },
          { label: "公积金月供", value: formatCurrency(result.providentLoanResult?.monthlyPayment ?? 0) },
        ]
      : scenario === "stepwise"
        ? [
            { label: "原始月供", value: formatCurrency(result.originalMonthlyPayment ?? result.monthlyPayment) },
            { label: "最终月供", value: formatCurrency(result.finalMonthlyPayment ?? result.monthlyPayment) },
            { label: "节省期数", value: `${Math.max(0, (result.months ?? 0) - (result.remainingMonths ?? 0))} 个月` },
            { label: "节省利息", value: formatCurrency(result.savedInterest ?? 0) },
          ]
      : scenario === "prepayment"
        ? [
            { label: "原始月供", value: formatCurrency(result.originalMonthlyPayment ?? result.monthlyPayment) },
            { label: "提前后月供", value: formatCurrency(result.newMonthlyPayment ?? result.monthlyPayment) },
            { label: "剩余期数", value: `${result.remainingMonths ?? 0} 个月` },
            { label: "节省利息", value: formatCurrency(result.savedInterest ?? 0) },
          ]
        : [
            { label: "贷款金额", value: formatCurrency(result.loanAmount) },
            { label: "月供/月初", value: formatCurrency(result.monthlyPayment) },
            { label: "总利息", value: formatCurrency(result.totalInterest) },
            { label: "总还款", value: formatCurrency(result.totalPayment) },
          ]
    : [
        { label: "贷款金额", value: "-" },
        { label: "月供/月初", value: "-" },
        { label: "总利息", value: "-" },
        { label: "总还款", value: "-" },
      ];

  const scheduleText = result.ok
    ? result.schedule
        .map((row) => `第 ${row.month} 期 | 月供 ${formatCurrency(row.payment)} | 本金 ${formatCurrency(row.principal)} | 利息 ${formatCurrency(row.interest)} | 剩余 ${formatCurrency(row.remaining)}`)
        .join("\n")
    : summary;

  const prepaymentDetailText = result.ok && scenario === "prepayment"
    ? [
        `第 ${prepaymentMonth} 期后一次性还款 ${formatCurrency(prepaymentAmount)}`,
        `提前还款策略：${prepaymentStrategy === "shorten-term" ? "缩短年限" : "减少月供"}`,
        prepaymentStrategy === "shorten-term" ? `缩短年限：${formatYears(prepaymentShortenYears)}` : "",
        `原始剩余本金：${formatCurrency((result.allRows[prepaymentMonth - 1]?.remaining ?? 0) + prepaymentAmount)}`,
        `提前还款后剩余本金：${formatCurrency(result.allRows[prepaymentMonth - 1]?.remaining ?? 0)}`,
        `节省利息：${formatCurrency(result.savedInterest ?? 0)}`,
      ].filter(Boolean).join("\n")
    : "";

  const addStep = () => {
    setStepForms((current) => {
      const last = current[current.length - 1];
      const nextMonth = last ? shiftMonthKey(last.repaymentMonth, 12) ?? last.repaymentMonth : shiftMonthKey(loanStartMonth, 36) ?? loanStartMonth;
      return [
        ...current,
        {
          id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          repaymentMonth: nextMonth,
          amount: 100000,
          strategy: "shorten-term",
          shortenYears: 1,
        },
      ];
    });
  };

  const removeStep = (index: number) => {
    setStepForms((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateStep = (index: number, patch: Partial<MortgageStepForm>) => {
    setStepForms((current) => current.map((step, currentIndex) => (currentIndex === index ? { ...step, ...patch } : step)));
  };

  return (
    <ToolWorkspace
      title="房贷计算器"
      description={description}
      actions={<CopyButton value={summary} disabled={!result.ok}>复制结果</CopyButton>}
      meta={
        <>
          <StatusBadge tone={result.ok ? "success" : "danger"}>{result.ok ? "可计算" : "参数无效"}</StatusBadge>
          <span>
            {scenario === "combined"
              ? "组合贷款"
              : scenario === "stepwise"
                ? "分步计算"
                : scenario === "prepayment"
                  ? "提前还款"
                  : mode === "equal-principal-and-interest"
                    ? "等额本息"
                    : "等额本金"}
          </span>
        </>
      }
    >
      <ToolPanel
        title="计算场景"
        action={
          <ToolTabs
            active={scenario}
            onChange={(value) => setScenario(value as MortgageScenario)}
            tabs={[
              { id: "single", label: "单笔贷款" },
              { id: "combined", label: "组合贷款" },
              { id: "stepwise", label: "分步计算" },
              { id: "prepayment", label: "提前还款" },
            ]}
          />
        }
      >
        {scenario === "combined" ? (
          <div className="split">
            <Field label="商贷金额">
              <input type="number" min="0" value={commercialLoanAmount} onChange={(event) => setCommercialLoanAmount(Number(event.target.value))} />
            </Field>
            <Field label="商贷年利率 (%)">
              <input type="number" min="0" step="0.01" value={commercialAnnualRate} onChange={(event) => setCommercialAnnualRate(Number(event.target.value))} />
            </Field>
            <Field label="公积金金额">
              <input type="number" min="0" value={providentLoanAmount} onChange={(event) => setProvidentLoanAmount(Number(event.target.value))} />
            </Field>
            <Field label="公积金年利率 (%)">
              <input type="number" min="0" step="0.01" value={providentAnnualRate} onChange={(event) => setProvidentAnnualRate(Number(event.target.value))} />
            </Field>
          </div>
        ) : scenario === "stepwise" ? (
          <>
            <div className="split">
              <Field label="贷款金额">
                <input type="number" min="0" value={loanAmount} onChange={(event) => setLoanAmount(Number(event.target.value))} />
              </Field>
              <Field label="贷款月份">
                <input type="month" value={loanStartMonth} onChange={(event) => setLoanStartMonth(event.target.value)} />
              </Field>
            </div>
            <div className="split">
              <Field label="年利率 (%)">
                <input type="number" min="0" step="0.01" value={annualRate} onChange={(event) => setAnnualRate(Number(event.target.value))} />
              </Field>
              <Field label="贷款年限">
                <input type="number" min="1" max="40" value={years} onChange={(event) => setYears(Number(event.target.value))} />
              </Field>
            </div>
            <Field label="说明">
              <div style={{ lineHeight: 1.6, fontSize: 13, color: "var(--muted-foreground, #6b7280)" }}>
                可以自由添加或删除提前还款步骤；每一步都可选择“缩短年限”或“减少月供”，其中“缩短年限”支持自定义缩短多少年。
              </div>
            </Field>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "var(--muted-foreground, #6b7280)" }}>当前步骤：{stepForms.length} 个</div>
              <button type="button" onClick={addStep}>添加步骤</button>
            </div>
            {stepForms.length === 0 ? (
              <div style={{ padding: 16, border: "1px dashed var(--border, #d1d5db)", borderRadius: 12, color: "var(--muted-foreground, #6b7280)" }}>
                还没有步骤。点击“添加步骤”开始配置提前还款计划。
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {stepForms.map((step, index) => (
                  <div key={step.id} style={{ padding: 16, border: "1px solid var(--border, #e5e7eb)", borderRadius: 16, background: "var(--card, #fff)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <strong>步骤 {index + 1}</strong>
                      <button type="button" onClick={() => removeStep(index)} disabled={stepForms.length === 0}>删除步骤</button>
                    </div>
                    <div className="split">
                      <Field label="还款月份">
                        <input type="month" value={step.repaymentMonth} onChange={(event) => updateStep(index, { repaymentMonth: event.target.value })} />
                      </Field>
                      <Field label="提前还款金额">
                        <input type="number" min="0" value={step.amount} onChange={(event) => updateStep(index, { amount: Number(event.target.value) })} />
                      </Field>
                    </div>
                    <Field label="策略">
                      <ToolTabs
                        active={step.strategy}
                        onChange={(value) => updateStep(index, { strategy: value as PrepaymentStrategy })}
                        tabs={[
                          { id: "shorten-term", label: "缩短年限" },
                          { id: "reduce-payment", label: "减少月供" },
                        ]}
                      />
                    </Field>
                    {step.strategy === "shorten-term" ? (
                      <Field label="缩短年限（年）">
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={step.shortenYears}
                          onChange={(event) => updateStep(index, { shortenYears: Number(event.target.value) })}
                        />
                      </Field>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : scenario === "prepayment" ? (
          <>
            <div className="split">
              <Field label="房价">
                <input type="number" min="0" value={homePrice} onChange={(event) => setHomePrice(Number(event.target.value))} />
              </Field>
              <Field label="首付">
                <input type="number" min="0" value={downPayment} onChange={(event) => setDownPayment(Number(event.target.value))} />
              </Field>
            </div>
            <div className="split">
              <Field label="年利率 (%)">
                <input type="number" min="0" step="0.01" value={annualRate} onChange={(event) => setAnnualRate(Number(event.target.value))} />
              </Field>
              <Field label="贷款年限">
                <input type="number" min="1" max="40" value={years} onChange={(event) => setYears(Number(event.target.value))} />
              </Field>
            </div>
            <div className="split">
              <Field label="提前还款月份">
                <input type="number" min="1" max="480" value={prepaymentMonth} onChange={(event) => setPrepaymentMonth(Number(event.target.value))} />
              </Field>
              <Field label="提前还款金额">
                <input type="number" min="0" value={prepaymentAmount} onChange={(event) => setPrepaymentAmount(Number(event.target.value))} />
              </Field>
            </div>
            <Field label="提前还款策略">
              <ToolTabs
                active={prepaymentStrategy}
                onChange={(value) => setPrepaymentStrategy(value as PrepaymentStrategy)}
                tabs={[
                  { id: "shorten-term", label: "缩短年限" },
                  { id: "reduce-payment", label: "减少月供" },
                ]}
              />
            </Field>
            {prepaymentStrategy === "shorten-term" ? (
              <Field label="缩短年限（年）">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={prepaymentShortenYears}
                  onChange={(event) => setPrepaymentShortenYears(Number(event.target.value))}
                />
              </Field>
            ) : null}
          </>
        ) : (
          <>
            <ToolTabs
              active={mode}
              onChange={(value) => setMode(value as MortgageMode)}
              tabs={[
                { id: "equal-principal-and-interest", label: "等额本息" },
                { id: "equal-principal", label: "等额本金" },
              ]}
            />
            <div className="split">
              <Field label="房价">
                <input type="number" min="0" value={homePrice} onChange={(event) => setHomePrice(Number(event.target.value))} />
              </Field>
              <Field label="首付">
                <input type="number" min="0" value={downPayment} onChange={(event) => setDownPayment(Number(event.target.value))} />
              </Field>
            </div>
            <div className="split">
              <Field label="年利率 (%)">
                <input type="number" min="0" step="0.01" value={annualRate} onChange={(event) => setAnnualRate(Number(event.target.value))} />
              </Field>
              <Field label="贷款年限">
                <input type="number" min="1" max="40" value={years} onChange={(event) => setYears(Number(event.target.value))} />
              </Field>
            </div>
          </>
        )}
      </ToolPanel>
      <MetricStrip items={metricItems} />
      {result.ok ? (
        <div className="split">
          <ResultViewer title="计算摘要" value={summary} />
          <ResultViewer
            title={scenario === "prepayment" ? "提前还款明细" : scenario === "stepwise" ? "分步还款明细" : "还款示例"}
            value={scenario === "prepayment" ? [prepaymentDetailText, scheduleText].filter(Boolean).join("\n") : scheduleText}
          />
        </div>
      ) : (
        <ResultViewer title="错误" value={summary} />
      )}
    </ToolWorkspace>
  );
}
