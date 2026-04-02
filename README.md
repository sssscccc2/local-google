# Local Fingerprint Browser 本地指纹浏览器

基于 Electron 的本地指纹浏览器，支持多配置文件管理和浏览器指纹伪装。

## 功能特性

- **多配置文件管理** — 创建、编辑、删除多个浏览器指纹配置
- **指纹伪装** — 覆盖 15+ 个浏览器指纹维度
- **一致性校验** — 自动确保所有指纹参数互相匹配
- **平台预设** — 内置 Windows/macOS/Linux 三大平台的常见配置模板
- **独立会话** — 每个配置文件使用独立的浏览器分区（Cookie/缓存互相隔离）

## 覆盖的指纹维度

| 层级 | 指纹点 |
|------|--------|
| HTTP 头 | User-Agent, Accept-Language, Sec-CH-UA 全系列 Client Hints, DNT, Sec-GPC |
| Navigator | userAgent, platform, userAgentData, hardwareConcurrency, deviceMemory, language, webdriver, plugins, mimeTypes |
| Canvas | getImageData / toDataURL / toBlob 像素级噪声注入 |
| WebGL | vendor/renderer 字符串, getParameter 拦截 |
| Audio | AudioContext / OfflineAudioContext / AnalyserNode 噪声 |
| 屏幕 | width, height, colorDepth, pixelDepth, devicePixelRatio |
| 时区 | getTimezoneOffset, Intl.DateTimeFormat, Date.toString |
| WebRTC | 私有 IP 过滤 / 完全禁用 |
| 字体 | FontFaceSet.check 过滤 |
| 插件 | navigator.plugins / navigator.mimeTypes 伪装 |

## 快速开始

```bash
npm install
npm start
```

## 使用方法

1. 启动后打开管理界面
2. 点击"新建配置"创建浏览器指纹配置
3. 可选择平台预设或随机生成指纹参数
4. 点击"启动"打开使用该指纹配置的浏览器窗口

## 项目结构

```
src/
  main/           # Electron 主进程
  preload/        # Preload 脚本（指纹注入）
    spoof/        # 各指纹维度的伪装模块
  fingerprint/    # 指纹生成引擎
  profiles/       # 配置文件管理
  ui/             # 管理界面
```

## 技术栈

- Electron
- 原生 JavaScript（无框架依赖）
