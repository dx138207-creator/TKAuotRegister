const { isUiAutomator2CrashedError, clickByKeywordsFromSourceBounds } = require("../lib/appium-shared");

const FEED_WAIT_MS = 12000;
const POLL_MS = 400;

async function isLikelyMainFeed(driver) {
  const markers = [
    'android=new UiSelector().text("For You")',
    'android=new UiSelector().textContains("For You")',
    'android=new UiSelector().textContains("Swipe up for more")',
    'android=new UiSelector().textContains("Following")',
    '//*[contains(@text,"For You")]',
    '//*[contains(@text,"Swipe up for more")]'
  ];
  for (const selector of markers) {
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
    if (
      /For You/i.test(source) ||
      /Swipe up for more/i.test(source) ||
      /Nearby/i.test(source)
    ) {
      return true;
    }
  } catch (_) {
  }
  return false;
}

async function performSwipeUpFromCenterShort(driver) {
  const rect = await driver.getWindowRect();
  const w = rect.width;
  const h = rect.height;
  const boxW = Math.floor(w * 0.5);
  const boxH = Math.floor(h * 0.38);
  const left = Math.floor((w - boxW) / 2);
  const top = Math.floor((h - boxH) / 2);
  await driver.execute("mobile: swipeGesture", {
    left,
    top,
    width: Math.max(1, boxW),
    height: Math.max(1, boxH),
    direction: "up",
    percent: 0.32
  });
  await driver.pause(450);
}

async function tryClickProfileTab(driver) {
  const selectors = [
    "~Profile",
    'android=new UiSelector().description("Profile")',
    'android=new UiSelector().descriptionContains("Profile")',
    'android=new UiSelector().text("Profile")',
    '//*[@content-desc="Profile" or @text="Profile"]',
    '//*[contains(@content-desc,"Profile") and contains(@class,"FrameLayout")]'
  ];

  for (const selector of selectors) {
    try {
      const elements = await driver.$$(selector);
      for (const element of elements) {
        const exists = await element.isExisting();
        const displayed = exists ? await element.isDisplayed() : false;
        if (!exists || !displayed) {
          continue;
        }
        let target = element;
        for (let i = 0; i < 4; i++) {
          try {
            const clickable = await target.getAttribute("clickable");
            if (String(clickable) === "true") {
              break;
            }
          } catch (_) {
          }
          try {
            const parent = await target.$("..");
            if (await parent.isExisting()) {
              target = parent;
            } else {
              break;
            }
          } catch (_) {
            break;
          }
        }
        await target.click();
        console.log(`已点击底部导航 Profile (selector: ${selector})`);
        return true;
      }
    } catch (_) {
    }
  }

  if (await clickByKeywordsFromSourceBounds(driver, ["Profile"], "底部 Profile")) {
    console.log("已通过源码坐标点击 Profile");
    return true;
  }

  const win = await driver.getWindowRect();
  const x = Math.floor(win.width * 0.88);
  const y = Math.floor(win.height * 0.945);
  await driver.execute("mobile: clickGesture", { x, y });
  console.log(`已通过右下角兜底坐标点击 Profile: (${x}, ${y})`);
  return true;
}

async function swipeDownAndOpenProfile(driver) {
  const deadline = Date.now() + FEED_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      if (await isLikelyMainFeed(driver)) {
        break;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error(
          "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：主刷进入 Profile）。"
        );
      }
    }
    await driver.pause(POLL_MS);
  }

  await performSwipeUpFromCenterShort(driver);
  await tryClickProfileTab(driver);
  console.log("已从屏幕中央小幅上滑并尝试点击 Profile 进入个人主页。");
}

module.exports = {
  swipeDownAndOpenProfile,
  isLikelyMainFeed,
  performSwipeUpFromCenterShort
};
