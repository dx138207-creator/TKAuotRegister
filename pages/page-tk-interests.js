const { isUiAutomator2CrashedError, clickByKeywordsFromSourceBounds } = require("../lib/appium-shared");

async function isOnInterestsPage(driver) {
  const pageMarkers = [
    'android=new UiSelector().textContains("Choose your interests")',
    'android=new UiSelector().textContains("choose your interests")',
    'android=new UiSelector().textContains("Get better video recommendations")',
    'android=new UiSelector().textContains("interests")'
  ];
  for (const marker of pageMarkers) {
    const elements = await driver.$$(marker);
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
    if (/Choose your interests/i.test(source) && /Skip/i.test(source)) {
      return true;
    }
  } catch (_) {
  }
  return false;
}

async function tryClickSkipWithParentFallback(element) {
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
}

async function resolveElementRect(driver, element) {
  const id = element?.elementId;
  if (id && typeof driver.getElementRect === "function") {
    try {
      return await driver.getElementRect(id);
    } catch (_) {
    }
  }
  try {
    const location = await element.getLocation();
    const size = await element.getSize();
    return {
      x: location.x,
      y: location.y,
      width: size.width,
      height: size.height
    };
  } catch (_) {
    return null;
  }
}

async function clickInterestsSkip(driver) {
  const skipSelectors = [
    'android=new UiSelector().text("Skip")',
    'android=new UiSelector().textContains("Skip")',
    'android=new UiSelector().description("Skip")',
    'android=new UiSelector().descriptionContains("Skip")',
    '//*[@text="Skip" or @content-desc="Skip"]',
    '//*[contains(translate(@text,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"skip")]'
  ];

  const candidates = [];
  for (const selector of skipSelectors) {
    const elements = await driver.$$(selector);
    for (const element of elements) {
      const exists = await element.isExisting();
      const displayed = exists ? await element.isDisplayed() : false;
      if (!exists || !displayed) {
        continue;
      }
      const text = String((await element.getText()) || "").trim().toLowerCase();
      const desc = String((await element.getAttribute("content-desc")) || "")
        .trim()
        .toLowerCase();
      if (text && !text.includes("skip")) {
        continue;
      }
      if (desc && !desc.includes("skip")) {
        continue;
      }
      candidates.push({ element, selector });
    }
  }

  if (candidates.length > 0) {
    let best = candidates[0];
    let bestBottom = -1;
    for (const c of candidates) {
      const r = await resolveElementRect(driver, c.element);
      const bottom = r ? r.y + r.height : 0;
      if (bottom >= bestBottom) {
        bestBottom = bottom;
        best = c;
      }
    }
    await tryClickSkipWithParentFallback(best.element);
    console.log(`已在兴趣页点击 Skip（优先底部按钮）(selector: ${best.selector})`);
    return true;
  }

  if (await clickByKeywordsFromSourceBounds(driver, ["Skip"], "兴趣页 Skip")) {
    console.log("已通过源码坐标点击兴趣页 Skip");
    return true;
  }

  const win = await driver.getWindowRect();
  const x = Math.floor(win.width * 0.22);
  const y = Math.floor(win.height * 0.91);
  await driver.execute("mobile: clickGesture", { x, y });
  console.log(`已通过左下角兜底坐标点击兴趣页 Skip: (${x}, ${y})`);
  return true;
}

async function handleInterestsSkipOptional(driver) {
  const timeoutMs = 10000;
  const pollIntervalMs = 900;
  const endTime = Date.now() + timeoutMs;

  while (Date.now() < endTime) {
    try {
      const onPage = await isOnInterestsPage(driver);
      if (!onPage) {
        await driver.pause(pollIntervalMs);
        continue;
      }

      console.log("已检测到 Choose your interests 页面，尝试点击 Skip...");
      const clicked = await clickInterestsSkip(driver);
      if (clicked) {
        return;
      }

      console.log("已检测到兴趣页，但暂未找到 Skip，继续等待...");
    } catch (err) {
      if (isUiAutomator2CrashedError(err)) {
        console.log("兴趣页检测时会话不稳定，跳过兴趣页处理并结束脚本。");
        return;
      }
      console.log(`兴趣页处理异常，跳过并结束脚本：${String(err?.message || err)}`);
      return;
    }

    await driver.pause(pollIntervalMs);
  }

  console.log("10 秒内未检测到兴趣页，跳过兴趣页处理。");
}

module.exports = { handleInterestsSkipOptional, isOnInterestsPage, clickInterestsSkip };
