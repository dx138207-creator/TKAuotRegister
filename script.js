const { parseDeviceInput } = require("./lib/parse-device-args");
const {
  APPIUM_HOST,
  APPIUM_PORT,
  runStep,
  ensureAppiumServer,
  stopAppiumServerIfNeeded,
  adbConnect,
  adbShellAuth,
  adbDisconnect,
  runAppiumMainWithRetry
} = require("./lib/device-bootstrap");

async function main() {
  const device = parseDeviceInput(process.argv.slice(2));
  let appiumState = null;

  try {
    await runStep("启动或复用Appium服务", async () => {
      appiumState = await ensureAppiumServer(APPIUM_HOST, APPIUM_PORT);
    });
    await runStep("ADB连接", () => adbConnect(device.udid));
    await runStep("ADB鉴权", () => adbShellAuth(device.udid, device.adbPassword));
    console.log("[开始] 执行Appium主流程");
    await runAppiumMainWithRetry(device);
    console.log("[完成] 执行Appium主流程");
  } finally {
    stopAppiumServerIfNeeded(appiumState);
    await runStep("断开ADB连接", () => adbDisconnect(device.udid));
  }
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(1);
});
