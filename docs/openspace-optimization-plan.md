# SwiftBox OpenSpace Optimization Plan

## 主题

把 SwiftBox 从“工具合集”优化成“高频岗位工具工作台”。

## 目标

- 打开工具后，用户马上知道该填什么。
- 输入后，结果自动出现，不需要猜按钮。
- 每个结果区都有明确的复制、下载、回填或发送动作。
- 错误提示告诉用户怎么修正，而不是只显示失败。
- 同类工具保持一致的布局、状态、复制路径和空状态。
- HTTP、JWT、JSON、Base64、Hash 等敏感输入不保存历史。

## OpenSpace 原则

1. 真实场景优先  
   不为了功能数量加功能，只优化实际高频任务。

2. 输入最短路径  
   用户应该可以粘贴原始内容，工具自动识别并输出结果。

3. 结果即操作  
   每个结果区必须有明确的复制、下载、回填或发送动作。

4. 同类工具一致  
   JSON、Base64、URL、CSV 这类转换工具要长得像、用法像。

5. 敏感内容不落盘  
   HTTP 请求、JWT、JSON、Base64、Hash 等不保存输入历史。

## 工具体验模型

### 转换类

适用工具：

- JSON
- Base64
- URL
- 时间戳
- CSV / JSON
- CSS 单位
- Hash

标准布局：

- 左侧输入
- 右侧输出
- 顶部状态
- 底部常用复制按钮
- 输入变化后自动计算

### 检测类

适用工具：

- JWT
- 正则
- 对比度
- 图片信息

标准布局：

- 输入区
- 分析结果
- 关键结论
- 复制主要结论

### 生成类

适用工具：

- UUID
- Mock 数据
- 二维码
- 占位文案
- 配色板

标准布局：

- 参数区
- 生成结果
- 重新生成
- 复制 / 下载

### 请求类

适用工具：

- HTTP 请求

标准布局：

- 请求栏固定在顶部
- Params / Headers / Body / cURL 分区
- 响应区在下方
- cURL 导入作为辅助区，不抢主操作

### 编辑类

适用工具：

- Markdown
- 文本处理
- Diff

标准布局：

- 双栏编辑器
- 结果实时预览
- 常用动作固定在工具栏

## 统一组件规划

建议新增目录：

```text
src/tools/ui/
  ToolWorkspace.tsx
  ToolHeader.tsx
  ToolInputPanel.tsx
  ToolOutputPanel.tsx
  ToolActionBar.tsx
  ToolTabs.tsx
  KeyValueEditor.tsx
  CopyButton.tsx
  StatusBadge.tsx
  InlineError.tsx
  ResultTabs.tsx
```

组件职责：

- `ToolWorkspace`：统一工具页骨架。
- `ToolHeader`：工具名、说明、安全提示、当前状态。
- `ToolInputPanel`：统一输入区样式和布局。
- `ToolOutputPanel`：统一输出区样式和复制入口。
- `ToolActionBar`：清空、示例、复制、回填等操作。
- `ToolTabs`：统一分段切换。
- `KeyValueEditor`：Headers、Params、Body Form 等键值表格。
- `CopyButton`：复制反馈。
- `StatusBadge`：成功、警告、错误、中性状态。
- `InlineError`：工具内错误提示。
- `ResultTabs`：Body / Headers / Info 等结果切换。

## 议题一：HTTP 请求工具

### 当前问题

- 请求配置区和 cURL 导入区信息密度偏高。
- Headers / Body 虽然支持多模式，但与真实请求流程的层级还可以更清晰。
- 缺少 Query Params 表格。
- 响应区缺少 Body / Headers / Info tabs。

### 优化方案

- 顶部请求栏固定为核心区域：
  - Method
  - URL
  - Send
  - Copy cURL
- 请求配置区改为 tabs：
  - Params
  - Headers
  - Body
  - cURL
- Params 新增两列表格：
  - enabled
  - key
  - value
  - 自动同步到 URL query
- Headers 支持：
  - 表格模式
  - JSON 模式
  - Raw 模式
- Body 支持：
  - JSON
  - Form
  - Raw
  - x-www-form-urlencoded
- 响应区支持 tabs：
  - Body
  - Headers
  - Info
- 响应 Body：
  - JSON 自动格式化
  - 非 JSON 原样展示
  - 支持复制响应体
  - 支持复制响应 headers
- 错误提示：
  - URL 无效
  - Header 格式错误
  - Body JSON 无效
  - 网络请求失败
  - 证书 / DNS / 超时等原因尽量给可读提示

### 目标布局

```text
[GET v] [https://api.example.com/users?q=test              ] [Send]

Params | Headers | Body | cURL

请求配置区

Status: 200 OK   Time: 230ms   Size: 4.2KB
Body | Headers | Info
```

优先级：P0

## 议题二：JSON 工具

### 优化方案

- 自动检测 JSON 是否有效。
- 错误提示显示：
  - 错误原因
  - 大概位置
  - 示例修复建议
- 输出区 tabs：
  - Format
  - Minify
  - Sort Keys
  - Escape
  - Unescape
- 增加 JSON Path 查询：
  - 例如 `user.name`
  - 输出对应值
- 增加结构统计：
  - 类型
  - key 数量
  - 数组长度
  - 字符数
- 结果区一键复制当前 tab 内容。

优先级：P0

## 议题三：URL 工具

### 优化方案

- URL 输入后自动拆解：
  - Protocol
  - Host
  - Path
  - Query Params
  - Hash
- Query Params 两列表格：
  - enabled
  - key
  - value
- 修改表格后实时生成新 URL。
- 支持：
  - Encode
  - Decode
  - Copy full URL
  - Copy query object JSON
- 非法 URL 降级为普通文本 encode / decode。

优先级：P0

## 议题四：正则工具

### 优化方案

- Flags 改为复选：
  - g
  - i
  - m
  - s
  - u
- 测试文本中高亮匹配片段。
- 匹配列表展示：
  - index
  - match
  - groups
- 替换预览独立区域。
- 常用正则模板：
  - 手机号
  - 邮箱
  - URL
  - 中文
  - 数字
  - UUID
  - IP

优先级：P0

## 议题五：文本处理工具

### 优化方案

- 左侧输入，右侧输出。
- 动作按分组：
  - 清理：trim、清空空行、去多余空格
  - 行处理：去重、排序、反转
  - 大小写：upper、lower、capitalize
  - 格式化：slug、camelCase、kebab-case、snake_case
  - 统计：字符、单词、行数、非空行
- 每次操作不覆盖输入，只更新输出。
- 增加“将输出回填到输入”。

优先级：P0

## 议题六：JWT 工具

### 优化方案

- Header / Payload 分 tab。
- 显示关键字段：
  - alg
  - typ
  - iss
  - sub
  - aud
  - iat
  - exp
- exp 显示：
  - 本地时间
  - 是否过期
  - 距离过期多久
- 明确提示：
  - 仅 decode，不校验签名
- 支持复制：
  - Header JSON
  - Payload JSON
  - 完整 decode 结果

优先级：P1

## 议题七：Base64 工具

### 优化方案

- 支持模式：
  - Text
  - URL-safe Base64
  - File
- 自动判断当前输入是否可 decode。
- 输出区：
  - Encode result
  - Decode result
- 错误提示：
  - 非法字符
  - padding 缺失
  - UTF-8 解码失败
- 支持复制和下载。

优先级：P1

## 议题八：CSV / JSON 工具

### 优化方案

- CSV 表格预览。
- 支持分隔符：
  - comma
  - semicolon
  - tab
- JSON 转 CSV 支持：
  - 自动收集字段
  - 空值策略
  - 嵌套对象扁平化
- CSV 转 JSON 支持：
  - 第一行作为表头
  - 自动 trim
  - 空行忽略
- 输出结果可复制。

优先级：P1

## 议题九：设计类工具

### 颜色工具

- 支持 HEX / RGB / HSL 输入互转。
- 色值改变时全部格式实时更新。
- 增加透明度 slider。
- 色块点击复制。
- 图片取色后显示最近取色记录。

### 配色板

- 输出色阶：
  - 50
  - 100
  - 200
  - 300
  - 500
  - 700
  - 900
- 支持复制 CSS variables。
- 支持复制 Tailwind 风格 token。

### 对比度

- 显示 AA / AAA 结果。
- 自动推荐黑 / 白文字。
- 支持交换前景色和背景色。

### 图片信息

- 图片预览更清楚。
- 显示：
  - 文件名
  - 类型
  - 尺寸
  - 比例
  - 大小
  - megapixels
- 支持复制信息。

优先级：P1

## 议题十：Mock 数据工具

### 优化方案

- 字段可选：
  - name
  - phone
  - email
  - address
  - date
  - number
  - id
  - url
- 数量可配置。
- 输出格式：
  - JSON
  - CSV
  - SQL insert
- 支持重新生成。
- 支持复制当前结果。

优先级：P2

## 议题十一：主导航体验

### 当前问题

工具多了以后，只靠卡片导航会变慢。

### 优化方案

- 搜索框支持 Enter 打开第一个结果。
- 工具页左侧增加轻量工具切换列表。
- 首页分区：
  - 收藏
  - 最近使用
  - 全部工具
- 工具卡片减少文案，增加关键词标签。
- 每个工具增加“常用场景”说明，但放在工具内，不放首页卡片。
- 支持快捷键：
  - `Cmd/Ctrl + Enter` 执行
  - `Cmd/Ctrl + K` 搜索
  - `Esc` 返回工具导航

优先级：P1

## 实施路线

### 第一轮：统一工具框架

目标：先把所有工具的骨架统一。

改动：

- 新建 `src/tools/ui`
- 抽象工具页通用组件
- 统一按钮、错误、复制、输出、tabs、key-value editor
- 不大改业务逻辑

交付结果：

- 所有工具看起来像同一个产品里的工具。
- 后续优化成本明显下降。

### 第二轮：P0 核心工具深度优化

目标：先优化最常用、最容易觉得难用的工具。

工具：

- HTTP 请求
- JSON 工具
- URL 工具
- 正则工具
- 文本处理

交付结果：

- 这 5 个工具达到“日常可替代网页工具”的程度。

### 第三轮：P1 工具补齐

工具：

- JWT
- Base64
- CSV / JSON
- 颜色
- 配色板
- 对比度
- 二维码

交付结果：

- 开发、产品、设计常用工具体验一致。

### 第四轮：导航与效率

目标：像 uTools / Raycast 一样快。

改动：

- Enter 打开搜索结果
- 工具页内快速切换
- 收藏 / 最近强化
- 快捷键
- 工具示例与空状态优化

## Backlog

### P0

- 统一工具 UI 组件。
- HTTP 请求工具重做。
- JSON 工具深度优化。
- URL 工具深度优化。
- 正则工具深度优化。
- 文本处理工具深度优化。

### P1

- JWT 工具优化。
- Base64 工具优化。
- CSV / JSON 工具优化。
- 颜色 / 配色 / 对比度优化。
- 二维码优化。
- 首页搜索体验优化。

### P2

- Mock 数据字段配置。
- Markdown 预览增强。
- Hash 文件体验增强。
- 图片信息增强。
- 时间戳 presets。
- CSS 单位 presets。

## 建议下一步

优先执行“第一轮：统一工具框架”，随后重做 HTTP 请求工具。

原因：

- HTTP 是最复杂的工具，最能验证统一组件是否合理。
- 如果 HTTP 可以被统一组件承载，JSON、URL、正则、文本处理的重构会更顺。
- 统一组件先行，可以避免每个工具继续各写各的 UI。
