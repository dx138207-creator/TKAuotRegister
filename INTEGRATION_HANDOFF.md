# 自动化脚本工程 — 接入主项目交接摘要

> 用途：复制到主项目文档、或在新 Cursor 会话中 `@` 引用。  
> 背景：本仓库为 Appium 脚本与设备面板；主项目为「手机模拟器」管理端，需在模拟器列表行尾增加「启动脚本」等能力。

---

## 1. 目标与边界

| 项 | 说明 |
|----|------|
| **业务目标** | 在主项目模拟器列表每行增加按钮（如「启动脚本」），调用本自动化能力；可选实时查看任务状态与日志。 |
| **技术事实** | ADB / Appium 运行在**宿主机（PC）**，不在 Android 模拟器系统内；控制台 UI 在宿主侧（Web 或桌面）更稳定。 |
| **曾误做已回滚** | 曾将「整仓改 Electron+Vue」视为需求，已按用户要求回滚；**主项目继续用自己的技术栈**，本仓作为子模块/子目录接入即可。 |

---

## 2. 推荐接入形态（目录）

将**除 `node_modules` 外**的本仓库整体放入主项目根下子目录，例如：

```text
main-project/
  package.json                 # 主项目自己的，勿整文件覆盖
  src/                           # 主项目前端/后端
  automation-service/            # 本脚本工程（从本仓库拷贝）
    birthday-only.js
    appium-script.js
    script.js
    script-second.js
    run-page.js
    device-panel-server.js
    device-config.html
    pages/
    lib/                         # 必须保留，脚本大量 require
    platform-tools/              # 含 adb.exe 等
    package.json                 # 可选：子目录独立依赖（推荐）
    logs/                        # 可选：不拷贝历史日志亦可
```

**禁止**：删除 `lib/` 后迁移（会导致 `require` 失败）。  
**禁止**：把 `node_modules` 拷到主项目（应在目标环境重新 `npm install`）。

---

## 3. 依赖与主项目 `package.json`

- **以主项目 `package.json` 为准**，不要用它覆盖主项目；只**增量合并**依赖与 `scripts`。
- 本仓当前依赖参考：`appium`、`appium-uiautomator2-driver`、`xlsx`；开发侧有 `webdriverio`（按需）。

### 方案 A：子目录保留独立 `package.json`（推荐）

主项目根 `scripts` 示例：

```json
{
  "scripts": {
    "automation:install": "npm install --prefix automation-service",
    "automation:panel": "npm run panel --prefix automation-service",
    "automation:appium": "npm run appium --prefix automation-service",
    "automation:page": "npm run page --prefix automation-service",
    "automation:birthday": "node automation-service/birthday-only.js"
  }
}
```

要求 `automation-service/package.json` 内仍包含：`panel`、`appium`、`page` 等脚本（与本仓一致）。

### 方案 B：依赖全部装在主项目根

主项目根 `scripts` 示例：

```json
{
  "scripts": {
    "automation:panel": "node automation-service/device-panel-server.js",
    "automation:appium": "appium server -p 4723",
    "automation:page": "node automation-service/run-page.js",
    "automation:birthday": "node automation-service/birthday-only.js",
    "automation:script": "node automation-service/script.js",
    "automation:script-second": "node automation-service/script-second.js"
  }
}
```

**注意**：`spawn` / `node` 启动子进程时，`cwd` 建议设为 `automation-service`，以便相对路径（如 `platform-tools/adb.exe`）正确。

---

## 4. 现成 HTTP 能力（设备面板）

文件：`device-panel-server.js` + 静态页 `device-config.html`。

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/` 或 `/device-config.html` | 多设备面板页面 |
| POST | `/api/run` | 启动任务（body：`device` + `runMode`） |
| GET | `/api/status?id=...` | 查询任务状态 |
| POST | `/api/stop` | 停止任务 |
| POST | `/api/force-disconnect` | 强制断开等 |

默认监听：`DEVICE_PANEL_HOST`（默认 `0.0.0.0`）、`DEVICE_PANEL_PORT`（默认 `5188`）。  
主项目列表按钮可改为请求主项目自己的后端，再由后端代理到上述端口（避免浏览器跨域与暴露端口），或直接同域反向代理。

---

## 5. 脚本入口与参数（与 UI 映射）

### `birthday-only.js`（生日流程片段）

- 参数格式：`ip:port adbPassword`（一行内空格分隔）。
- 环境变量：`APPIUM_PORT`（默认 4723）。
- ADB：优先使用 `automation-service/platform-tools/adb.exe`（相对 `process.cwd()`）。

### `script.js` / `script-second.js`（完整注册链）

- 参数格式见 `lib/parse-device-args.js`：`ip:port adbPassword email googlePassword`。

主项目「每行启动」时，从模拟器列表取 `endpoint`（`host:port`）、`adbPassword` 等拼成上述参数即可。

---

## 6. 主项目前端对接建议（列表行按钮）

1. 行数据至少包含：`endpoint`（`ip:port`）、`adbPassword`；若跑完整脚本还需邮箱与 Google 密码（与现面板一致）。
2. 点击「启动」→ 调用主项目 API → 主项目调用 `automation-service`（HTTP 或直接 `spawn`）。
3. 轮询 `status` 或 WebSocket 推送，更新该行「运行中 / 成功 / 失败」与最近日志摘要。
4. 同一 `endpoint` 建议**单任务锁**，避免重复点击双开。

---

## 7. 验证清单（迁移后）

- [ ] 在 `automation-service` 目录下：`node birthday-only.js "host:port password"` 能跑到预期阶段（需本机 Appium、设备可达）。
- [ ] `npm run automation:panel`（或等价命令）能打开面板 / 接口可访问。
- [ ] `platform-tools/adb.exe` 路径在**实际进程的 cwd** 下可解析。
- [ ] 主项目仅合并依赖与 scripts，**未覆盖**主项目原有 `name`/构建脚本。

---

## 8. 与 AI 协作的上下文传递

- Cursor 对话**不会自动随仓库切换**；将本文档放入主项目后，新会话用 `@INTEGRATION_HANDOFF.md`（或实际路径）引入即可。
- 重大约定可同步写入主项目 `.cursor/rules` 或团队 `AGENTS.md`（若团队规范允许）。

---

## 9. 本文件位置

- 路径：`INTEGRATION_HANDOFF.md`（本仓库根目录）。
- 拷贝到主项目时建议改名为：`docs/automation-handoff.md` 或保留原名均可。

---

*文档生成自交接对话整理，实施时以实际仓库代码为准。*
