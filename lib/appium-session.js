const { remote } = require("webdriverio");
const {
  CANDIDATE_PATHS,
  SESSION_CREATE_RETRY_ROUNDS,
  SESSION_CREATE_RETRY_INTERVAL_MS,
  isBasePathMismatchError
} = require("./appium-shared");

function createCapabilities(udid) {
  return {
    platformName: "Android",
    "appium:automationName": "UiAutomator2",
    "appium:deviceName": "cloud-phone",
    "appium:udid": udid,
    "appium:noReset": true,
    "appium:newCommandTimeout": 300
  };
}

async function connectWithPath(path, host, port, capabilities) {
  return remote({
    protocol: "http",
    hostname: host,
    port,
    path,
    capabilities,
    logLevel: "info"
  });
}

async function createSession(host, port, udid) {
  const capabilities = createCapabilities(udid);
  let driver;
  let bestError;

  for (let round = 1; round <= SESSION_CREATE_RETRY_ROUNDS; round++) {
    for (const path of CANDIDATE_PATHS) {
      try {
        console.log(`尝试 Appium: http://${host}:${port}${path} (第${round}/${SESSION_CREATE_RETRY_ROUNDS}轮)`);
        driver = await connectWithPath(path, host, port, capabilities);
        console.log("连接成功，sessionId:", driver.sessionId);
        return driver;
      } catch (err) {
        const isWdHubFallbackError = path === "/wd/hub" && isBasePathMismatchError(err);
        if (!bestError || !isWdHubFallbackError) {
          bestError = err;
        }
        console.log(`路径 ${path} 连接失败: ${err.message}`);
      }
    }
    if (round < SESSION_CREATE_RETRY_ROUNDS) {
      await new Promise((resolve) => setTimeout(resolve, SESSION_CREATE_RETRY_INTERVAL_MS));
    }
  }

  const message = String(bestError?.message || "");
  if (/Could not find a driver for automationName 'UiAutomator2'/i.test(message)) {
    throw new Error(
      [
        "本地 Appium 未安装 UiAutomator2 驱动。",
        "请先执行：appium driver install uiautomator2",
        "安装后重试：node script.js \"ip:port adbPassword email googlePassword\""
      ].join("\n")
    );
  }
  if (/Neither ANDROID_HOME nor ANDROID_SDK_ROOT environment variable was exported/i.test(message)) {
    throw new Error(
      [
        "Appium 进程缺少 Android SDK 环境变量。",
        "请在启动 Appium 的同一终端先设置：",
        "PowerShell:",
        `$env:ANDROID_HOME="${process.cwd()}"`,
        `$env:ANDROID_SDK_ROOT="${process.cwd()}"`,
        "然后再启动 Appium 并执行：node script.js \"ip:port adbPassword email googlePassword\""
      ].join("\n")
    );
  }
  throw new Error(
    [
      "无法创建设备会话，请检查本地 Appium 服务、ADB 连接和能力参数。",
      `最后错误: ${message || "未知错误"}`
    ].join("\n")
  );
}

module.exports = {
  createSession,
  createCapabilities,
  connectWithPath
};
