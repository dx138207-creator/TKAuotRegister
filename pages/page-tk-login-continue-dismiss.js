const { isUiAutomator2CrashedError, clickByKeywordsFromSourceBounds } = require("../lib/appium-shared");

async function isContinueWithPhoneModal(driver) {
  try {
    const source = await driver.getPageSource();
    const hasContinue = /Continue with/i.test(source);
    const hasNone = /NONE OF THE ABOVE/i.test(source);
    if (hasContinue && hasNone) {
      return true;
    }
  } catch (_) {
  }

  try {
    const noneSelectors = [
      'android=new UiSelector().textContains("NONE OF THE ABOVE")',
      'android=new UiSelector().textContains("NONE OF THE")',
      '//*[contains(@text,"NONE OF THE ABOVE")]'
    ];
    for (const sel of noneSelectors) {
      const els = await driver.$$(sel);
      for (const el of els) {
        if ((await el.isExisting()) && (await el.isDisplayed())) {
          return true;
        }
      }
    }
  } catch (_) {
  }
  return false;
}

async function clickNoneOfTheAbove(driver) {
  const selectors = [
    'android=new UiSelector().text("NONE OF THE ABOVE")',
    'android=new UiSelector().textContains("NONE OF THE ABOVE")',
    '//*[contains(@text,"NONE OF THE ABOVE")]',
    '//*[contains(translate(@text,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"none of the above")]'
  ];
  for (const selector of selectors) {
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
      console.log(`已点击 Continue with 弹窗: NONE OF THE ABOVE (selector: ${selector})`);
      return true;
    }
  }

  if (await clickByKeywordsFromSourceBounds(driver, ["NONE OF THE ABOVE", "NONE OF THE"], "NONE OF THE ABOVE")) {
    return true;
  }
  return false;
}

async function clickLogInScreenBack(driver) {
  const selectors = [
    "~Navigate up",
    'android=new UiSelector().description("Navigate up")',
    'android=new UiSelector().descriptionContains("Navigate up")',
    'android=new UiSelector().descriptionContains("Back")',
    'android=new UiSelector().description("Back")',
    '//*[@content-desc="Navigate up" or @content-desc="Back" or contains(@content-desc,"Navigate")]',
    '//*[contains(@class,"ImageButton") and (contains(@content-desc,"Back") or contains(@content-desc,"Navigate"))]'
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
        await element.click();
        console.log(`已点击 Log in 页左上角返回 (selector: ${selector})`);
        return true;
      }
    } catch (_) {
    }
  }

  if (await clickByKeywordsFromSourceBounds(driver, ["Navigate up"], "返回")) {
    return true;
  }

  const rect = await driver.getWindowRect();
  const x = Math.floor(rect.width * 0.08);
  const y = Math.floor(rect.height * 0.06);
  await driver.execute("mobile: clickGesture", { x, y });
  console.log(`已通过左上角坐标兜底点击返回: (${x}, ${y})`);
  return true;
}

async function dismissTkLoginContinueModalIfPresent(driver) {
  const waitForModalMs = 10000;
  const pollMs = 700;
  const endTime = Date.now() + waitForModalMs;

  while (Date.now() < endTime) {
    try {
      if (await isContinueWithPhoneModal(driver)) {
        const clickedNone = await clickNoneOfTheAbove(driver);
        if (!clickedNone) {
          console.log("检测到 Continue with 弹窗但未能点击 NONE OF THE ABOVE，稍后重试...");
          await driver.pause(pollMs);
          continue;
        }
        await driver.pause(700);
        await clickLogInScreenBack(driver);
        console.log("已处理 Continue with 弹窗并点击返回。");
        return;
      }
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        throw new Error(
          "UiAutomator2 会话已崩溃，请重启 Appium 服务后重试（当前步骤：Log in 弹窗处理）。"
        );
      }
      console.log(`检测 Log in 弹窗异常（忽略）: ${String(err?.message || err)}`);
    }
    await driver.pause(pollMs);
  }

  console.log("10 秒内未出现 Continue with / NONE OF THE ABOVE 弹窗，跳过该步骤。");
}

module.exports = { dismissTkLoginContinueModalIfPresent, isContinueWithPhoneModal };
