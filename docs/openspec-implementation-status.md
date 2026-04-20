# SwiftBox OpenSpec Implementation Status

## 已实现

- 新增 `src/tools/ui/` 共享工具 UI 层：工作台、头部、面板、Tab、结果查看、复制按钮、状态、错误提示、空状态和键值编辑器。
- HTTP 请求工具完成主流程重构：Method、URL、Send、Params、Headers、Body、cURL、响应 Body/Headers/Info。
- HTTP Body 支持 JSON、表格对象、x-www-form-urlencoded 和 Raw。
- JSON 工具支持 Format、Minify、Sort Keys、Escape、Unescape、统计和错误引导。
- URL 工具支持结构解析、Query 参数编辑、重组 URL、Encode/Decode 和 Query JSON 复制。
- 正则工具支持 flags 勾选、模板、高亮匹配、捕获组、替换预览。
- 文本处理支持清理、行操作、大小写、格式转换和结果回填。
- Base64 支持 Text 和 URL-safe 模式，并提供可读解码错误。
- JWT 支持 Header、Payload、Claims 分区，展示本地时间和过期状态，并明确不做签名校验。
- CSV / JSON 支持转换方向、分隔符、字段收集和表格预览。
- 二维码支持纠错等级、深浅色、PNG scale、预览和下载。
- 颜色、图片信息、配色板、对比度工具已迁入统一工作台。
- 新增通用效率工具：计算器、密码生成器、房贷计算器（单笔 / 组合 / 提前还款 / 分步计算，可自由增减步骤并自定义缩短年限）、HTML 实体转换、XML 格式化、大小写 / Slug 转换、时区转换。
- 新增高级 API 工具：HMAC / Webhook 签名、AWS SigV4 签名。
- 导航支持 Enter 打开第一个搜索结果、Cmd/Ctrl+K 聚焦搜索、Esc 返回导航、工具页快速切换、收藏/最近快捷入口。

## 已验证

- `pnpm build` 通过。
- `pnpm tauri dev` 已启动，Vite 监听 `http://localhost:1420/`，Tauri dev binary 已运行。
- `localStorage` 仅保存收藏、最近使用和主题；HTTP body、JWT、JSON、图片等敏感工具输入未持久化。

## 待人工验收

- HTTP GET、POST JSON、Params、Headers、cURL 导入请求公开接口。
- P0 工具的合法/非法输入点击验收。
- P1 工具在浅色和深色主题下的点击验收。
- 窄屏和桌面宽度下的文字溢出、布局折叠和工具页快速切换。
- 系统全局快捷键显示/隐藏窗口并聚焦搜索。

## 延后项

- 将 `src/tools/shared.tsx` 中仍被旧工具使用的通用行为完全迁入 `src/tools/ui/`。
- 更高级的二维码解析、真实屏幕取色、HTTP 请求历史和插件市场。
