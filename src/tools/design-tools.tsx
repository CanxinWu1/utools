import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { adjustHex, contrastRatio, hexToRgb, hslToHex, rgbToHex, rgbToHsl } from "./color-utils";
import { copyText, Field, MetricStrip, Output, StatusPill, ToolShell } from "./shared";

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
    <ToolShell title="颜色工具" note="色值转换、透明度输出和图片中心点取色。">
      <div className="split align-start">
        <div>
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
            <button type="button" onClick={() => copyText(output)}>复制结果</button>
            {rgb ? <button type="button" onClick={() => copyText(normalized)}>复制 HEX</button> : null}
          </div>
          <input ref={fileRef} className="hidden-input" type="file" accept="image/*" onChange={pickFromImage} />
        </div>
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
      <Output value={output} />
    </ToolShell>
  );
}

export function ImageInfoTool() {
  const [info, setInfo] = useState("选择一张图片后显示尺寸、格式和大小。");
  const [preview, setPreview] = useState("");

  function inspectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
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
    <ToolShell title="图片信息" note="查看图片尺寸、比例、像素量和文件大小。">
      <input type="file" accept="image/*" onChange={inspectImage} />
      {preview ? <img className="image-preview" src={preview} alt="图片预览" /> : null}
      <button type="button" onClick={() => copyText(info)}>复制信息</button>
      <Output value={info} />
    </ToolShell>
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

  return (
    <ToolShell title="配色板" note="从主色生成深浅层级，点击色块可复制。">
      <Field label="主色">
        <input value={base} onChange={(event) => setBase(event.target.value)} />
      </Field>
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
      <button type="button" onClick={() => copyText(output)}>复制色板</button>
    </ToolShell>
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
    <ToolShell title="对比度检查" note="检查前景色与背景色的 WCAG 对比度。">
      <div className="split align-start">
        <div>
          <Field label="前景色">
            <input value={foreground} onChange={(event) => setForeground(event.target.value)} />
          </Field>
          <Field label="背景色">
            <input value={background} onChange={(event) => setBackground(event.target.value)} />
          </Field>
          <div className="button-row">
            <button type="button" onClick={() => copyText(output)}>复制结论</button>
            <button type="button" onClick={() => setForeground(readableTextColor(background))}>自动推荐前景色</button>
          </div>
        </div>
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
      <Output value={output} />
    </ToolShell>
  );
}
