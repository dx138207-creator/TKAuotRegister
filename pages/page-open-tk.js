const { TK_APP_IDS } = require("../lib/appium-shared");

async function openTkApp(driver) {
  let lastError;

  for (const appId of TK_APP_IDS) {
    try {
      console.log(`尝试打开 TK: ${appId}`);
      await driver.activateApp(appId);
      console.log(`已打开 TK 应用: ${appId}`);
      return;
    } catch (err) {
      lastError = err;
      console.log(`打开 TK ${appId} 失败: ${err.message}`);
    }
  }

  throw new Error(
    [
      "未能打开 TK 应用，请确认云手机安装了 TikTok。",
      `已尝试: ${TK_APP_IDS.join(", ")}`,
      `最后错误: ${String(lastError?.message || "未知错误")}`
    ].join("\n")
  );
}


module.exports = { openTkApp };
