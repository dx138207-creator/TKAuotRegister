const { parseDeviceInput } = require("./lib/parse-device-args");
const {
  APPIUM_HOST,
  APPIUM_PORT,
  runStep,
  ensureAppiumServer,
  stopAppiumServerIfNeeded,
  adbConnect,
  adbShellAuth,
  adbDisconnect
} = require("./lib/device-bootstrap");
const { runAppiumScriptMx } = require("./appium-script-mx");

const MAIN_FLOW_MAX_ATTEMPTS = 2;

function isUiAutomator2CrashError(err) {
  const message = String(err?.message || err || "");
  return /instrumentation process is not running|cannot be proxied to UiAutomator2/i.test(message);
}

async function runAppiumMainWithRetryMx(device) {
  let lastError;
  for (let attempt = 1; attempt <= MAIN_FLOW_MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`执行墨西哥 Appium 主流程，第 ${attempt}/${MAIN_FLOW_MAX_ATTEMPTS} 次`);
      await runAppiumScriptMx({
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
      console.log("检测到 UiAutomator2 进程崩溃，执行快速重连并重试墨西哥主流程...");
      await adbConnect(device.udid);
      await adbShellAuth(device.udid, device.adbPassword);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  throw lastError || new Error("执行墨西哥 Appium 主流程失败");
}

async function main() {
  const device = parseDeviceInput(process.argv.slice(2));
  let appiumState = null;

  try {
    await runStep("启动或复用Appium服务", async () => {
      appiumState = await ensureAppiumServer(APPIUM_HOST, APPIUM_PORT);
    });
    await runStep("ADB连接", () => adbConnect(device.udid));
    await runStep("ADB鉴权", () => adbShellAuth(device.udid, device.adbPassword));
    console.log("[开始] 执行墨西哥Appium主流程");
    await runAppiumMainWithRetryMx(device);
    console.log("[完成] 执行墨西哥Appium主流程");
  } finally {
    stopAppiumServerIfNeeded(appiumState);
    await runStep("断开ADB连接", () => adbDisconnect(device.udid));
  }
}

main().catch((err) => {
  console.error("墨西哥脚本执行失败:", err);
  process.exit(1);
});
