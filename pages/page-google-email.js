const { isUiAutomator2CrashedError } = require("../lib/appium-shared");

async function inputGoogleAccount(driver, account) {
  const nativeSelectors = [
    'android=new UiSelector().resourceId("identifierId")',
    'android=new UiSelector().className("android.widget.EditText")',
    '//*[@resource-id="identifierId" and contains(@class,"EditText")]',
    '//*[@class="android.widget.EditText"]'
  ];
  const webviewSelectors = [
    'input[type="email"]',
    '#identifierId',
    'input[name="identifier"]'
  ];
  const timeoutMs = 90000;
  const pollIntervalMs = 2000;
  const endTime = Date.now() + timeoutMs;
  let lastError;
  let loopCount = 0;

  async function tryInputByNativeSelectors() {
    for (const selector of nativeSelectors) {
      const elements = await driver.$$(selector);
      for (const element of elements) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (!exists || !displayed) {
          continue;
        }

        const className = String((await element.getAttribute("class")) || "");
        const resourceId = String((await element.getAttribute("resource-id")) || "");
        const isEditText =
          className.includes("EditText") ||
          resourceId.endsWith(":id/identifierId") ||
          resourceId === "identifierId";
        if (!isEditText) {
          continue;
        }

        await element.click();
        await driver.pause(300);
        await element.clearValue();
        await element.setValue(account);
        console.log(`已在 Email or phone 输入账号: ${account} (native: ${selector})`);
        return true;
      }
    }
    return false;
  }

  async function tryInputByWebViewSelectors() {
    const contexts = await driver.getContexts();
    const webviewContext = contexts.find((ctx) => ctx.toUpperCase().includes("WEBVIEW"));
    if (!webviewContext) {
      return false;
    }

    const currentContext = await driver.getContext();
    try {
      await driver.switchContext(webviewContext);
      for (const selector of webviewSelectors) {
        const elements = await driver.$$(selector);
        for (const element of elements) {
          const displayed = await element.isDisplayed();
          if (!displayed) {
            continue;
          }

          await element.click();
          await element.clearValue();
          await element.setValue(account);
          console.log(`已在 Email or phone 输入账号: ${account} (webview: ${selector})`);
          return true;
        }
      }
      return false;
    } finally {
      await driver.switchContext(currentContext);
    }
  }

  while (Date.now() < endTime) {
    try {
      if (await tryInputByNativeSelectors()) {
        return;
      }
      if (await tryInputByWebViewSelectors()) {
        return;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error(
          `UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：输入Google账号）。`
        );
      }
      lastError = err;
    }

    loopCount += 1;
    if (loopCount % 5 === 0) {
      console.log("仍在等待输入框，已尝试 native/webview 输入框定位...");
    }
    console.log("等待 Google 账号输入框出现...");
    await driver.pause(pollIntervalMs);
  }

  throw new Error(
    [
      "未找到 Google 的 Email or phone 输入框。",
      `已等待约 ${Math.floor(timeoutMs / 1000)} 秒。`,
      `最后错误: ${String(lastError?.message || "未知错误")}`
    ].join("\n")
  );
}

module.exports = { inputGoogleAccount };
