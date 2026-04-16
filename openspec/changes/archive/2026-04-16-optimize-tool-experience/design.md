## Context

SwiftBox 是 Tauri 2 + React + TypeScript 桌面工具箱，当前工具按岗位拆分在 `src/tools/*-tools.tsx`，共享组件集中在 `src/tools/shared.tsx`，工具注册在 `src/tools/registry.ts`。现状已经具备多岗位工具目录、收藏、最近使用和局部工具增强，但工具内部仍存在交互模型不统一、布局密度不稳定、结果动作位置不一致的问题。

本次 change 以 OpenSpec 规格驱动方式定义优化范围，先建立统一工具体验框架，再按 P0/P1/P2 推进各工具。实现必须尊重本地敏感数据策略：不保存 HTTP 请求正文、JWT、JSON 原文、Base64 输入、Hash 输入或文件内容。

## Goals / Non-Goals

**Goals:**

- 建立统一工具工作区组件模型，覆盖标题、状态、输入、输出、错误、复制、示例、清空、回填。
- 将工具按转换类、检测类、生成类、请求类、编辑类套用一致交互模型。
- 优先深度优化 HTTP、JSON、URL、正则、文本处理五个 P0 高频工具。
- 提升搜索、收藏、最近使用和工具页切换效率。
- 保持构建稳定，所有阶段均可用 `pnpm build` 验证。

**Non-Goals:**

- 不建设插件市场或第三方插件运行时。
- 不引入云同步、账号体系、请求历史持久化或敏感内容持久化。
- 不把 HTTP 请求底层替换成新的网络栈，除非前端规格无法通过现有 Tauri 命令满足。
- 不追求一次性完成所有 P2 增强。

## Decisions

### Decision 1: Introduce shared tool UI components before optimizing individual tools

Create `src/tools/ui/` for reusable primitives:

- `ToolWorkspace`
- `ToolHeader`
- `ToolPanel`
- `ToolTabs`
- `KeyValueEditor`
- `ResultViewer`
- `CopyButton`
- `StatusBadge`
- `InlineError`
- `EmptyHint`

Rationale: current tools duplicate layout and actions. A shared component layer lets HTTP, JSON, URL, Regex, Text and later tools converge without repeating CSS and state patterns.

Alternative considered: continue improving each tool file directly. Rejected because every tool would keep slightly different semantics for copy, error, tabs and results.

### Decision 2: Keep domain logic inside role tool files, share only presentation and small editor primitives

Role files such as `frontend-tools.tsx`, `backend-tools.tsx`, `qa-tools.tsx`, `office-tools.tsx`, and `design-tools.tsx` remain the ownership boundary for tool-specific parsing and transformation.

Rationale: the user explicitly asked to keep tools split by job role. Shared UI components must not become a new giant tool logic file.

Alternative considered: centralize all tool logic in services. Rejected for the MVP because most transformations are small and easier to maintain beside the component.

### Decision 3: HTTP uses a request workspace pattern

HTTP will use:

- Fixed top request bar: Method, URL, Send.
- Request tabs: Params, Headers, Body, cURL.
- Response tabs: Body, Headers, Info.
- Key-value editors for Params, Headers and form Body.
- JSON and Raw modes where appropriate.

Rationale: HTTP is the highest-complexity tool and should validate the shared UI model. If this works, simpler tools can reuse the same panels/tabs/error/result components.

Alternative considered: keep cURL import and Headers/Body visible at all times. Rejected because it creates noise and makes the main send path harder to scan.

### Decision 4: Use local transient state only

Tool input content remains React state only. Existing `localStorage` preferences stay limited to favorites, recents, theme and non-sensitive preferences.

Rationale: this preserves the privacy posture promised by the MVP.

Alternative considered: save per-tool drafts. Rejected for sensitive tools; can be revisited later only with explicit opt-in and redaction.

### Decision 5: Optimize in four iterations

1. Shared tool UI framework.
2. P0 core tools: HTTP, JSON, URL, Regex, Text.
3. P1 tools: JWT, Base64, CSV / JSON, QR, design tools.
4. Navigation and keyboard efficiency.

Rationale: the work is broad. Iterative delivery keeps the app usable and reviewable.

## Risks / Trade-offs

- [Risk] Shared components become too generic and hard to use → Mitigation: create components from HTTP + JSON + Text real usage, not abstract guesses.
- [Risk] HTTP cURL parsing is incomplete → Mitigation: support common `-X`, `-H`, `-d`, `--data-*`, quoted URL patterns first; show parse errors and keep raw fallback.
- [Risk] Tool pages become too dense → Mitigation: use tabs for secondary modes and keep one primary action per tool visible.
- [Risk] Regressing existing tools while refactoring → Mitigation: migrate one tool category at a time and run `pnpm build` after each batch.
- [Risk] Sensitive input accidentally persists → Mitigation: centralize persistence policy and avoid saving tool input in preferences.
