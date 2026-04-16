import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { adjustHex, contrastRatio, hexToRgb, hslToHex, rgbToHex, rgbToHsl } from "./color-utils";
import { copyText, Field, MetricStrip, StatusPill, CopyButton, InlineError, ResultViewer, StatusBadge, ToolPanel, ToolWorkspace } from "./ui";

function readableTextColor(hex: string) {
  const black = contrastRatio("#111827", hex) ?? 0;
  const white = contrastRatio("#FFFFFF", hex) ?? 0;
  return black > white ? "#111827" : "#FFFFFF";
}

function imageAspect(width: number, height: number) {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const value = gcd(width, height);
  return `${width / value}:${height / value}`;
}

function colorScaleCss(colors: string[]) {
  return colors.map((color, index) => `--color-${(index + 1) * 100}: ${color};`).join("\n");
}

export function ColorTool() {
  const [hex, setHex] = useState("#2563EB");
  const [alpha, setAlpha] = useState(100);
  const [sample, setSample] = useState("#2563EB");
  const fileRef = useRef<HTMLInputElement>(null);
  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
  const normalized = rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : sample;
  const alphaHex = Math.round((alpha / 100) * 255).toString(16).padStart(2, "0").toUpperCase();
  const output = rgb && hsl
    ? [
        `HEX ${normalized}`,
        `HEX Alpha ${normalized}${alphaHex}`,
        `RGB rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
        `RGBA rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(alpha / 100).toFixed(2)})`,
        `HSL hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`,
        `CSS --color-accent: ${normalized};`,
      ].join("\n")
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
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  }

  return (
    <ToolWorkspace
      title="颜色工具"
      description="色值转换、透明度输出、CSS 变量和图片中心点取色。"
      actions={<CopyButton value={output} disabled={!rgb}>复制结果</CopyButton>}
      meta={
        <>
          <StatusBadge tone={rgb ? "success" : "danger"}>{rgb ? "有效色值" : "无效色值"}</StatusBadge>
          {rgb ? <span>{normalized}</span> : null}
          <span>{alpha}% alpha</span>
        </>
      }
    >
      <div className="split align-start">
        <ToolPanel title="输入" description="支持 6 位 HEX，图片取色使用图片中心点。">
          <div className="split">
            <Field label="HEX 色值">
              <input value={hex} onChange={(event) => setHex(event.target.value)} />
            </Field>
            <Field label="透明度">
              <input type="number" min="0" max="100" value={alpha} onChange={(event) => setAlpha(Number(event.target.value))} />
            </Field>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => fileRef.current?.click()}>上传图片取色</button>
            <CopyButton value={output} disabled={!rgb}>复制结果</CopyButton>
            {rgb ? <button type="button" onClick={() => copyText(normalized)}>复制 HEX</button> : null}
          </div>
          <input ref={fileRef} className="hidden-input" type="file" accept="image/*" onChange={pickFromImage} />
        </ToolPanel>
        <div className="color-preview" style={{ background: normalized, color: readableTextColor(normalized) }}>
          <span>{normalized}</span>
        </div>
      </div>
      {rgb && hsl ? (
        <MetricStrip
          items={[
            { label: "R", value: rgb.r },
            { label: "G", value: rgb.g },
            { label: "B", value: rgb.b },
            { label: "Hue", value: hsl.h },
          ]}
        />
      ) : null}
      {rgb ? <ResultViewer title="CSS 输出" value={output} /> : <InlineError message={output} />}
    </ToolWorkspace>
  );
}

export function ImageInfoTool() {
  const [info, setInfo] = useState("选择一张图片后显示尺寸、格式和大小。");
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");

  function inspectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const image = new Image();
    image.onload = () => {
      const megaPixels = (image.width * image.height) / 1_000_000;
      setInfo([
        `文件：${file.name}`,
        `类型：${file.type || "未知"}`,
        `尺寸：${image.width} x ${image.height}`,
        `比例：${imageAspect(image.width, image.height)}`,
        `像素：${megaPixels.toFixed(2)} MP`,
        `大小：${(file.size / 1024).toFixed(1)} KB`,
      ].join("\n"));
    };
    const url = URL.createObjectURL(file);
    setPreview(url);
    image.src = url;
  }

  return (
    <ToolWorkspace
      title="图片信息"
      description="查看图片尺寸、比例、像素量、格式和文件大小。"
      actions={<CopyButton value={info}>复制信息</CopyButton>}
      meta={
        <>
          <span>{fileName || "未选择图片"}</span>
        </>
      }
    >
      <ToolPanel title="选择图片" description="图片只在本地读取，不会保存内容。">
        <input type="file" accept="image/*" onChange={inspectImage} />
      </ToolPanel>
      <div className="split align-start">
        {preview ? <img className="image-preview" src={preview} alt="图片预览" /> : null}
        <ResultViewer title="图片信息" value={info} />
      </div>
    </ToolWorkspace>
  );
}

export function PaletteTool() {
  const [base, setBase] = useState("#2563EB");
  const colors = useMemo(() => {
    const rgb = hexToRgb(base);
    if (!rgb) return [adjustHex(base, -70), adjustHex(base, -35), base, adjustHex(base, 35), adjustHex(base, 70)];
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return [
      hslToHex(hsl.h, hsl.s, 18),
      hslToHex(hsl.h, hsl.s, 34),
      base,
      hslToHex(hsl.h, Math.max(20, hsl.s - 10), 66),
      hslToHex(hsl.h, Math.max(16, hsl.s - 18), 88),
    ];
  }, [base]);
  const output = colors.join("\n");
  const cssOutput = colorScaleCss(colors);

  return (
    <ToolWorkspace
      title="配色板"
      description="从主色生成深浅层级，支持复制色值和 CSS 变量。"
      actions={<CopyButton value={cssOutput}>复制 CSS 变量</CopyButton>}
      meta={
        <>
          <StatusBadge tone={hexToRgb(base) ? "success" : "danger"}>{hexToRgb(base) ? "有效主色" : "无效主色"}</StatusBadge>
          <span>{base}</span>
        </>
      }
    >
      <ToolPanel title="主色">
        <Field label="HEX">
          <input value={base} onChange={(event) => setBase(event.target.value)} />
        </Field>
      </ToolPanel>
      <div className="palette-row">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{ background: color, color: readableTextColor(color) }}
            onClick={() => copyText(color)}
          >
            {color}
          </button>
        ))}
      </div>
      <div className="split">
        <ResultViewer title="色值" value={output} />
        <ResultViewer title="CSS 变量" value={cssOutput} />
      </div>
    </ToolWorkspace>
  );
}

export function ContrastTool() {
  const [foreground, setForeground] = useState("#111827");
  const [background, setBackground] = useState("#FFFFFF");
  const ratio = contrastRatio(foreground, background);
  const output = ratio
    ? [`对比度：${ratio.toFixed(2)}:1`, `普通文本 AA：${ratio >= 4.5 ? "通过" : "未通过"}`, `大字号 AA：${ratio >= 3 ? "通过" : "未通过"}`, `AAA：${ratio >= 7 ? "通过" : "未通过"}`].join("\n")
    : "请输入有效 6 位 HEX 色值";

  return (
    <ToolWorkspace
      title="对比度检查"
      description="检查前景色与背景色的 WCAG 对比度。"
      actions={<CopyButton value={output}>复制结论</CopyButton>}
      meta={
        <>
          <StatusBadge tone={ratio && ratio >= 4.5 ? "success" : "danger"}>{ratio ? `${ratio.toFixed(2)}:1` : "无效色值"}</StatusBadge>
          <span>AA {ratio && ratio >= 4.5 ? "通过" : "未通过"}</span>
        </>
      }
    >
      <div className="split align-start">
        <ToolPanel title="颜色">
          <Field label="前景色">
            <input value={foreground} onChange={(event) => setForeground(event.target.value)} />
          </Field>
          <Field label="背景色">
            <input value={background} onChange={(event) => setBackground(event.target.value)} />
          </Field>
          <div className="button-row">
            <CopyButton value={output}>复制结论</CopyButton>
            <button type="button" onClick={() => setForeground(readableTextColor(background))}>自动推荐前景色</button>
          </div>
        </ToolPanel>
        <div className="color-preview contrast-preview" style={{ color: foreground, background }}>
          <span>SwiftBox</span>
          <small>清晰可读的操作界面</small>
        </div>
      </div>
      <div className="button-row">
        <StatusPill tone={ratio && ratio >= 4.5 ? "success" : "danger"}>
          {ratio ? `${ratio.toFixed(2)}:1` : "无效色值"}
        </StatusPill>
        <StatusPill tone={ratio && ratio >= 3 ? "success" : "warning"}>大字号 AA</StatusPill>
        <StatusPill tone={ratio && ratio >= 7 ? "success" : "warning"}>AAA</StatusPill>
      </div>
      <ResultViewer title="检查结果" value={output} />
    </ToolWorkspace>
  );
}
