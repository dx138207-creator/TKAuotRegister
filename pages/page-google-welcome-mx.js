const { isUiAutomator2CrashedError } = require("../lib/appium-shared");

async function handleWelcomeAndClickEntendido(driver) {
  const entendidoSelectors = [
    'android=new UiSelector().text("ENTENDIDO")',
    'android=new UiSelector().textContains("ENTENDIDO")',
    'android=new UiSelector().description("ENTENDIDO")',
    '//*[@text="ENTENDIDO" or @content-desc="ENTENDIDO"]'
  ];
  const welcomeMarkers = [
    'android=new UiSelector().textContains("Te damos la bienvenida")',
    'android=new UiSelector().textContains("nueva cuenta")',
    'android=new UiSelector().textContains("Google Workspace for Education")'
  ];
  const timeoutMs = 45000;
  const pollIntervalMs = 1500;
  const endTime = Date.now() + timeoutMs;
  let sawWelcome = false;

  async function clickEntendidoIfVisible() {
    for (const selector of entendidoSelectors) {
      const elements = await driver.$$(selector);
      for (const element of elements) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (!exists || !displayed) {
          continue;
        }
        await element.click();
        console.log(`已点击 ENTENDIDO 按钮 (selector: ${selector})`);
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
      if (await clickEntendidoIfVisible()) {
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
        console.log("墨西哥欢迎页向上滑动，查找 ENTENDIDO...");
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        console.log("检测墨西哥 Welcome 分支时会话不稳定，跳过 ENTENDIDO 步骤继续后续流程。");
        return;
      }
      console.log(`检测墨西哥 Welcome 分支异常，跳过 ENTENDIDO：${String(err?.message || err)}`);
      return;
    }

    await driver.pause(pollIntervalMs);
  }

  if (sawWelcome) {
    console.log("已进入墨西哥 Welcome 页但未找到 ENTENDIDO，跳过该步骤继续后续流程。");
    return;
  }
  console.log("未检测到墨西哥 Welcome 页，跳过 ENTENDIDO 步骤。");
}

module.exports = { handleWelcomeAndClickEntendido };
