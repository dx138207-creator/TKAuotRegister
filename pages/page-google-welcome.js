const { isUiAutomator2CrashedError } = require("../lib/appium-shared");

async function handleWelcomeAndClickIUnderstand(driver) {
  const understandSelectors = [
    'android=new UiSelector().text("I UNDERSTAND")',
    'android=new UiSelector().textContains("I UNDERSTAND")',
    'android=new UiSelector().description("I UNDERSTAND")',
    '//*[@text="I UNDERSTAND" or @content-desc="I UNDERSTAND"]'
  ];
  const welcomeMarkers = [
    'android=new UiSelector().textContains("Welcome to your new account")',
    'android=new UiSelector().textContains("Google Workspace for Education")',
    'android=new UiSelector().textContains("Welcome")'
  ];
  const timeoutMs = 90000;
  const pollIntervalMs = 1500;
  const endTime = Date.now() + timeoutMs;
  let sawWelcome = false;

  async function clickUnderstandIfVisible() {
    for (const selector of understandSelectors) {
      const elements = await driver.$$(selector);
      for (const element of elements) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (!exists || !displayed) {
          continue;
        }
        await element.click();
        console.log(`已点击 I UNDERSTAND 按钮 (selector: ${selector})`);
        return true;
      }
    }
    return false;
  }

  async function onWelcomePage() {
    for (const selector of welcomeMarkers) {
      const elements = await driver.$$(selector);
      for (const element of elements) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (exists && displayed) {
          return true;
        }
      }
    }
    return false;
  }

  while (Date.now() < endTime) {
    try {
      if (await clickUnderstandIfVisible()) {
        return;
      }

      const isWelcome = await onWelcomePage();
      sawWelcome = sawWelcome || isWelcome;

      if (isWelcome) {
        const rect = await driver.getWindowRect();
        await driver.execute("mobile: swipeGesture", {
          left: Math.floor(rect.width * 0.15),
          top: Math.floor(rect.height * 0.20),
          width: Math.floor(rect.width * 0.70),
          height: Math.floor(rect.height * 0.60),
          direction: "up",
          percent: 0.9
        });
        console.log("欢迎页向上滑动，查找 I UNDERSTAND...");
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        console.log("检测 Welcome 分支时会话不稳定，跳过 I UNDERSTAND 步骤继续后续流程。");
        return;
      }
      console.log(`检测 Welcome 分支异常，跳过 I UNDERSTAND：${String(err?.message || err)}`);
      return;
    }

    await driver.pause(pollIntervalMs);
  }

  if (sawWelcome) {
    console.log("已进入 Welcome 页但未找到 I UNDERSTAND，跳过该步骤继续后续流程。");
    return;
  }
  console.log("未检测到 Welcome 页，跳过 I UNDERSTAND 步骤。");
}


module.exports = { handleWelcomeAndClickIUnderstand };
