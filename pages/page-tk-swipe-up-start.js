const { isUiAutomator2CrashedError } = require("../lib/appium-shared");

const STEP_WAIT_MS = 15000;
const POLL_MS = 500;

async function isSwipeUpStartPage(driver) {
  const selectors = [
    'android=new UiSelector().textContains("Swipe up to start watching")',
    'android=new UiSelector().textContains("Swipe up to start")',
    '//*[contains(@text,"Swipe up to start watching")]',
    '//*[contains(@text,"Swipe up to start")]'
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
    if (/swipe up to start watching/i.test(source)) {
      return true;
    }
  } catch (_) {
  }
  return false;
}

async function performSwipeUpFullscreen(driver) {
  const rect = await driver.getWindowRect();
  await driver.execute("mobile: swipeGesture", {
    left: 0,
    top: 0,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    direction: "up",
    percent: 0.55
  });
  await driver.pause(400);
}

async function waitSwipeUpStartWatchingIfPresent(driver) {
  const deadline = Date.now() + STEP_WAIT_MS;

  while (Date.now() < deadline) {
    try {
      if (await isSwipeUpStartPage(driver)) {
        await performSwipeUpFullscreen(driver);
        console.log("已在上滑引导页执行向上滑动。");
        return;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error(
          "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：Swipe up 引导）。"
        );
      }
      console.log(`检测上滑引导页异常（忽略）: ${String(err?.message || err)}`);
    }
    await driver.pause(POLL_MS);
  }

  console.log("15秒内未出现「Swipe up to start watching」引导页，结束本步骤。");
}

module.exports = {
  waitSwipeUpStartWatchingIfPresent,
  isSwipeUpStartPage,
  STEP_WAIT_MS
};
