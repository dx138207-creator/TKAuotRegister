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
const { runAppiumSecondScript } = require("./appium-script");

async function main() {
  const device = parseDeviceInput(process.argv.slice(2));
  let appiumState = null;

  try {
    await runStep("启动或复用Appium服务", async () => {
      appiumState = await ensureAppiumServer(APPIUM_HOST, APPIUM_PORT);
    });
    await runStep("ADB连接", () => adbConnect(device.udid));
    await runStep("ADB鉴权", () => adbShellAuth(device.udid, device.adbPassword));
    console.log("[开始] 执行二次注册主流程（从Continue with Google开始）");
    await runAppiumSecondScript({
      host: APPIUM_HOST,
      port: APPIUM_PORT,
      udid: device.udid,
      email: device.email,
      googlePassword: device.googlePassword
    });
    console.log("[完成] 执行二次注册主流程");
  } finally {
    stopAppiumServerIfNeeded(appiumState);
    await runStep("断开ADB连接", () => adbDisconnect(device.udid));
  }
}

main().catch((err) => {
  console.error("二次注册脚本执行失败:", err);
  process.exit(1);
});
