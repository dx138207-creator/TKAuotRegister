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
const { runSingleAppiumPageStep, formatPageStepsList } = require("./appium-script");

function printHelp(exitCode = 0) {
  console.log(`用法: node run-page.js <步骤ID> ip:port adbPassword email googlePassword
  或: npm run page -- <步骤ID> ip:port adbPassword email googlePassword

列出全部步骤 ID:
  node run-page.js --list

步骤 ID 与主流程中的页面对应，请先将设备置于该步骤开始前的界面再执行。
`);
  console.log("可用步骤 ID:\n");
  console.log(formatPageStepsList());
  console.log("");
  process.exit(exitCode);
}

async function main() {
  const stepId = process.argv[2];
  if (!stepId) {
    printHelp(1);
  }
  if (stepId === "--list" || stepId === "-h" || stepId === "--help") {
    printHelp(0);
  }

  const device = parseDeviceInput(process.argv.slice(3));
  let appiumState = null;

  try {
    await runStep("启动或复用Appium服务", async () => {
      appiumState = await ensureAppiumServer(APPIUM_HOST, APPIUM_PORT);
    });
    await runStep("ADB连接", () => adbConnect(device.udid));
    await runStep("ADB鉴权", () => adbShellAuth(device.udid, device.adbPassword));
    console.log(`[单步] 开始页面步骤: ${stepId}`);
    await runSingleAppiumPageStep({
      host: APPIUM_HOST,
      port: APPIUM_PORT,
      udid: device.udid,
      email: device.email,
      googlePassword: device.googlePassword,
      stepId
    });
    console.log(`[单步] 完成: ${stepId}`);
  } finally {
    stopAppiumServerIfNeeded(appiumState);
    await runStep("断开ADB连接", () => adbDisconnect(device.udid));
  }
}

main().catch((err) => {
  console.error("单步脚本执行失败:", err);
  process.exit(1);
});
