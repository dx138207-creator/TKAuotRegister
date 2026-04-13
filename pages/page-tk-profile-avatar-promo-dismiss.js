const { isUiAutomator2CrashedError, clickByKeywordsFromSourceBounds } = require("../lib/appium-shared");

const WAIT_MS = 15000;
const POLL_MS = 400;

async function isAvatarPromoModal(driver) {
  const selectors = [
    'android=new UiSelector().textContains("Your avatar, your style")',
    'android=new UiSelector().textContains("your avatar, your style")',
    'android=new UiSelector().textContains("Create your TikTok avatar")',
    'android=new UiSelector().textContains("TikTok avatar")',
    '//*[contains(@text,"Your avatar, your style")]',
    '//*[contains(@text,"Create your TikTok avatar")]'
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
    if (
      /Your avatar, your style/i.test(source) ||
      /Create your TikTok avatar/i.test(source)
    ) {
      return true;
    }
  } catch (_) {
  }
  return false;
}

async function tryClickCloseOnPromo(driver) {
  const selectors = [
    "~Close",
    'android=new UiSelector().description("Close")',
    'android=new UiSelector().descriptionContains("Close")',
    'android=new UiSelector().description("Dismiss")',
    'android=new UiSelector().descriptionContains("Dismiss")',
    'android=new UiSelector().text("Close")',
    '//*[@content-desc="Close" or @content-desc="Dismiss" or contains(@content-desc,"Close")]',
    '//*[contains(@class,"ImageButton") and (contains(@content-desc,"Close") or contains(@content-desc,"close"))]'
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
        for (let i = 0; i < 3; i++) {
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
        console.log(`已点击公告弹窗关闭 (selector: ${selector})`);
        return true;
      }
    } catch (_) {
    }
  }

  if (await clickByKeywordsFromSourceBounds(driver, ["Close"], "弹窗关闭")) {
    console.log("已通过源码坐标点击关闭");
    return true;
  }

  const win = await driver.getWindowRect();
  const x = Math.floor(win.width * 0.91);
  const y = Math.floor(win.height * 0.17);
  await driver.execute("mobile: clickGesture", { x, y });
  console.log(`已通过右上角兜底坐标点击弹窗关闭: (${x}, ${y})`);
  return true;
}

async function dismissProfileAvatarPromoIfPresent(driver) {
  const deadline = Date.now() + WAIT_MS;

  while (Date.now() < deadline) {
    try {
      if (await isAvatarPromoModal(driver)) {
        await tryClickCloseOnPromo(driver);
        await driver.pause(450);
        return;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error(
          "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：个人主页公告弹窗）。"
        );
      }
      console.log(`检测头像公告弹窗异常（忽略）: ${String(err?.message || err)}`);
    }
    await driver.pause(POLL_MS);
  }

  console.log("15秒内未出现头像/公告类弹窗，跳过关闭步骤。");
}

module.exports = { dismissProfileAvatarPromoIfPresent, isAvatarPromoModal };
