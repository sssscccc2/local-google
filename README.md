# Local Fingerprint Browser 本地指纹浏览器

基于本机 Google Chrome 的指纹浏览器管理器。通过 Electron 管理界面 + Chrome 扩展注入，实现多账号多开、指纹隔离、互不关联。

## 功能特性

- **直接使用本机 Chrome** — 不是模拟浏览器，启动的就是你电脑上装的 Google Chrome
- **多开互不关联** — 每个配置使用独立的 Chrome 用户数据目录，Cookie/缓存/登录状态完全隔离
- **15+ 维度指纹伪装** — 通过自动注入的 Chrome MV3 扩展修改浏览器指纹
- **一致性校验** — 自动确保 UA、平台、语言、硬件等参数互相匹配，不被检测
- **内置 Discord Token Login 扩展** — 一键下载，每个配置自动加载
- **平台预设** — 内置 Windows / macOS / Linux 常见配置模板

## 环境要求

- **Google Chrome** — 本机需要安装 Chrome 浏览器
- **Node.js** >= 18
- **Windows** （macOS/Linux 理论支持，需微调 Chrome 路径）

## 一键安装

```bash
git clone https://github.com/sssscccc2/local-google.git
cd local-google
npm install
npm run download-ext
npm start
```

### 各步骤说明

| 命令 | 作用 |
|------|------|
| `npm install` | 安装依赖（Electron 等），首次较慢需下载 Chromium |
| `npm run download-ext` | 下载 Discord Token Login 扩展到 `extensions/` 目录 |
| `npm start` | 启动管理界面 |

## 使用方法

1. `npm start` 启动管理界面
2. 点击 **"+ 新建配置"**
3. 输入名称，点 **"随机生成全部指纹"**（或手动填写）
4. 点 **"保存"**
5. 点配置卡片上的 **"启动"** — 你的本机 Chrome 会以独立身份打开
6. 可同时启动多个不同配置，互不关联

## 覆盖的指纹维度

| 层级 | 修改方式 | 指纹点 |
|------|----------|--------|
| HTTP 头 | Chrome 扩展 declarativeNetRequest | User-Agent, Accept-Language, Sec-CH-UA 全系列 Client Hints, DNT, Sec-GPC |
| Navigator | 页面注入脚本 | userAgent, platform, userAgentData, hardwareConcurrency, deviceMemory, language, webdriver, plugins, mimeTypes |
| Canvas | 页面注入脚本 | getImageData / toDataURL / toBlob 像素级噪声 |
| WebGL | 页面注入脚本 | vendor/renderer 字符串, getParameter 拦截 |
| Audio | 页面注入脚本 | AudioContext / OfflineAudioContext / AnalyserNode 噪声 |
| 屏幕 | 页面注入脚本 | width, height, colorDepth, pixelDepth, devicePixelRatio |
| 时区 | 页面注入脚本 | getTimezoneOffset, Intl.DateTimeFormat |
| WebRTC | 页面注入脚本 | 私有 IP 过滤 / 完全禁用 |
| 字体 | 页面注入脚本 | FontFaceSet.check 白名单 |
| 插件 | 页面注入脚本 | navigator.plugins / mimeTypes 伪造 |

## 项目结构

```
local-google/
  package.json
  scripts/
    download-extension.js     # 下载 Discord Token Login 扩展
  extensions/                 # 第三方扩展存放目录（git 忽略）
  data/                       # 运行时数据（git 忽略）
    profiles.json             # 配置文件元数据
    profiles/{id}/
      fp-extension/           # 该配置的指纹伪装扩展（自动生成）
      chrome-data/            # 该配置的 Chrome 用户数据目录
  src/
    main/
      main.js                 # Electron 主进程
      chrome-launcher.js      # 查找并启动本机 Chrome
      extension-builder.js    # 为每个配置生成定制的指纹扩展
      window-manager.js       # 管理界面窗口 + 配置启动
      session-manager.js      # HTTP 头拦截
    extension-template/       # 指纹伪装 Chrome 扩展模板（MV3）
      manifest.json
      background.js           # Service Worker：修改 HTTP 请求头
      inject.js               # Content Script：注入 spoof.js
    fingerprint/
      generator.js            # 基于种子的确定性指纹生成
      consistency.js          # 一致性校验（UA/平台/语言/硬件对齐）
      presets.js              # Windows/macOS/Linux 预设模板
    profiles/
      profile-manager.js      # 配置文件 CRUD
      profile-store.js        # JSON 持久化存储
    preload/
      manager-preload.js      # 管理界面 preload
    ui/
      index.html              # 管理界面
      app.js                  # 管理界面逻辑
      styles.css              # 暗色主题样式
```

## 添加更多扩展

将任何 Chrome 扩展（解压后的文件夹，包含 `manifest.json`）放入 `extensions/` 目录，启动配置时会自动加载。

## 技术栈

- Electron（仅用于管理界面）
- Google Chrome（实际浏览器）
- Chrome Extension MV3（指纹伪装）
- 原生 JavaScript（无框架依赖）
