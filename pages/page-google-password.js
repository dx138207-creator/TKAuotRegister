const { TK_APP_IDS, isUiAutomator2CrashedError } = require("../lib/appium-shared");

async function isPasswordPageVisible(driver) {
  const nativeSelectors = [
    'android=new UiSelector().textContains("Enter your password")',
    'android=new UiSelector().textContains("Show password")',
    'android=new UiSelector().resourceId("password")'
  ];

  for (const selector of nativeSelectors) {
    const elements = await driver.$$(selector);
    for (const element of elements) {
      const exists = await element.isExisting();
      const displayed = exists ? await element.isDisplayed() : false;
      if (exists && displayed) {
        return true;
      }
    }
  }

  const contexts = await driver.getContexts();
  const webviewContext = contexts.find((ctx) => ctx.toUpperCase().includes("WEBVIEW"));
  if (!webviewContext) {
    return false;
  }

  const currentContext = await driver.getContext();
  try {
    await driver.switchContext(webviewContext);
    const webviewElements = await driver.$$('input[type="password"], input[name="Passwd"]');
    for (const element of webviewElements) {
      const displayed = await element.isDisplayed();
      if (displayed) {
        return true;
      }
    }
    return false;
  } finally {
    await driver.switchContext(currentContext);
  }
}

async function waitForPasswordPageBeforeInput(driver) {
  const timeoutMs = 120000;
  const pollIntervalMs = 2000;
  const endTime = Date.now() + timeoutMs;

  while (Date.now() < endTime) {
    try {
      const visible = await isPasswordPageVisible(driver);
      if (visible) {
        await driver.pause(800);
        console.log("密码页已出现，开始输入密码。");
        return;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error("UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：等待密码页）。");
      }
    }

    console.log("等待账号验证完成并进入密码页...");
    await driver.pause(pollIntervalMs);
  }

  throw new Error("等待密码页超时，请检查账号验证流程是否被额外页面拦截。");
}


async function waitForLoginResultPage(driver) {
  const timeoutMs = 120000;
  const pollIntervalMs = 3000;
  const endTime = Date.now() + timeoutMs;

  while (Date.now() < endTime) {
    try {
      const currentPackage = await driver.getCurrentPackage();
      if (TK_APP_IDS.includes(currentPackage)) {
        console.log(`登录完成，已回到 TK 应用: ${currentPackage}`);
        return;
      }

      const stillOnPasswordPage = await isPasswordPageVisible(driver);
      if (!stillOnPasswordPage) {
        console.log("已离开密码页，进入登录结果页（可能是 Google 后续验证或授权页）。");
        return;
      }
    } catch (_) {
    }

    console.log("等待登录结果页...");
    await driver.pause(pollIntervalMs);
  }

  throw new Error("等待登录结果页超时，请检查是否需要验证码或人工确认。");
}


async function inputGooglePassword(driver, password) {
  const nativeSelectors = [
    'android=new UiSelector().className("android.widget.EditText").focused(true)',
    'android=new UiSelector().resourceId("password")',
    'android=new UiSelector().textContains("Enter your password")',
    'android=new UiSelector().textContains("password")',
    'android=new UiSelector().descriptionContains("password")',
    'android=new UiSelector().className("android.widget.EditText")',
    '//*[@resource-id="password" and contains(@class,"EditText")]',
    '//*[contains(@text,"password") and contains(@class,"EditText")]'
  ];
  const webviewSelectors = [
    'input[type="password"]',
    'input[name="Passwd"]',
    '#password input',
    '//input[@type="password" or contains(translate(@aria-label,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"password") or contains(translate(@placeholder,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"password")]'
  ];
  const timeoutMs = 45000;
  const pollIntervalMs = 2000;
  const endTime = Date.now() + timeoutMs;
  let lastError;

  async function tryInputByNativeSelectors() {
    for (const selector of nativeSelectors) {
      const elements = await driver.$$(selector);
      for (const element of elements) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (!exists || !displayed) {
          continue;
        }

        await element.click();
        await driver.pause(300);
        try {
          await element.clearValue();
        } catch (_) {
        }
        await element.setValue(password);
        console.log("已在 Enter your password 输入密码");
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
          await element.setValue(password);
          console.log(`已在 Enter your password 输入密码 (webview: ${selector})`);
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
          "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：输入密码）。"
        );
      }
      lastError = err;
    }

    console.log("等待 Enter your password 输入框出现...");
    await driver.pause(pollIntervalMs);
  }

  throw new Error(
    [
      "未找到 Enter your password 输入框。",
      `已等待约 ${Math.floor(timeoutMs / 1000)} 秒。`,
      `最后错误: ${String(lastError?.message || "未知错误")}`
    ].join("\n")
  );
}


module.exports = {
  isPasswordPageVisible,
  waitForPasswordPageBeforeInput,
  waitForLoginResultPage,
  inputGooglePassword
};
