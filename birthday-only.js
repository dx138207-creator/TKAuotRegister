const { runBirthdaySelectionOnly } = require("./appium-script");
const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");

const APPIUM_HOST = "127.0.0.1";
const APPIUM_PORT = Number(process.env.APPIUM_PORT || 4723);
const LOCAL_ADB_PATH = path.join(process.cwd(), "platform-tools", "adb.exe");
const execAsync = promisify(exec);
const STEP_TIMEOUT_MS = 90000;
const ADB_AUTH_TIMEOUT_MS = 4000;
const ADB_AUTH_RETRY_TIMEOUT_MS = 8000;
const ADB_AUTH_FINAL_TIMEOUT_MS = 20000;
const ADB_PROBE_TIMEOUT_MS = 5000;

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

function quoteIfNeeded(filePath) {
  return filePath.includes(" ") ? `"${filePath}"` : filePath;
}

function resolveAdbCommand() {
  if (fs.existsSync(LOCAL_ADB_PATH)) {
    return LOCAL_ADB_PATH;
  }
  throw new Error(
    [
      "未找到本地 ADB：platform-tools/adb.exe",
      `期望路径: ${LOCAL_ADB_PATH}`
    ].join("\n")
  );
}

function parseInput() {
  const raw = process.argv.slice(2).join(" ").trim();
  if (!raw) {
    throw new Error(
      [
        "请在启动时输入: ip:port adbPassword",
        '示例: node birthday-only.js "124.236.70.143:22330 IcHFsHOh"'
      ].join("\n")
    );
  }

  const parts = raw.split(/\s+/);
  if (parts.length !== 2) {
    throw new Error("输入格式错误，请使用: ip:port adbPassword");
  }

  const [endpoint, adbPassword] = parts;
  const endpointParts = endpoint.split(":");
  if (endpointParts.length !== 2) {
    throw new Error("ip:port 格式错误，请检查输入。");
  }

  const [host, portText] = endpointParts;
  const port = Number(portText);
  if (!host || !Number.isInteger(port) || port <= 0) {
    throw new Error("ip:port 格式错误，请检查输入。");
  }

  return { udid: `${host}:${port}`, adbPassword };
}

async function adbConnectAndAuth(udid, adbPassword) {
  const adbCmd = resolveAdbCommand();
  const connectCmd = `${quoteIfNeeded(adbCmd)} connect ${udid}`;
  const disconnectCmd = `${quoteIfNeeded(adbCmd)} disconnect ${udid}`;
  const authCmd = `${quoteIfNeeded(adbCmd)} -s ${udid} shell ${adbPassword}`;
  const probeCmd = `${quoteIfNeeded(adbCmd)} -s ${udid} shell getprop ro.build.version.sdk`;

  console.log(`执行: ${connectCmd}`);
  const { stdout: cOut, stderr: cErr } = await execAsync(connectCmd);
  const connectOutput = `${cOut || ""}${cErr || ""}`.trim();
  console.log("adb connect 输出:", connectOutput || "(空)");

  if (
    !/connected to|already connected to|successful/i.test(connectOutput) &&
    !/connected/i.test(connectOutput)
  ) {
    throw new Error(`adb connect 结果异常: ${connectOutput}`);
  }

  console.log(`执行 ADB Shell 鉴权: ${authCmd}`);
  async function runAuthOnce(timeoutMs) {
    let output = "";
    let timeoutHit = false;
    try {
      const { stdout, stderr } = await execAsync(authCmd, { timeout: timeoutMs });
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
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const inlineProbeCmd = `${quoteIfNeeded(adbCmd)} -s ${udid} shell "${adbPassword};getprop ro.build.version.sdk"`;
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

async function main() {
  const { udid, adbPassword } = parseInput();
  await runStep("ADB连接与鉴权", () => adbConnectAndAuth(udid, adbPassword));
  await runStep("执行生日模块", () =>
    runBirthdaySelectionOnly({
      host: APPIUM_HOST,
      port: APPIUM_PORT,
      udid
    })
  );
}

main().catch((err) => {
  console.error("生日模块测试失败:", err);
  process.exit(1);
});
