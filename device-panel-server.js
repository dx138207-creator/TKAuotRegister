const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, exec } = require("child_process");
const { promisify } = require("util");
const net = require("net");

/** 默认 0.0.0.0 以便局域网访问；仅本机可设 DEVICE_PANEL_HOST=127.0.0.1 */
const HOST = process.env.DEVICE_PANEL_HOST || "0.0.0.0";
const PORT = Number(process.env.DEVICE_PANEL_PORT || 5188);
const ROOT = __dirname;
const HTML_FILE = path.join(ROOT, "device-config.html");
const XLSX_FILE = path.join(ROOT, "node_modules", "xlsx", "dist", "xlsx.full.min.js");
const SCRIPT_FILE = path.join(ROOT, "script.js");
const SCRIPT_SECOND_FILE = path.join(ROOT, "script-second.js");
const LOCAL_ADB_PATH = path.join(ROOT, "platform-tools", "adb.exe");
const LOGS_DIR = path.join(ROOT, "logs");
const APPIUM_PORT_BASE = Number(process.env.APPIUM_PORT_BASE || 4720);
const APPIUM_PORT_MAX = Number(process.env.APPIUM_PORT_MAX || 4899);

const runs = new Map();
const reservedPorts = new Set();
const execAsync = promisify(exec);

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString("utf8");
      if (data.length > 2 * 1024 * 1024) {
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function validateDevice(device) {
  if (!device || typeof device !== "object") {
    return "设备参数缺失";
  }
  if (!/^[^:]+:\d+$/.test(String(device.endpoint || ""))) {
    return "endpoint 格式错误，应为 ip:port";
  }
  if (!String(device.adbPassword || "").trim()) {
    return "adbPassword 不能为空";
  }
  if (!String(device.email || "").trim()) {
    return "email 不能为空";
  }
  if (!String(device.googlePassword || "").trim()) {
    return "googlePassword 不能为空";
  }
  return null;
}

function removeAnsi(text) {
  return String(text || "").replace(/\u001b\[[0-9;]*m/g, "");
}

function updateRuntimeStatus(run, textChunk) {
  const lines = removeAnsi(textChunk)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    run.lastLogLine = line;
    if (/^\[开始\]/.test(line)) {
      run.runtimeStatus = line;
      continue;
    }
    if (/^等待.+/.test(line)) {
      run.runtimeStatus = line;
      continue;
    }
    if (/^\[完成\]/.test(line)) {
      run.runtimeStatus = line;
      continue;
    }
    if (/脚本执行失败|Error:/i.test(line)) {
      run.runtimeStatus = line;
      continue;
    }
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, HOST, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findFreePort() {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const port = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on("error", reject);
      server.listen(0, HOST, () => {
        const addr = server.address();
        const p = typeof addr === "object" && addr ? Number(addr.port) : 0;
        server.close(() => resolve(p));
      });
    });
    if (!Number.isInteger(port) || port <= 0) {
      continue;
    }
    if (reservedPorts.has(port)) {
      continue;
    }
    reservedPorts.add(port);
    return port;
  }
  throw new Error("未能获取系统空闲端口，请稍后重试。");
}

function resolveScriptByRunMode(runMode) {
  if (runMode === "register-second") {
    return SCRIPT_SECOND_FILE;
  }
  return SCRIPT_FILE;
}

async function createRun(device, runMode = "register") {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const appiumPort = await findFreePort();

  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeEndpoint = String(device.endpoint).replace(/[:/\\]/g, "_");
  const logFile = path.join(LOGS_DIR, `${timestamp}_${safeEndpoint}_p${appiumPort}.log`);

  const scriptFile = resolveScriptByRunMode(runMode);
  if (!fs.existsSync(scriptFile)) {
    reservedPorts.delete(appiumPort);
    throw new Error(`未找到脚本文件: ${path.basename(scriptFile)}（runMode=${runMode}）`);
  }

  const args = [
    scriptFile,
    device.endpoint,
    device.adbPassword,
    device.email,
    device.googlePassword
  ];

  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      APPIUM_PORT: String(appiumPort),
      APPIUM_KEEP_SERVER: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const state = {
    id,
    runMode,
    endpoint: device.endpoint,
    appiumPort,
    logFile,
    pid: child.pid,
    status: "running",
    exitCode: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    runtimeStatus: "进程已启动，等待脚本输出...",
    lastLogLine: ""
  };
  runs.set(id, state);

  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  logStream.write(`=== 单设备启动 ===\n`);
  logStream.write(`runMode=${runMode}\nendpoint=${device.endpoint}\nappiumPort=${appiumPort}\n`);
  logStream.write(`startedAt=${state.startedAt}\n\n`);

  child.stdout.on("data", (chunk) => {
    logStream.write(chunk);
    updateRuntimeStatus(state, chunk.toString("utf8"));
  });
  child.stderr.on("data", (chunk) => {
    logStream.write(chunk);
    updateRuntimeStatus(state, chunk.toString("utf8"));
  });
  child.on("error", (err) => {
    logStream.write(`\n[child_error] ${String(err?.message || err)}\n`);
    state.runtimeStatus = `子进程异常: ${String(err?.message || err)}`;
  });
  child.on("exit", (code) => {
    state.status = "finished";
    state.exitCode = code ?? -1;
    state.endedAt = new Date().toISOString();
    reservedPorts.delete(appiumPort);
    state.runtimeStatus = state.exitCode === 0 ? "任务已完成" : "任务已失败";
    logStream.write(`\n=== 单设备结束 ===\nexit=${state.exitCode}\nendedAt=${state.endedAt}\n`);
    logStream.end();
  });

  return state;
}

async function stopRunById(id) {
  const run = runs.get(id);
  if (!run) {
    return { ok: false, statusCode: 404, error: "未找到任务" };
  }
  if (run.status !== "running") {
    return { ok: true, statusCode: 200, run };
  }
  if (!run.pid) {
    return { ok: false, statusCode: 400, error: "任务缺少 PID，无法终止" };
  }

  try {
    if (process.platform === "win32") {
      await execAsync(`taskkill /PID ${run.pid} /T /F`);
    } else {
      process.kill(run.pid, "SIGTERM");
    }
    await forceReleasePort(run.appiumPort);
    reservedPorts.delete(run.appiumPort);
    run.status = "stopping";
    return { ok: true, statusCode: 200, run };
  } catch (err) {
    const msg = String(err?.message || err);
    if (/not found|no such process|not running|cannot find/i.test(msg)) {
      await forceReleasePort(run.appiumPort);
      reservedPorts.delete(run.appiumPort);
      run.status = "finished";
      run.exitCode = run.exitCode ?? -1;
      run.endedAt = run.endedAt || new Date().toISOString();
      return { ok: true, statusCode: 200, run };
    }
    return { ok: false, statusCode: 500, error: `终止失败: ${msg}` };
  }
}

function quoteIfNeeded(filePath) {
  return String(filePath).includes(" ") ? `"${filePath}"` : String(filePath);
}

async function forceReleasePort(port) {
  const p = Number(port);
  if (!Number.isInteger(p) || p <= 0) {
    return "无有效端口，跳过强制释放。";
  }
  if (process.platform === "win32") {
    try {
      const { stdout } = await execAsync(`netstat -ano -p tcp | findstr :${p}`);
      const lines = String(stdout || "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const pids = [...new Set(lines.map((line) => Number(line.split(/\s+/).pop())).filter(Number.isInteger))];
      for (const pid of pids) {
        try {
          await execAsync(`taskkill /PID ${pid} /T /F`);
        } catch (_) {
        }
      }
      return pids.length ? `已尝试结束占用端口 ${p} 的进程: ${pids.join(",")}` : `端口 ${p} 未发现占用`;
    } catch (_) {
      return `端口 ${p} 未发现占用`;
    }
  }
  try {
    const { stdout } = await execAsync(`lsof -ti tcp:${p}`);
    const pids = String(stdout || "")
      .split(/\r?\n/)
      .map((s) => Number(String(s).trim()))
      .filter(Number.isInteger);
    for (const pid of [...new Set(pids)]) {
      try {
        process.kill(pid, "SIGKILL");
      } catch (_) {
      }
    }
    return pids.length ? `已尝试结束占用端口 ${p} 的进程` : `端口 ${p} 未发现占用`;
  } catch (_) {
    return `端口 ${p} 未发现占用`;
  }
}

async function forceDisconnectEndpoint(endpoint) {
  const ep = String(endpoint || "").trim();
  if (!ep) {
    return "未提供 endpoint，已跳过 ADB 断开。";
  }
  if (!/^[^:]+:\d+$/.test(ep)) {
    return `endpoint 格式无效: ${ep}`;
  }
  if (!fs.existsSync(LOCAL_ADB_PATH)) {
    return `未找到本地 ADB，跳过断开: ${LOCAL_ADB_PATH}`;
  }
  const cmd = `${quoteIfNeeded(LOCAL_ADB_PATH)} disconnect ${ep}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 10000 });
    return `${stdout || ""}${stderr || ""}`.trim() || "(空输出)";
  } catch (err) {
    const output = `${err.stdout || ""}${err.stderr || ""}`.trim();
    if (output) {
      return output;
    }
    return `执行 adb disconnect 失败: ${String(err?.message || err)}`;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname =
    url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;

  if (req.method === "GET" && (pathname === "/" || pathname === "/device-config.html")) {
    try {
      const html = fs.readFileSync(HTML_FILE, "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (err) {
      json(res, 500, { error: String(err?.message || err) });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/vendor/xlsx.min.js") {
    try {
      const content = fs.readFileSync(XLSX_FILE);
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end(content);
    } catch (err) {
      json(res, 500, { error: `读取 xlsx 失败: ${String(err?.message || err)}` });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/run") {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");
      const device = payload.device || {};
      const runMode = String(payload.runMode || "register");
      const validationError = validateDevice(device);
      if (validationError) {
        json(res, 400, { error: validationError });
        return;
      }
      if (!["register", "register-second"].includes(runMode)) {
        json(res, 400, { error: `不支持的 runMode: ${runMode}` });
        return;
      }

      const run = await createRun(device, runMode);
      json(res, 200, {
        id: run.id,
        runMode: run.runMode,
        status: run.status,
        endpoint: run.endpoint,
        appiumPort: run.appiumPort,
        logFile: run.logFile,
        pid: run.pid
      });
    } catch (err) {
      json(res, 500, { error: String(err?.message || err) });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/status") {
    const id = url.searchParams.get("id");
    const run = id ? runs.get(id) : null;
    if (!run) {
      json(res, 404, { error: "未找到任务" });
      return;
    }
    json(res, 200, run);
    return;
  }

  if (req.method === "POST" && pathname === "/api/stop") {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");
      const id = String(payload.id || "").trim();
      if (!id) {
        json(res, 400, { error: "id 不能为空" });
        return;
      }
      const result = await stopRunById(id);
      if (!result.ok) {
        json(res, result.statusCode, { error: result.error });
        return;
      }
      json(res, 200, result.run);
    } catch (err) {
      json(res, 500, { error: String(err?.message || err) });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/force-disconnect") {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");
      const id = String(payload.id || "").trim();
      const endpoint = String(payload.endpoint || "").trim();

      let stopResult = null;
      let forcePortResult = null;
      if (id) {
        stopResult = await stopRunById(id);
        if (stopResult?.run?.appiumPort) {
          forcePortResult = await forceReleasePort(stopResult.run.appiumPort);
          reservedPorts.delete(stopResult.run.appiumPort);
        }
      }
      const adbDisconnectOutput = await forceDisconnectEndpoint(endpoint);
      if (stopResult?.ok && stopResult.run?.id) {
        const run = runs.get(stopResult.run.id);
        if (run && run.status === "stopping") {
          run.status = "finished";
          run.exitCode = run.exitCode ?? -1;
          run.endedAt = run.endedAt || new Date().toISOString();
          run.runtimeStatus = "已由刷新断开结束";
        }
      }
      json(res, 200, {
        ok: true,
        id: id || null,
        endpoint: endpoint || null,
        stopResult,
        forcePortResult,
        adbDisconnectOutput
      });
    } catch (err) {
      json(res, 500, { error: String(err?.message || err) });
    }
    return;
  }

  json(res, 404, { error: "Not found" });
});

function logLanAccessHints() {
  if (HOST !== "0.0.0.0" && HOST !== "::") {
    return;
  }
  const lines = [];
  for (const list of Object.values(os.networkInterfaces())) {
    if (!list) {
      continue;
    }
    for (const iface of list) {
      const fam = iface.family;
      if (fam !== "IPv4" && fam !== 4) {
        continue;
      }
      if (iface.internal) {
        continue;
      }
      lines.push(`  http://${iface.address}:${PORT}`);
    }
  }
  if (lines.length) {
    console.log("局域网内可用本机 IP 访问（任选其一）:");
    console.log(lines.join("\n"));
  }
}

server.listen(PORT, HOST, () => {
  console.log(`设备面板监听: ${HOST}:${PORT}`);
  if (HOST === "0.0.0.0" || HOST === "::") {
    console.log(`本机浏览器: http://127.0.0.1:${PORT}`);
    logLanAccessHints();
  } else {
    console.log(`浏览器打开: http://${HOST}:${PORT}`);
  }
  console.log("打开页面后可在每一行点击“注册 / 二次注册”。");
});
