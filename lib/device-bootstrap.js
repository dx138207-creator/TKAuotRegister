const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { runAppiumScript } = require("../appium-script");

const APPIUM_HOST = "127.0.0.1";
const APPIUM_PORT = Number(process.env.APPIUM_PORT || 4723);
const LOCAL_ADB_PATH = path.join(process.cwd(), "platform-tools", "adb.exe");
const LOCAL_APPIUM_CMD_WIN = path.join(process.cwd(), "node_modules", ".bin", "appium.cmd");
const LOCAL_APPIUM_CMD_UNIX = path.join(process.cwd(), "node_modules", ".bin", "appium");
const KEEP_APPIUM_SERVER = process.env.APPIUM_KEEP_SERVER === "1";

const execAsync = promisify(exec);
const STEP_TIMEOUT_MS = 90000;
const ADB_AUTH_TIMEOUT_MS = 8000;
const ADB_AUTH_RETRY_TIMEOUT_MS = 8000;
const ADB_AUTH_FINAL_TIMEOUT_MS = 20000;
const ADB_PROBE_TIMEOUT_MS = 5000;
const MAIN_FLOW_MAX_ATTEMPTS = 2;

async function runStep(stepName, stepFn) {
  console.log(`[开始] ${stepName}`);
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => resolve("__STEP_TIMEOUT__"), STEP_TIMEOUT_MS);
  });

  const result = await Promise.race([
    stepFn().then(() => "__STEP_DONE__"),
    timeoutPromise
  ]);
  clearTimeout(timer);

  if (result === "__STEP_TIMEOUT__") {
    console.log(`[超时] ${stepName} 超过 ${STEP_TIMEOUT_MS / 1000}s，进入下一步`);
    return false;
  }
  console.log(`[完成] ${stepName}`);
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isAppiumReady(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host,
        port,
        path: "/status",
        timeout: timeoutMs
      },
      (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

function getAppiumStartupEnv() {
  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || process.cwd();
  return {
    ...process.env,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot
  };
}

function spawnAppium(command) {
  return spawn(command, { shell: true, stdio: "pipe", env: getAppiumStartupEnv() });
}

function quoteIfNeeded(filePath) {
  return filePath.includes(" ") ? `"${filePath}"` : filePath;
}

function resolveLocalAppiumCommand() {
  if (fs.existsSync(LOCAL_APPIUM_CMD_WIN)) {
    return quoteIfNeeded(LOCAL_APPIUM_CMD_WIN);
  }
  if (fs.existsSync(LOCAL_APPIUM_CMD_UNIX)) {
    return quoteIfNeeded(LOCAL_APPIUM_CMD_UNIX);
  }
  return null;
}

async function ensureAppiumServer(host, port) {
  const ready = await isAppiumReady(host, port);
  if (ready) {
    console.log(`Appium 已在运行: http://${host}:${port}`);
    return { startedByScript: false, process: null };
  }

  const localAppiumCmd = resolveLocalAppiumCommand();
  const commands = localAppiumCmd
    ? [`${localAppiumCmd} server -p ${port}`, `npx --no-install appium server -p ${port}`]
    : [`npx appium server -p ${port}`];
  let lastErrorText = "";

  for (const cmd of commands) {
    console.log(`尝试自动启动 Appium: ${cmd}`);
    const child = spawnAppium(cmd);
    let logs = "";

    child.stdout.on("data", (chunk) => {
      logs += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      logs += chunk.toString();
    });

    let exited = false;
    child.on("exit", () => {
      exited = true;
    });

    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const ok = await isAppiumReady(host, port);
      if (ok) {
        console.log(`Appium 自动启动成功: http://${host}:${port}`);
        return { startedByScript: true, process: child };
      }
      if (exited) {
        break;
      }
    }

    lastErrorText = logs.trim();
    try {
      child.kill();
    } catch (_) {
    }
  }

  throw new Error(
    `自动启动 Appium 失败（端口 ${port}）。请先执行 npm install，再手动执行 npx appium server -p ${port}\n${lastErrorText}`
  );
}

function stopAppiumServerIfNeeded(state) {
  if (!state?.startedByScript || !state?.process || KEEP_APPIUM_SERVER) {
    return;
  }
  try {
    state.process.kill();
    console.log("已关闭脚本自动启动的 Appium 进程");
  } catch (_) {
  }
}

function resolveAdbCommand() {
  if (fs.existsSync(LOCAL_ADB_PATH)) {
    return LOCAL_ADB_PATH;
  }

  throw new Error(
    [
      "未找到本地 ADB：platform-tools/adb.exe",
      `期望路径: ${LOCAL_ADB_PATH}`,
      "请将 Android platform-tools 解压到项目根目录的 platform-tools 文件夹后重试。"
    ].join("\n")
  );
}

function isUiAutomator2CrashError(err) {
  const message = String(err?.message || err || "");
  return /instrumentation process is not running|cannot be proxied to UiAutomator2/i.test(message);
}

async function adbConnect(udid) {
  const adbCmd = resolveAdbCommand();
  console.log(`执行: ${quoteIfNeeded(adbCmd)} connect ${udid}`);
  const { stdout, stderr } = await execAsync(`${quoteIfNeeded(adbCmd)} connect ${udid}`);
  const output = `${stdout || ""}${stderr || ""}`.trim();
  console.log("adb connect 输出:", output || "(空)");

  if (
    !/connected to|already connected to|successful/i.test(output) &&
    !/connected/i.test(output)
  ) {
    throw new Error(`adb connect 结果异常: ${output}`);
  }
}

async function adbShellAuth(udid, password) {
  const adbCmd = resolveAdbCommand();
  const connectCmd = `${quoteIfNeeded(adbCmd)} connect ${udid}`;
  const disconnectCmd = `${quoteIfNeeded(adbCmd)} disconnect ${udid}`;
  const command = `${quoteIfNeeded(adbCmd)} -s ${udid} shell ${password}`;
  console.log(`执行 ADB Shell 鉴权: ${command}`);

  async function runAuthOnce(timeoutMs) {
    let output = "";
    let timeoutHit = false;
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: timeoutMs });
      output = `${stdout || ""}${stderr || ""}`.trim();
    } catch (err) {
      output = `${err.stdout || ""}${err.stderr || ""}`.trim();
      timeoutHit = Boolean(err.killed) || /timed out|ETIMEDOUT|timeout/i.test(String(err.message || ""));
    }
    return { output, timeoutHit };
  }

  let auth = await runAuthOnce(ADB_AUTH_TIMEOUT_MS);
  console.log("adb shell 鉴权输出:", auth.output || "(空)");
  if (/:\/\s*#/i.test(auth.output)) {
    console.log("检测到 shell prompt，按规则视为鉴权成功，跳过后续重试。");
    return;
  }
  if (auth.timeoutHit) {
    console.log(`ADB Shell 鉴权超时(${ADB_AUTH_TIMEOUT_MS}ms)，执行一次延长重试(${ADB_AUTH_RETRY_TIMEOUT_MS}ms)...`);
    auth = await runAuthOnce(ADB_AUTH_RETRY_TIMEOUT_MS);
    console.log("adb shell 鉴权重试输出:", auth.output || "(空)");
    if (auth.timeoutHit) {
      console.log("二次鉴权仍超时，执行断开重连后做一次慢速鉴权...");
      try {
        await execAsync(disconnectCmd, { timeout: 5000 });
      } catch (_) {
      }
      try {
        await execAsync(connectCmd, { timeout: 12000 });
      } catch (_) {
      }
      auth = await runAuthOnce(ADB_AUTH_FINAL_TIMEOUT_MS);
      console.log("adb shell 慢速鉴权输出:", auth.output || "(空)");
    }
  }

  if (/inaccessible or not found/i.test(auth.output)) {
    throw new Error(`ADB Shell 鉴权口令不正确: ${auth.output}`);
  }
  if (/error:\s*closed|device offline|device unauthorized/i.test(auth.output)) {
    throw new Error(`ADB Shell 鉴权失败: ${auth.output}`);
  }

  const probeCmd = `${quoteIfNeeded(adbCmd)} -s ${udid} shell getprop ro.build.version.sdk`;
  for (let i = 1; i <= 3; i++) {
    try {
      const { stdout, stderr } = await execAsync(probeCmd, { timeout: ADB_PROBE_TIMEOUT_MS + 3000 });
      const probeOut = `${stdout || ""}${stderr || ""}`.trim();
      if (/^\d+$/.test(probeOut)) {
        console.log(`ADB Shell 探测通过，SDK=${probeOut}`);
        return;
      }
      if (probeOut) {
        console.log(`ADB Shell 探测返回非SDK值(第${i}次): ${probeOut}`);
      }
    } catch (_) {
    }
    await sleep(300);
  }

  const inlineProbeCmd = `${quoteIfNeeded(adbCmd)} -s ${udid} shell "${password};getprop ro.build.version.sdk"`;
  try {
    const { stdout, stderr } = await execAsync(inlineProbeCmd, { timeout: ADB_AUTH_FINAL_TIMEOUT_MS });
    const inlineOut = `${stdout || ""}${stderr || ""}`.trim();
    const sdkMatch = inlineOut.match(/(^|\n)\s*(\d+)\s*($|\n)/);
    if (sdkMatch && sdkMatch[2]) {
      console.log(`ADB Shell 组合探测通过，SDK=${sdkMatch[2]}`);
      return;
    }
    if (inlineOut) {
      console.log(`ADB Shell 组合探测输出: ${inlineOut}`);
    }
  } catch (_) {
  }

  throw new Error(
    [
      "ADB Shell 鉴权后探测失败，未拿到有效 SDK 版本。",
      "请检查 adbPassword 是否正确，或该设备是否允许后续 shell 命令执行。"
    ].join("\n")
  );
}

async function adbDisconnect(udid) {
  const adbCmd = resolveAdbCommand();
  const command = `${quoteIfNeeded(adbCmd)} disconnect ${udid}`;
  console.log(`执行: ${command}`);
  try {
    const { stdout, stderr } = await execAsync(command);
    const output = `${stdout || ""}${stderr || ""}`.trim();
    console.log("adb disconnect 输出:", output || "(空)");
  } catch (err) {
    const output = `${err.stdout || ""}${err.stderr || ""}`.trim();
    console.log("adb disconnect 输出:", output || "(空)");
  }
}

async function runAppiumMainWithRetry(device) {
  let lastError;
  for (let attempt = 1; attempt <= MAIN_FLOW_MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`执行 Appium 主流程，第 ${attempt}/${MAIN_FLOW_MAX_ATTEMPTS} 次`);
      await runAppiumScript({
        host: APPIUM_HOST,
        port: APPIUM_PORT,
        udid: device.udid,
        email: device.email,
        googlePassword: device.googlePassword
      });
      return;
    } catch (err) {
      lastError = err;
      if (!isUiAutomator2CrashError(err) || attempt >= MAIN_FLOW_MAX_ATTEMPTS) {
        throw err;
      }
      console.log("检测到 UiAutomator2 进程崩溃，执行一次快速重连后自动重试主流程...");
      await adbConnect(device.udid);
      await adbShellAuth(device.udid, device.adbPassword);
      await sleep(1200);
    }
  }
  throw lastError || new Error("执行 Appium 主流程失败");
}

module.exports = {
  APPIUM_HOST,
  APPIUM_PORT,
  runStep,
  sleep,
  ensureAppiumServer,
  stopAppiumServerIfNeeded,
  adbConnect,
  adbShellAuth,
  adbDisconnect,
  runAppiumMainWithRetry
};
