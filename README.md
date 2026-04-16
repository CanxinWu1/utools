# SwiftBox

SwiftBox 是一个基于 Tauri 2 + React 的桌面快捷工具箱，面向开发、测试、产品、设计、运营和办公场景。它提供命令搜索、岗位分类、收藏、最近使用、全局快捷键唤起，以及一批本地可用的常用工具。

## 功能概览

- 前端开发：颜色工具、JSON 工具、Base64、URL 工具、时间戳转换等。
- 后端开发：HTTP 请求工具、UUID/随机字符串、JWT 解码等。
- 测试/QA：正则测试、Mock 数据生成等。
- 产品/运营/办公：Markdown 预览、文本处理、二维码生成等。
- 设计：图片信息查看、配色板工具等。
- 桌面体验：`Cmd/Ctrl + Shift + Space` 快捷键唤起，关闭窗口后继续后台运行，托盘右键可退出。

## 直接下载安装包

不想本地配置开发环境时，可以直接下载 GitHub Actions 自动构建的安装包。

1. 打开项目仓库：[CanxinWu1/utools](https://github.com/CanxinWu1/utools)
2. 点击顶部的 **Actions**
3. 在左侧选择 **Build Desktop Apps**
4. 打开最新一次成功的构建记录
5. 滚动到页面最底部的 **Artifacts**
6. 按你的系统下载对应安装包

可下载的 Artifacts：

- `quickdesk-windows`：Windows 安装包，通常包含 `.msi` 或 `.exe`。
- `swiftbox-macos-apple-silicon`：Apple Silicon Mac 使用，例如 M1、M2、M3、M4。
- `swiftbox-macos-intel`：Intel Mac 使用。

下载后解压 Artifact，再运行里面的安装包或 `.dmg` 文件即可。

## macOS 首次打开提示

Actions 构建出来的 macOS 包没有经过 Apple Developer ID 正式公证，首次打开时 macOS 可能提示：

> Apple 无法验证 “SwiftBox” 是否包含可能危害 Mac 安全或泄漏隐私的恶意软件。

如果你确认安装包来自本项目 Actions，可以使用下面任一方式打开。

方式一：右键打开

1. 在 Finder 中找到 `SwiftBox.app`
2. 按住 `Control` 并点击应用
3. 选择 **打开**
4. 弹窗中再次点击 **打开**

方式二：系统设置放行

1. 打开 **系统设置**
2. 进入 **隐私与安全性**
3. 找到 `SwiftBox` 被阻止的提示
4. 点击 **仍要打开**

方式三：命令行解除隔离

```bash
xattr -dr com.apple.quarantine /Applications/SwiftBox.app
```

如果应用还在下载目录，把路径换成实际位置：

```bash
xattr -dr com.apple.quarantine ~/Downloads/SwiftBox.app
```

## 本地下载代码运行

适合想二次开发、调试或自己打包的用户。

### 环境要求

- Node.js 22 或更高版本
- pnpm 10 或更高版本
- Rust stable
- Tauri 2 所需系统依赖

macOS 通常需要安装 Xcode Command Line Tools：

```bash
xcode-select --install
```

Windows 需要安装 Rust、Node.js，并准备 Visual Studio C++ 构建工具。Linux 需要额外安装 WebKitGTK 等 Tauri 依赖。

### 克隆项目

```bash
git clone git@github.com:CanxinWu1/utools.git
cd utools
```

如果没有配置 SSH，也可以使用 HTTPS：

```bash
git clone https://github.com/CanxinWu1/utools.git
cd utools
```

### 安装依赖

```bash
pnpm install
```

### 启动开发版

```bash
pnpm tauri dev
```

启动后会打开 SwiftBox 桌面客户端。默认快捷键：

```text
Cmd/Ctrl + Shift + Space
```

点击窗口关闭按钮时，应用会隐藏到后台；再次按快捷键可以唤起。需要完全退出时，在系统托盘或菜单栏图标上右键，选择 **退出**。

### 构建本机安装包

```bash
pnpm tauri build
```

构建产物通常在：

```text
src-tauri/target/release/bundle/
```

macOS 指定架构构建：

```bash
pnpm tauri build --target aarch64-apple-darwin
pnpm tauri build --target x86_64-apple-darwin
```

Windows 构建建议在 Windows 环境或 GitHub Actions 的 `windows-latest` 上执行：

```bash
pnpm tauri build
```

## 使用说明

1. 打开 SwiftBox 后，可以在顶部搜索框输入工具名、岗位或关键词。
2. 点击左侧岗位分类，可以回到该分类下的工具列表。
3. 点击工具卡片进入具体工具页面。
4. 常用工具可以收藏，最近使用会自动记录在本地。
5. HTTP 请求工具不会保存请求历史、请求正文、Token 或 Cookie 等敏感内容。

## 开发命令

```bash
pnpm build
pnpm tauri dev
pnpm tauri build
```

## 推荐 IDE

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
