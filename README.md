# Appium 多设备自动化脚本

本项目用于在**云手机 / 远程 Android 设备**上通过 **ADB + Appium** 执行 TikTok 相关自动化流程（美区 `US`、墨西哥区 `MX` 等），并提供 **Web 多设备面板** 批量启动与查看状态。

---

## 一、环境要求

| 项目 | 说明 |
|------|------|
| **Node.js** | 建议 **LTS 18.x 或 20.x**（与 Appium 3 兼容）。安装后可在终端执行 `node -v`、`npm -v` 确认。 |
| **操作系统** | 当前脚本与面板主要在 **Windows** 下开发与验证；`platform-tools` 目录内为 `adb.exe`。 |
| **ADB** | 仓库已包含 `platform-tools/adb.exe`。若使用本机 ADB，需保证 `adb` 在 PATH 中且版本与设备兼容。 |
| **Appium** | 依赖已写入 `package.json`；面板启动的任务会按需启动或复用 Appium（见脚本 `lib/device-bootstrap.js`）。 |
| **网络** | 设备为 `ip:port` 形式连接时需保证本机到该地址 **TCP 可达**（含云手机控制台映射端口）。 |

---

## 二、获取代码（Git Clone）

在本地任意工作目录打开终端（PowerShell / CMD / Git Bash），执行：

```bash
git clone <你的仓库地址>
cd appium
```

将 `<你的仓库地址>` 替换为实际远程地址，例如：

- HTTPS：`https://github.com/your-org/your-repo.git`
- SSH：`git@github.com:your-org/your-repo.git`

克隆完成后，当前目录应为项目根目录（能看到 `package.json`、`device-panel-server.js` 等文件）。

---

## 三、安装依赖（npm install）

在项目根目录执行：

```bash
npm install
```

说明：

- 会安装 **Appium 3**、`appium-uiautomator2-driver`、`webdriverio`、`xlsx` 等依赖。
- 若安装 **`electron` 等可选依赖** 时网络超时，可多试几次或使用国内 npm 镜像（自行配置 `registry`）。
- 安装完成后应存在目录 `node_modules/`。

---

## 四、启动设备面板（npm run panel）

在项目根目录执行：

```bash
npm run panel
```

等价命令：

```bash
node device-panel-server.js
```

### 4.1 访问地址

- 默认监听：**`0.0.0.0:5188`**（允许局域网内其他电脑访问）。
- 本机浏览器打开：**http://127.0.0.1:5188** 或 **http://localhost:5188**
- 终端会打印本机局域网 IP 列表，例如：`http://192.168.x.x:5188`，便于手机同网段调试。

### 4.2 环境变量（可选）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEVICE_PANEL_HOST` | `0.0.0.0` | 仅本机访问可设为 `127.0.0.1` |
| `DEVICE_PANEL_PORT` | `5188` | 修改面板 HTTP 端口 |

**Windows PowerShell 示例：**

```powershell
$env:DEVICE_PANEL_PORT="8080"; npm run panel
```

### 4.3 面板能做什么

打开 **`device-config.html`** 对应的多设备表格后，你可以：

- 填写每行 **endpoint**（格式 `ip:port`）、**adbPassword**、邮箱与 Google 密码（多行对应）。
- 顶部选择 **国家/区域**（如 **美国 US**、**墨西哥 MX**），再点击 **启动 / 二次启动**。
- 查看运行状态、停止任务、**刷新断开**（强制断开 ADB 等）。

具体 API 由 `device-panel-server.js` 提供（如 `/api/run`、`/api/status`、`/api/stop`）。

---

## 五、其他常用命令

| 命令 | 作用 |
|------|------|
| `npm run appium` | 单独启动 Appium Server（默认端口 4723，见 `package.json` 中脚本） |
| `npm run page` | 执行 `run-page.js`（单页/步骤调试入口，需按该脚本要求传参） |

**仅跑生日相关脚本（命令行示例）：**

```bash
node birthday-only.js "124.236.70.143:22330 你的adbShell密码"
```

环境变量可设 `APPIUM_PORT` 指定 Appium 端口（默认 4723）。

**主注册脚本（命令行，需完整参数）：**

```bash
node script.js "ip:port adbPassword email googlePassword"
```

墨西哥区对应入口为 **`script-mx.js`** / **`script-second-mx.js`**（参数格式与 `script.js` 相同；区域差异由脚本内部页面模块区分）。

---

## 六、目录与文件速览

| 路径 | 说明 |
|------|------|
| `device-panel-server.js` | 多设备面板 HTTP 服务 |
| `device-config.html` | 面板前端页面 |
| `script.js` / `script-second.js` | 美区主流程 / 二次流程入口 |
| `script-mx.js` / `script-second-mx.js` | 墨西哥区主流程 / 二次流程入口 |
| `birthday-only.js` | 仅生日相关步骤 |
| `appium-script.js` | 美区 Appium 流程编排 |
| `appium-script-mx.js` | 墨西哥区流程编排 |
| `pages/` | 各页面操作步骤（含 `*-mx.js` 墨西哥专用页） |
| `lib/` | 公共工具、会话、设备引导等 |
| `platform-tools/` | Windows 下 `adb.exe` 等 |
| `logs/` | 面板任务日志（运行后自动生成） |

更详细的**接入主项目**说明可参考根目录 **`INTEGRATION_HANDOFF.md`**（若存在）。

---

## 七、常见问题（FAQ）

### 1. 面板打不开或页面空白

- 确认 **`npm run panel` 已成功启动**且无端口占用报错。
- 请使用终端打印的 **http 地址** 打开，不要混用旧进程端口。
- 若从其他机器访问，检查防火墙是否放行 **`DEVICE_PANEL_PORT`**。

### 2. `npm install` 失败

- 检查 Node 版本是否过旧。
- 公司网络若拦截 npm registry，需配置代理或镜像后重试。

### 3. 任务启动后一直失败 / ADB 连不上

- 确认 **endpoint** 为 `host:port`，且云手机侧 ADB 已开启。
- 确认 **adbPassword** 与云手机 shell 鉴权一致。
- 确认本机 **`platform-tools/adb.exe`** 存在且未被安全软件拦截。

### 4. Appium 相关报错

- 可先单独执行 `npm run appium`，再在同一环境运行脚本或面板任务。
- 查看 `logs/` 下对应任务日志文件辅助排查。

### 5. 选择墨西哥（MX）后提示找不到脚本文件

- 确认仓库内存在 **`script-mx.js`**、**`script-second-mx.js`**（由 `device-panel-server.js` 映射）。

---

## 八、建议的新用户上手顺序

1. `git clone` → `cd` 进入项目目录  
2. `npm install`  
3. `npm run panel` → 浏览器打开 **http://127.0.0.1:5188**  
4. 在面板中新增一行，填入测试设备的 **endpoint**、**adbPassword**、账号信息  
5. 选择 **国家**，点击 **启动**，观察状态与 `logs/` 日志  
6. 需要时再阅读 **`pages/`** 与 **`appium-script*.js`** 做流程定制  

---

## 九、许可与贡献

- 许可证见 `package.json` 中 `license` 字段（当前为 `ISC`）。
- 提交代码前建议本地跑通 `npm run panel` 与一条完整设备任务。

如有文档遗漏，可在 Issue 中补充场景，便于持续完善本文档。
