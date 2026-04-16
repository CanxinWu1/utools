## Why

SwiftBox 已经覆盖多个岗位的常用工具，但大部分工具仍像独立 demo：布局、输入方式、错误提示、复制路径和结果展示不一致，导致用户需要反复适应每个工具。现在需要用统一规格约束后续优化，把工具箱升级为高频岗位工作台。

## What Changes

- 引入统一工具工作区体验：工具标题、输入区、结果区、状态、错误、复制、示例、清空、回填等交互保持一致。
- 深度优化 P0 高频工具：HTTP 请求、JSON、URL、正则、文本处理。
- 补齐 P1 工具体验：JWT、Base64、CSV / JSON、二维码、颜色、配色板、对比度。
- 优化导航效率：搜索首项回车打开、工具页快速切换、收藏和最近使用更突出。
- 保持敏感内容本地临时处理，不保存 HTTP 请求正文、JWT、JSON 原文、Base64 输入、Hash 输入或文件内容。
- 不引入插件市场、第三方插件运行时或云同步。

## Capabilities

### New Capabilities

- `tool-workspace-ux`: 统一工具页面骨架、状态、错误、复制、示例、清空、回填、结果区布局和响应式规则。
- `http-request-tool`: HTTP 请求工具的 Params、Headers、Body、cURL 导入、响应展示和错误反馈能力。
- `data-transform-tools`: JSON、URL、Base64、CSV / JSON、时间戳、Hash 等转换类工具的输入、输出、校验和复制能力。
- `text-and-regex-tools`: 正则测试、文本处理、Markdown、Diff 等编辑类工具的预览、匹配、替换、回填和复制能力。
- `design-and-generator-tools`: 颜色、配色板、对比度、图片信息、二维码、Mock 数据、UUID、占位文案等生成 / 检测类工具能力。
- `tool-navigation-efficiency`: 搜索、收藏、最近使用、快捷键和工具页切换效率能力。

### Modified Capabilities

- None. 当前 `openspec/specs/` 为空，本次作为首批能力规格。

## Impact

- 主要影响 `src/tools/**`、`src/tools/ui/**`、`src/App.tsx`、`src/App.css`。
- HTTP 仍复用现有 Tauri `send_http_request` 命令；只有在前端无法满足请求参数能力时再调整 Rust 入参。
- 不新增服务端或持久化存储。
- 需要保持 `pnpm build` 通过，并在小窗口和桌面窗口下手动验证布局不溢出。
