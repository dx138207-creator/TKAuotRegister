const { isUiAutomator2CrashedError } = require("../lib/appium-shared");

const STEP_WAIT_MS = 15000;
const POLL_MS = 500;

async function isSwipeUpStartPageMx(driver) {
  const selectors = [
    'android=new UiSelector().textContains("Desliza hacia arriba para empezar a ver")',
    'android=new UiSelector().textContains("Desliza hacia arriba")',
    '//*[contains(@text,"Desliza hacia arriba para empezar a ver")]',
    '//*[contains(@text,"Desliza hacia arriba")]'
  ];
  for (const selector of selectors) {
    const elements = await driver.$$(selector);
    for (const element of elements) {
      const exists = await element.isExisting();
      const displayed = exists ? await element.isDisplayed() : false;
      if (exists && displayed) {
        return true;
      }
    }
  }
  try {
    const source = await driver.getPageSource();
    if (/desliza hacia arriba para empezar a ver/i.test(source)) {
      return true;
    }
  } catch (_) {
  }
  return false;
}

async function performSwipeUpFullscreenMx(driver) {
  const rect = await driver.getWindowRect();
  const swipePayload = {
    left: 0,
    top: 0,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    direction: "up",
    percent: 0.55
  };
  await driver.execute("mobile: swipeGesture", swipePayload);
  await driver.pause(450);
  await driver.execute("mobile: swipeGesture", swipePayload);
  await driver.pause(450);
}

async function waitSwipeUpStartWatchingIfPresentMx(driver) {
  const deadline = Date.now() + STEP_WAIT_MS;

  while (Date.now() < deadline) {
    try {
      if (await isSwipeUpStartPageMx(driver)) {
        await performSwipeUpFullscreenMx(driver);
        console.log("已在墨西哥上滑引导页执行两次向上滑动。");
        return;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error(
          "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：墨西哥 Swipe up 引导）。"
        );
      }
      console.log(`检测墨西哥上滑引导页异常（忽略）: ${String(err?.message || err)}`);
    }
    await driver.pause(POLL_MS);
  }

  console.log("15秒内未出现「Desliza hacia arriba para empezar a ver」引导页，结束本步骤。");
}

module.exports = {
  waitSwipeUpStartWatchingIfPresentMx,
  isSwipeUpStartPageMx,
  STEP_WAIT_MS
};
